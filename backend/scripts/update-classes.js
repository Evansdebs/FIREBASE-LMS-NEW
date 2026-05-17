// update-classes.js — Sync the standard school class levels into the DB
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REQUIRED_CLASSES = [
  'CRECHE', 'NURSERY1', 'NURSERY2', 'KG1', 'KG2',
  'BASIC1', 'BASIC2', 'BASIC3', 'BASIC4', 'BASIC5',
  'BASIC6', 'BASIC7', 'BASIC8', 'BASIC9'
];

async function main() {
  // Fetch existing classes
  const existing = await prisma.class.findMany({ select: { id: true, name: true } });
  const existingNames = existing.map(c => c.name.toUpperCase());

  console.log('Existing classes:', existingNames);

  // Insert missing classes
  let added = 0;
  for (const className of REQUIRED_CLASSES) {
    if (!existingNames.includes(className.toUpperCase())) {
      await prisma.class.create({ data: { name: className, description: `${className} class level` } });
      console.log(`✅ Created class: ${className}`);
      added++;
    } else {
      console.log(`⏭️  Skipping existing class: ${className}`);
    }
  }

  console.log(`\nDone. Added ${added} new class(es).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
