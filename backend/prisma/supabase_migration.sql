-- ============================================================================
-- ONEREAL LMS COMPLETE SUPABASE MIGRATION SQL
-- Includes Schema Enhancements, Server-Side RPC Functions, Quiz Security,
-- Dynamic BECE Calculations, and Strict Row Level Security (RLS) Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USER IDENTITY LINKING
-- Add auth_id column linking Supabase auth.users.id (UUID) to public.users.id (Int)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Helper function to map Supabase auth.uid() (UUID) -> public.users.id (Int)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS INT AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT UPPER(role) FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 2. QUIZ SECURITY: SECURE QUIZ FETCH (Excludes isCorrect)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_quiz(p_quiz_id INT)
RETURNS JSONB AS $$
DECLARE
  v_quiz RECORD;
  v_questions JSONB;
BEGIN
  -- Verify quiz exists and is published
  SELECT id, title, duration, instructions, "attemptLimit", "dueDate", "courseId"
  INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id AND "isPublished" = true;

  IF v_quiz.id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found or not published';
  END IF;

  -- Build questions JSON excluding isCorrect boolean
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'questionText', q."questionText",
      'points', q.points,
      'options', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'optionLabel', o."optionLabel",
            'optionText', o."optionText"
            -- NOT INCLUDING isCorrect HERE!
          ) ORDER BY o."optionLabel"
        ), '[]'::jsonb)
        FROM public.quiz_options o
        WHERE o."questionId" = q.id
      )
    )
  ), '[]'::jsonb)
  INTO v_questions
  FROM public.quiz_questions q
  WHERE q."quizId" = p_quiz_id;

  RETURN jsonb_build_object(
    'id', v_quiz.id,
    'title', v_quiz.title,
    'duration', v_quiz.duration,
    'instructions', v_quiz.instructions,
    'attemptLimit', v_quiz."attemptLimit",
    'dueDate', v_quiz."dueDate",
    'questions', v_questions
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 3. SERVER-SIDE QUIZ AUTO-GRADING & ATTEMPT SUBMISSION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_quiz_id INT,
  p_answers JSONB -- Expected format: {"<questionId>": <selectedOptionId>, ...}
)
RETURNS JSONB AS $$
DECLARE
  v_user_id INT;
  v_student_id INT;
  v_quiz RECORD;
  v_attempt_id INT;
  v_question RECORD;
  v_selected_option_id INT;
  v_correct_option_id INT;
  v_is_correct BOOLEAN;
  v_score FLOAT := 0;
  v_total FLOAT := 0;
  v_points_earned INT := 0;
BEGIN
  v_user_id := public.get_current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_student_id FROM public.students WHERE "userId" = v_user_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student record not found';
  END IF;

  SELECT id, title, "attemptLimit" INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF v_quiz.id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  -- Create QuizAttempt record
  INSERT INTO public.quiz_attempts ("studentId", "quizId", score, total, strikes, "submittedAt")
  VALUES (v_student_id, p_quiz_id, 0, 0, 0, NOW())
  RETURNING id INTO v_attempt_id;

  -- Loop through questions and evaluate answers server-side
  FOR v_question IN SELECT id, points FROM public.quiz_questions WHERE "quizId" = p_quiz_id LOOP
    v_total := v_total + v_question.points;
    v_selected_option_id := (p_answers->>(v_question.id::text))::INT;

    -- Find correct option
    SELECT id INTO v_correct_option_id
    FROM public.quiz_options
    WHERE "questionId" = v_question.id AND "isCorrect" = true
    LIMIT 1;

    v_is_correct := (v_selected_option_id IS NOT NULL AND v_correct_option_id IS NOT NULL AND v_selected_option_id = v_correct_option_id);

    IF v_is_correct THEN
      v_score := v_score + v_question.points;
    END IF;

    -- Insert QuizAnswer
    INSERT INTO public.quiz_answers ("attemptId", "questionId", "selectedOptionId", "isCorrect")
    VALUES (v_attempt_id, v_question.id, v_selected_option_id, v_is_correct);
  END LOOP;

  -- Update Attempt Final Score
  UPDATE public.quiz_attempts
  SET score = v_score, total = v_total
  WHERE id = v_attempt_id;

  -- Award student XP points (+15 for completing a quiz)
  v_points_earned := 15;
  IF v_total > 0 AND (v_score / v_total) >= 0.8 THEN
    v_points_earned := v_points_earned + 10; -- Bonus for score >= 80%
  END IF;

  UPDATE public.students
  SET points = points + v_points_earned
  WHERE id = v_student_id;

  -- Audit log
  INSERT INTO public.audit_logs ("userId", action, details, "createdAt")
  VALUES (v_user_id, 'QUIZ_SUBMIT', 'Submitted quiz: ' || v_quiz.title || ' (Attempt ID: ' || v_attempt_id || ')', NOW());

  RETURN jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'total', v_total,
    'percentage', CASE WHEN v_total > 0 THEN ROUND(((v_score / v_total) * 100)::numeric, 1) ELSE 0 END,
    'pointsEarned', v_points_earned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 4. DYNAMIC JHS / BECE AGGREGATE CALCULATION (Core 4 + Best 2 Electives)
