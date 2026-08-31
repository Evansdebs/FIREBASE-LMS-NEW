import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function seed() {
  console.log('🚀 Initializing Firebase for ONEREAL LMS...');
  console.log(`📦 Project ID: ${firebaseConfig.projectId}`);

  // 1. Initialize System Settings
  const settingsRef = doc(db, 'settings', 'system');
  await setDoc(settingsRef, {
    schoolCode: 'ONEREAL2026',
    schoolName: 'ONEREAL Academy',
    academicYear: '2025-2026',
    term: 'First Term',
    primaryColor: '#6366f1',
    secondaryColor: '#4f46e5',
    lockdownMode: false,
    allowRegistration: true,
    welcomeMessage: 'Welcome to ONEREAL LMS with Firebase.',
    passingGrade: 50,
    maxUploadSize: 10,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log('✅ System Settings initialized in Firestore (settings/system)');

  // 2. Initialize Default Super Admin User
  const adminEmail = 'admin@onereal.com';
  const adminPassword = 'admin123';
  let adminUid = null;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    adminUid = userCredential.user.uid;
    console.log(`✅ Super Admin created in Firebase Auth (UID: ${adminUid})`);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️ Admin user already exists in Firebase Auth, signing in to sync profile...');
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      adminUid = userCredential.user.uid;
    } else {
      console.error('❌ Error creating admin user in Firebase Auth:', error.message);
      throw error;
    }
  }

  if (adminUid) {
    await setDoc(doc(db, 'users', adminUid), {
      id: adminUid,
      email: adminEmail,
      name: 'Super Admin',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
      permissions: {
        all: true,
        canManageUsers: true,
        canManageAcademics: true,
        canManageSettings: true,
        canManageGrades: true,
        canManageMaterials: true,
      },
    }, { merge: true });
    console.log('✅ Super Admin profile saved to Firestore (users/' + adminUid + ')');
  }

  console.log('\n🎉 Firebase Seed Completed Successfully!');
  console.log('📋 Super Admin Credentials:');
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   School Code: ONEREAL2026\n`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
