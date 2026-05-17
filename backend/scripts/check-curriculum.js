const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const subjects = await p.subject.count();
  const courses  = await p.course.count();
  const classes  = await p.class.count();
  console.log(`Classes : ${classes}`);
  console.log(`Subjects: ${subjects}`);
  console.log(`Courses : ${courses}`);
  
  // Sample: list Math courses to confirm bulk upload will find them
  const mathCourses = await p.course.findMany({
    where: { title: 'Mathematics' },
    include: { subject: { include: { class: { select: { name: true } } } } }
  });
  console.log('\nMathematics courses found:');
  mathCourses.forEach(c => console.log(`  → id:${c.id} | Class: ${c.subject.class.name}`));
}
main().catch(console.error).finally(() => p.$disconnect());
