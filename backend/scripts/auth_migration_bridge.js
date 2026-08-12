/**
 * ONEREAL LMS - Supabase Auth Migration & Synchronization Bridge
 * 
 * Safely provisions existing users into Supabase auth.users using official Supabase Auth Admin API
 * with existing bcrypt password_hash values.
 * 
 * Usage:
 *   node backend/scripts/auth_migration_bridge.js
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../src/config/prisma');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateAuthAccounts() {
  console.log('🚀 Starting Supabase Auth Migration via Admin SDK...');
  
  try {
    // 1. Fetch users from public.users missing auth_id
    const unlinkedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { auth_id: null },
          { auth_id: '' }
        ]
      }
    });

    console.log(`📊 Found ${unlinkedUsers.length} user accounts to synchronize with Supabase Auth.`);

    let successCount = 0;
    let failCount = 0;

    for (const user of unlinkedUsers) {
      try {
        console.log(`Processing: ${user.email} (ID: ${user.id}, Role: ${user.role})...`);

        // Check if auth user already exists by email
        const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers();
        const found = existingAuth?.users?.find(u => u.email.toLowerCase() === user.email.toLowerCase());

        let authId = null;

        if (found) {
          authId = found.id;
          console.log(`  └─ Auth user already exists in auth.users (UUID: ${authId}).`);
        } else {
          // Official Supabase Auth Admin SDK import using password_hash
          const { data: createdAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password_hash: user.password, // Existing bcrypt hash
            email_confirm: true,
            user_metadata: {
              name: user.name,
              role: user.role,
              permissions: user.permissions
            }
          });

          if (createError) {
            console.error(`  └─ ❌ Error provisioning ${user.email}:`, createError.message);
            failCount++;
            continue;
          }

          authId = createdAuth.user.id;
          console.log(`  └─ ✅ Provisioned in auth.users (UUID: ${authId}).`);
        }

        // Link UUID to public.users.auth_id
        await prisma.user.update({
          where: { id: user.id },
          data: { auth_id: authId }
        });

        successCount++;
      } catch (err) {
        console.error(`  └─ ❌ Failed to migrate user ${user.email}:`, err.message);
        failCount++;
      }
    }

    console.log('\n==================================================');
    console.log(`🎉 Auth Sync Complete!`);
    console.log(`  - Successfully Linked: ${successCount}`);
    console.log(`  - Failed / Skipped:    ${failCount}`);
    console.log('==================================================\n');
  } catch (globalErr) {
    console.error('❌ Auth migration script failed:', globalErr);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAuthAccounts();
