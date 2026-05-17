const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncSubjectsToCatalog() {
  console.log('🔄 Syncing subjects to catalog...');

  try {
    // Get all subjects with their classes
    const subjects = await prisma.subject.findMany({
      include: { class: true }
    });

    if (subjects.length === 0) {
      console.log('❌ No subjects found. Run the curriculum setup script first.');
      return;
    }

    console.log(`📚 Found ${subjects.length} subjects to sync.`);

    let created = 0;
    let skipped = 0;

    for (const subject of subjects) {
      // Check if a course already exists for this subject
      const existing = await prisma.course.findFirst({
        where: { subjectId: subject.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create a course for this subject
      const course = await prisma.course.create({
        data: {
          title: subject.name,
          description: `${subject.name} for ${subject.class.name}`,
          subjectId: subject.id,
        }
      });

      // Link the course to the class
      await prisma.courseClass.create({
        data: {
          courseId: course.id,
          classId: subject.classId,
        }
      });

      created++;
    }

    console.log(`\n✅ Done!`);
    console.log(`   Created: ${created} new catalog entries`);
    console.log(`   Skipped: ${skipped} (already existed)`);
    console.log(`\n🎉 Subject catalog is now ready. You can assign teachers to each subject via the dashboard.`);

  } catch (error) {
    console.error('❌ Error during sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncSubjectsToCatalog();