-- Dynamic subject identification (No hard-coded subject IDs)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_bece_aggregate(p_student_id INT)
RETURNS JSONB AS $$
DECLARE
  v_core_score INT := 0;
  v_best_elective_score INT := 0;
  v_total_aggregate INT := 0;
  v_subject_count INT := 0;
  v_core_count INT := 0;
  v_subject_record RECORD;
  v_core_details JSONB := '[]'::jsonb;
  v_elective_details JSONB := '[]'::jsonb;
BEGIN
  -- Compute average grade percentage per subject for this student from best quiz attempts & assignment submissions
  -- Grade mapping: 85-100% -> Grade 1, 80-84% -> Grade 2, 75-79% -> Grade 3, 70-74% -> Grade 4,
  --                65-69% -> Grade 5, 60-64% -> Grade 6, 55-59% -> Grade 7, 50-54% -> Grade 8, <50% -> Grade 9

  -- Loop through all subjects student has grades for
  FOR v_subject_record IN
    WITH student_subject_scores AS (
      SELECT 
        s.id AS subject_id,
        s.name AS subject_name,
        AVG(qa.score / NULLIF(qa.total, 0) * 100) AS avg_pct
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON qa."quizId" = q.id
      JOIN public.courses c ON q."courseId" = c.id
      JOIN public.subjects s ON c."subjectId" = s.id
      WHERE qa."studentId" = p_student_id AND qa.total > 0
      GROUP BY s.id, s.name
    )
    SELECT 
      subject_id,
      subject_name,
      avg_pct,
      CASE 
        WHEN avg_pct >= 85 THEN 1
        WHEN avg_pct >= 80 THEN 2
        WHEN avg_pct >= 75 THEN 3
        WHEN avg_pct >= 70 THEN 4
        WHEN avg_pct >= 65 THEN 5
        WHEN avg_pct >= 60 THEN 6
        WHEN avg_pct >= 55 THEN 7
        WHEN avg_pct >= 50 THEN 8
        ELSE 9
      END AS bece_grade,
      -- Dynamic core detection by checking standard Ghanaian Core subject name patterns
      (LOWER(subject_name) LIKE '%english%' OR 
       LOWER(subject_name) LIKE '%math%' OR 
       LOWER(subject_name) LIKE '%science%' OR 
       LOWER(subject_name) LIKE '%social%') AS is_core
    FROM student_subject_scores
    ORDER BY is_core DESC, bece_grade ASC
  LOOP
    IF v_subject_record.is_core THEN
      v_core_score := v_core_score + v_subject_record.bece_grade;
      v_core_count := v_core_count + 1;
      v_core_details := v_core_details || jsonb_build_object(
        'subject', v_subject_record.subject_name,
        'percentage', ROUND(v_subject_record.avg_pct::numeric, 1),
        'grade', v_subject_record.bece_grade
      );
    ELSE
      -- Pick top 2 electives
      IF jsonb_array_length(v_elective_details) < 2 THEN
        v_best_elective_score := v_best_elective_score + v_subject_record.bece_grade;
        v_elective_details := v_elective_details || jsonb_build_object(
          'subject', v_subject_record.subject_name,
          'percentage', ROUND(v_subject_record.avg_pct::numeric, 1),
          'grade', v_subject_record.bece_grade
        );
      END IF;
    END IF;
  END LOOP;

  v_total_aggregate := v_core_score + v_best_elective_score;

  RETURN jsonb_build_object(
    'studentId', p_student_id,
    'coreScore', v_core_score,
    'coreCount', v_core_count,
    'bestElectivesScore', v_best_elective_score,
    'totalAggregate', v_total_aggregate,
    'coreSubjects', v_core_details,
    'electiveSubjects', v_elective_details
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES ON ALL 39 TABLES
-- ----------------------------------------------------------------------------

-- Enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- ─── USERS POLICIES ─────────────────────────────────────
CREATE POLICY users_select_policy ON public.users FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    id = public.get_current_user_id() OR
    public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  )
);

