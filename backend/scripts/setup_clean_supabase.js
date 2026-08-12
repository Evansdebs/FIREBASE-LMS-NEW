/**
 * CLEAN SUPABASE PROVISIONING SCRIPT — onereal_LMS_staging
 * ────────────────────────────────────────────────────────
 * Provisions a clean Supabase PostgreSQL database from scratch:
 * 1. Validates connection credentials for onereal_LMS_staging.
 * 2. Pushes 39 LMS models/tables via Prisma DDL.
 * 3. Applies supabase_migration.sql (RLS, RPCs, secure quiz functions, BECE aggregate).
 * 4. Seeds default Super Admin (admin@onereal.com / admin123) & system settings.
 *
 * Usage:
 *   node backend/scripts/setup_clean_supabase.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Load environment configuration
require('dotenv').config({ path: './backend/.env.migration' });
if (!process.env.SUPABASE_STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DATABASE_URL.includes('YOUR-STAGING')) {
  require('dotenv').config({ path: './backend/env.migration' });
}
if (!process.env.SUPABASE_STAGING_DATABASE_URL || process.env.SUPABASE_STAGING_DATABASE_URL.includes('YOUR-STAGING')) {
  require('dotenv').config({ path: './backend/.env' });
}

const dbUrl = process.env.SUPABASE_STAGING_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes('YOUR-STAGING') || dbUrl.includes('file:')) {
  console.error('❌ Error: Valid Supabase PostgreSQL database URL not configured.');
  console.error('   Please set SUPABASE_STAGING_DATABASE_URL in backend/env.migration or backend/.env.migration');
  console.error('   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
  process.exit(1);
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.password = '***REDACTED***';
    return parsed.toString();
  } catch {
    return '[REDACTED CONNECTION STRING]';
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ONEREAL LMS — Clean Supabase Provisioning');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Target DB : ${redactUrl(dbUrl)}`);
console.log(`  Mode      : Clean Setup (No legacy data migration)`);
console.log(`  Scope     : 39 Tables + RLS Security + RPC Functions + Seed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = dbUrl;

async function setup() {
  try {
    // 1. Prisma DB Push
    console.log('📦 Step 1: Pushing Prisma Schema DDL (39 tables)...');
    execSync('cmd /c npx prisma db push --skip-generate', {
      env: process.env,
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    console.log('✅ Schema push successful.\n');

    // 2. Apply Custom SQL Migration (RLS, RPCs, Security Functions)
    console.log('🔒 Step 2: Applying RLS Policies, RPC Functions & Security Extensions...');
    const sqlPath = path.resolve(__dirname, '../prisma/supabase_migration.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration SQL file not found at ${sqlPath}`);
    }

    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sqlContent);
    await client.end();
    console.log('✅ RLS Policies, RPC Functions, and Indexes applied successfully.\n');

    // 3. Seed Default System Admin & Settings
    console.log('🌱 Step 3: Seeding Super Admin & Base System Settings...');
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    await prisma.settings.upsert({
      where: { schoolCode: 'ONEREAL2026' },
      update: {},
      create: {
        schoolCode: 'ONEREAL2026',
        schoolName: 'ONEREAL Academy',
        academicYear: '2025-2026',
        term: 'First Term',
        primaryColor: '#6366f1',
        welcomeMessage: 'Welcome to ONEREAL LMS. Please configure your system in Admin Settings.',
      },
    });

    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@onereal.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@onereal.com',
        password: adminPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    await prisma.$disconnect();
    console.log('✅ Super Admin account created.');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Clean Supabase Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin Email    : admin@onereal.com');
    console.log('  Admin Password : admin123');
    console.log('  School Code    : ONEREAL2026');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

setup();
