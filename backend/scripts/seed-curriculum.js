// seed-curriculum.js — Seeds all Ghana Basic School subjects & courses
// Structure: Class → Subject → Course
// Safe to run multiple times (skips existing entries)
// SQLite compatible — no insensitive mode queries

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CURRICULUM = {
  CRECHE:    ['Language & Literacy', 'Numeracy', 'Creative Activities', 'Environmental Awareness', 'Social & Emotional Development', 'Physical Development', 'Moral Training'],
  NURSERY1:  ['Language & Literacy', 'Numeracy', 'Creative Activities', 'Environmental Awareness', 'Social & Emotional Development', 'Physical Development', 'Moral Training'],
  NURSERY2:  ['Language & Literacy', 'Numeracy', 'Creative Activities', 'Environmental Awareness', 'Social & Emotional Development', 'Physical Development', 'Moral Training'],
  KG1: ['Literacy', 'Numeracy', 'Creative Arts', 'Environmental Studies', 'Physical Education', 'Religious and Moral Education (RME)'],
  KG2: ['Literacy', 'Numeracy', 'Creative Arts', 'Environmental Studies', 'Physical Education', 'Religious and Moral Education (RME)'],
  BASIC1: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC2: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC3: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC4: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC5: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC6: ['English Language', 'Mathematics', 'Science', 'Social Studies', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)'],
  BASIC7: ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Computing', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)', 'Home Economics'],
  BASIC8: ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Computing', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)', 'Home Economics'],
  BASIC9: ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies', 'Computing', 'Religious and Moral Education (RME)', 'Creative Arts and Design', 'Physical Education (PE)', 'Ghanaian Language', 'Career Technology (BDT)', 'Home Economics'],
};

async function main() {
  console.log('🚀 Starting Ghana Basic School curriculum seed...\n');

  // Load all classes from DB once
  const allClasses = await prisma.class.findMany();
  const classMap = {};
  for (const c of allClasses) {
    classMap[c.name.toUpperCase()] = c;
  }

  let subjectCount = 0;
  let courseCount  = 0;
  let skipped      = 0;

  for (const [className, subjects] of Object.entries(CURRICULUM)) {
    const cls = classMap[className.toUpperCase()];
    if (!cls) {
      console.log(`⚠️  Class '${className}' not found in DB — skipping.`);
      continue;
    }

    console.log(`\n📚 ${className} (id:${cls.id})...`);

    // Load existing subjects for this class
    const existingSubjects = await prisma.subject.findMany({ where: { classId: cls.id } });
    const existingSubjectNames = existingSubjects.map(s => s.name.toLowerCase());

    for (const subjectName of subjects) {
      let subject;
      const subjectLower = subjectName.toLowerCase();

      if (existingSubjectNames.includes(subjectLower)) {
        // Use existing subject
        subject = existingSubjects.find(s => s.name.toLowerCase() === subjectLower);
        skipped++;
      } else {
        subject = await prisma.subject.create({
          data: { name: subjectName, classId: cls.id, description: `${subjectName} for ${className}` },
        });
        console.log(`  ✅ Subject: ${subjectName}`);
        subjectCount++;
      }

      // Check if course already exists for this subject
      const existingCourse = await prisma.course.findFirst({
        where: { subjectId: subject.id },
      });

      if (!existingCourse) {
        await prisma.course.create({
          data: {
            title: subjectName,
            subjectId: subject.id,
            description: `${subjectName} course for ${className}`,
          },
        });
        courseCount++;
      }
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`   Subjects created : ${subjectCount}`);
  console.log(`   Courses created  : ${courseCount}`);
  console.log(`   Already existed  : ${skipped} (skipped)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
