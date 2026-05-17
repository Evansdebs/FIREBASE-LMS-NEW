const { PrismaClient } = require('@prisma/client');

/**
 * Migration script to port existing single-assignment courses 
 * (course.classId, course.teacherId) into the new many-to-many
 * CourseClass and CourseTeacher join tables.
 * 
 * Run AFTER the Prisma migration has been applied.
 */
async function migrate() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting graceful data migration...');

    // Get all existing courses with their classId and teacherId
    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, "classId", "teacherId" FROM courses`
    );

    console.log(`Found ${courses.length} course(s) to migrate.`);

    for (const course of courses) {
      // Port classId -> CourseClass join table
      if (course.classId) {
        try {
          await prisma.courseClass.create({
            data: {
              courseId: course.id,
              classId: course.classId,
            },
          });
          console.log(`  Course ${course.id}: Linked to class ${course.classId}`);
        } catch (err) {
          if (err.code === 'P2002') {
            console.log(`  Course ${course.id}: Already linked to class ${course.classId} (skipped)`);
          } else {
            console.error(`  Course ${course.id}: Error linking class -`, err.message);
          }
        }
      }

      // Port teacherId -> CourseTeacher join table
      if (course.teacherId) {
        try {
          await prisma.courseTeacher.create({
            data: {
              courseId: course.id,
              teacherId: course.teacherId,
            },
          });
          console.log(`  Course ${course.id}: Linked to teacher ${course.teacherId}`);
        } catch (err) {
          if (err.code === 'P2002') {
            console.log(`  Course ${course.id}: Already linked to teacher ${course.teacherId} (skipped)`);
          } else {
            console.error(`  Course ${course.id}: Error linking teacher -`, err.message);
          }
        }
      }
    }

    console.log('\\nGraceful data migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
