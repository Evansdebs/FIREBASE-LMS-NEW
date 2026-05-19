// ⚠️ WARNING: Running this script will immediately delete all existing data, classes, subjects, courses, and non-admin users from the database.
// Do not run this script unless you explicitly want to purge all data and reset the curriculum.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging placeholder data and initializing Ghana Basic School curriculum...');

  try {
    // 1. CLEAR ALL MESSY DATA FIRST (Except Admin)
    // We clear in reverse order of dependencies where possible
    console.log('   - Cleaning up existing records...');
    await prisma.quizAttempt.deleteMany({});
    await prisma.quizAnswer.deleteMany({});
    await prisma.quizQuestion.deleteMany({});
    await prisma.quizOption.deleteMany({});
    await prisma.quiz.deleteMany({});
    await prisma.submission.deleteMany({});
    await prisma.assignment.deleteMany({});
    await prisma.material.deleteMany({});
    await prisma.topic.deleteMany({});
    await prisma.courseTeacher.deleteMany({});
    await prisma.courseClass.deleteMany({});
    await prisma.course.deleteMany({});
    await prisma.subject.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.note.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.forumPost.deleteMany({});
    await prisma.forumThread.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.liveClass.deleteMany({});
    
    // Clear associations
    await prisma.student.deleteMany({});
    await prisma.teacher.deleteMany({});
    
    // Clear Users except SUPER_ADMIN
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { not: 'SUPER_ADMIN' }
      }
    });
    console.log(`✅ Deleted ${deletedUsers.count} placeholder users.`);

    // Clear and reset Classes
    await prisma.class.deleteMany({});
    console.log('✅ All existing classes cleared.');

    // 2. DEFINE CLASSES
    const classLevels = [
      { name: 'CRECHE', type: 'Early' },
      { name: 'NURSERY 1', type: 'Early' },
      { name: 'NURSERY 2', type: 'Early' },
      { name: 'KG 1', type: 'KG' },
      { name: 'KG 2', type: 'KG' },
      { name: 'BASIC 1', type: 'Primary' },
      { name: 'BASIC 2', type: 'Primary' },
      { name: 'BASIC 3', type: 'Primary' },
      { name: 'BASIC 4', type: 'Primary' },
      { name: 'BASIC 5', type: 'Primary' },
      { name: 'BASIC 6', type: 'Primary' },
      { name: 'BASIC 7 (JHS 1)', type: 'JHS' },
      { name: 'BASIC 8 (JHS 2)', type: 'JHS' },
      { name: 'BASIC 9 (JHS 3)', type: 'JHS' },
    ];

    const createdClasses = [];
    for (const level of classLevels) {
      const cls = await prisma.class.create({
        data: {
          name: level.name,
          description: `Ghana Basic Education - ${level.name} level`
        }
      });
      createdClasses.push({ ...cls, type: level.type });
    }
    console.log(`✅ Created ${createdClasses.length} school levels from Creche to JHS.`);

    // 3. DEFINE AND ASSIGN SUBJECTS
    const kgSubjects = ['Creative Arts', 'Language and Literacy', 'Numeracy', 'Our World Our People', 'Physical Development'];
    
    const primarySubjects = [
      'English Language', 
      'Mathematics', 
      'Science', 
      'Our World Our People', 
      'Religious and Moral Education (RME)', 
      'History', 
      'Creative Arts', 
      'Physical Education', 
      'Computing', 
      'Ghanaian Language'
    ];

    const jhsSubjects = [
      'English Language', 
      'Mathematics', 
      'Integrated Science', 
      'Social Studies', 
      'Religious and Moral Education (RME)', 
      'Career Technology', 
      'Creative Arts and Design', 
      'Physical and Health Education', 
      'Computing', 
      'Ghanaian Language', 
      'French'
    ];

    console.log('   - Assigning curriculum subjects to classes...');
    let subjectCount = 0;

    for (const cls of createdClasses) {
      let subjects = [];
      if (cls.type === 'Early' || cls.type === 'KG') {
        subjects = kgSubjects;
      } else if (cls.type === 'Primary') {
        // Only add Computing to Basic 4-6
        subjects = primarySubjects.filter(s => {
          if (s === 'Computing') {
            return ['BASIC 4', 'BASIC 5', 'BASIC 6'].includes(cls.name);
          }
          return true;
        });
      } else if (cls.type === 'JHS') {
        subjects = jhsSubjects;
      }

      for (const subjectName of subjects) {
        await prisma.subject.create({
          data: {
            name: subjectName,
            classId: cls.id,
            description: `${subjectName} curriculum for ${cls.name}`
          }
        });
        subjectCount++;
      }
    }

    console.log(`✅ Successfully initialized ${subjectCount} subject records across all levels.`);
    console.log('\n🚀 SYSTEM READY: Placeholder data removed and official Ghana curriculum loaded.');

  } catch (error) {
    console.error('❌ Error during setup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
