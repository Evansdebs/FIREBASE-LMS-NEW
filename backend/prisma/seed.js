const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ONEREAL LMS for Production...');

  // ─── Settings ───────────────────────────────────────────
  // Default system settings for first launch
  const settings = await prisma.settings.upsert({
    where: { schoolCode: 'ONEREAL2026' },
    update: {},
    create: {
      schoolCode: 'ONEREAL2026',
      schoolName: 'ONEREAL Academy',
      academicYear: '2025-2026',
      term: 'First Term',
      primaryColor: '#6366f1',
      welcomeMessage: 'Welcome to ONEREAL LMS. Please configure your system in the Admin Settings.',
    },
  });
  console.log('✅ Base settings initialized');

  // ─── Super Admin ────────────────────────────────────────
  // The primary account required to manage the system
  const adminPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@onereal.com' },
    update: {},
    create: { 
      name: 'Super Admin', 
      email: 'admin@onereal.com', 
      password: adminPassword, 
      role: 'SUPER_ADMIN' 
    },
  });
  console.log('✅ Super Admin account created');

  console.log('\n🎉 Production Seeding Complete!');
  console.log('\n📋 Initial Credentials:');
  console.log('   Admin:   admin@onereal.com / admin123');
  console.log('   School Code: ONEREAL2026');
  console.log('\n⚠️  IMPORTANT: Please change the default admin password immediately after first login.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