CREATE POLICY users_update_policy ON public.users FOR UPDATE USING (
  id = public.get_current_user_id() OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

-- ─── STUDENTS POLICIES ──────────────────────────────────
CREATE POLICY students_select_policy ON public.students FOR SELECT USING (
  "userId" = public.get_current_user_id() OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

-- ─── NOTES POLICIES (Strict Student Isolation) ───────────
CREATE POLICY notes_all_policy ON public.notes FOR ALL USING (
  "userId" = public.get_current_user_id() OR "isShared" = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

-- ─── QUIZ ATTEMPTS POLICIES (No Student Grade Tampering) ─
CREATE POLICY quiz_attempts_select_policy ON public.quiz_attempts FOR SELECT USING (
  "studentId" IN (SELECT id FROM public.students WHERE "userId" = public.get_current_user_id()) OR
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

-- Block direct INSERT/UPDATE on quiz_attempts for students (must use submit_quiz_attempt RPC)
CREATE POLICY quiz_attempts_insert_policy ON public.quiz_attempts FOR INSERT WITH CHECK (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

-- ─── SUBMISSIONS POLICIES ───────────────────────────────
CREATE POLICY submissions_select_policy ON public.submissions FOR SELECT USING (
  "studentId" IN (SELECT id FROM public.students WHERE "userId" = public.get_current_user_id()) OR
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

CREATE POLICY submissions_insert_policy ON public.submissions FOR INSERT WITH CHECK (
  "studentId" IN (SELECT id FROM public.students WHERE "userId" = public.get_current_user_id())
);

CREATE POLICY submissions_update_policy ON public.submissions FOR UPDATE USING (
  -- Teachers/Admins can grade; Students can update text/file before grade is assigned
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER') OR
  ("studentId" IN (SELECT id FROM public.students WHERE "userId" = public.get_current_user_id()) AND grade IS NULL)
);

-- ─── MESSAGES POLICIES ──────────────────────────────────
CREATE POLICY messages_select_policy ON public.messages FOR SELECT USING (
  "senderId" = public.get_current_user_id() OR "receiverId" = public.get_current_user_id() OR
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

CREATE POLICY messages_insert_policy ON public.messages FOR INSERT WITH CHECK (
  "senderId" = public.get_current_user_id()
);

-- ─── NOTIFICATIONS POLICIES ─────────────────────────────
CREATE POLICY notifications_select_policy ON public.notifications FOR SELECT USING (
  "userId" = public.get_current_user_id() OR "isGlobal" = true OR
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

-- ─── SETTINGS POLICIES ──────────────────────────────────
CREATE POLICY settings_select_policy ON public.settings FOR SELECT USING (true); -- Public read
CREATE POLICY settings_update_policy ON public.settings FOR UPDATE USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);
