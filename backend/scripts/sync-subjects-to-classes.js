const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sync() {
  console.log('--- Starting Subject-to-Class Synchronization ---');

  const [classes, courses] = await Promise.all([
    prisma.class.findMany(),
    prisma.course.findMany({
      include: { courseClasses: true }
    })
  ]);

  console.log(`Found ${classes.length} classes and ${courses.length} courses.`);

  let updatedCount = 0;

  for (const course of courses) {
    const textToScan = `${course.title} ${course.description || ''}`.toUpperCase();
    const matchedClassIds = [];

    for (const cls of classes) {
      const clsName = cls.name.toUpperCase();
      // Match specifically as a word to avoid partial matches (e.g., "BASIC" matching "BASIC1")
      const regex = new RegExp(`\\b${clsName}\\b`, 'i');
      if (regex.test(textToScan)) {
        matchedClassIds.push(cls.id);
      }
    }

    if (matchedClassIds.length > 0) {
      console.log(`Course "${course.title}" matches classes: ${matchedClassIds.join(', ')}`);
      
      // Replace strategy: delete existing and create new
      await prisma.$transaction([
        prisma.courseClass.deleteMany({
          where: { courseId: course.id }
        }),
        ...matchedClassIds.map(cId => 
          prisma.courseClass.create({
            data: { courseId: course.id, classId: cId }
          })
        )
      ]);
      
      updatedCount++;
    } else {
      console.log(`Course "${course.title}" - no class matches found in description.`);
    }
  }

  console.log(`\n--- Synchronization Complete ---`);
  console.log(`Updated ${updatedCount} courses.`);
  
  process.exit(0);
}

sync().catch(err => {
  console.error('Sync Error:', err);
  process.exit(1);
});
