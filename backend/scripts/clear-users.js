const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const res = await prisma.user.deleteMany({
      where: { role: { not: 'SUPER_ADMIN' } }
    });
    console.log(`Successfully deleted ${res.count} non-admin users and all their associated cascade data.`);
  } catch (err) {
    console.error('Error deleting users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
