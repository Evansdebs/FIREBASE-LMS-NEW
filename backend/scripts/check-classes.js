const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.class.findMany({ select: { name: true }, orderBy: { id: 'asc' } })
  .then(r => console.log('Classes in DB:', r.map(c => c.name).join(', ')))
  .catch(console.error)
  .finally(() => p.$disconnect());
