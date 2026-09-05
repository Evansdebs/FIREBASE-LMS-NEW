import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

export type Role = 'super_admin' | 'teacher' | 'student';

export interface User {
  id: string | number;
  fullName: string;
  email: string;
  role: Role;
  avatar?: string;
  student?: any;
  teacher?: any;
  className?: string;
  classId?: string;
  permissions?: Record<string, boolean>;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; needsPassword?: boolean; mustChangePassword?: boolean; email?: string }>;
  logout: () => void;
  updateCurrentUserProfile?: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ 
    user: null, 
    isAuthenticated: false, 
    isLoading: true 
  });

  const normalizeFirestoreUser = (data: any, uid: string, email: string): User => {
    let parsedPermissions = data.permissions || {};
    if (typeof parsedPermissions === 'string') {
      try {
        parsedPermissions = JSON.parse(parsedPermissions);
      } catch (e) {
        parsedPermissions = {};
      }
    }

    const rawRole = (data.role || 'STUDENT').toLowerCase();
    let role: Role = 'student';
    if (rawRole.includes('admin')) role = 'super_admin';
    else if (rawRole.includes('teacher')) role = 'teacher';

    return {
      id: uid,
      email: data.email || email,
      fullName: data.fullName || data.name || (data.email ? data.email.split('@')[0] : 'User'),
      role,
      avatar: data.avatar || undefined,
      student: data.student || undefined,
      teacher: data.teacher || undefined,
      classId: data.classId || data.student?.classId || data.student?.class?.id || undefined,
      className: data.className || data.student?.class?.name || data.student?.className || undefined,
      permissions: parsedPermissions,
      mustChangePassword: Boolean(data.mustChangePassword)
    };
  };

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const normalized = normalizeFirestoreUser(userData, fbUser.uid, fbUser.email || '');
            setState({ user: normalized, isAuthenticated: true, isLoading: false });
          } else {
            // Brief pause and re-check to avoid overwriting newly created profiles
            await new Promise(res => setTimeout(res, 500));
            const recheckSnap = await getDoc(userDocRef);
            if (recheckSnap.exists()) {
              const userData = recheckSnap.data();
              const normalized = normalizeFirestoreUser(userData, fbUser.uid, fbUser.email || '');
              setState({ user: normalized, isAuthenticated: true, isLoading: false });
              return;
            }

            // Profile doc doesn't exist yet, create baseline
            const baselineData = {
              id: fbUser.uid,
              email: fbUser.email || '',
              name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
              role: 'STUDENT',
              isActive: true,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, baselineData);
            const normalized = normalizeFirestoreUser(baselineData, fbUser.uid, fbUser.email || '');
            setState({ user: normalized, isAuthenticated: true, isLoading: false });
          }
        } catch (error) {
          console.error('Error fetching Firestore user:', error);
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    if (!password) {
      return { success: false, needsPassword: true };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const normalized = normalizeFirestoreUser(userData, uid, email);
        setState({ user: normalized, isAuthenticated: true, isLoading: false });

        if (userData.mustChangePassword) {
          return { success: false, mustChangePassword: true, email };
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Firebase Login error:', error);
      let errorMsg = 'Failed to sign in. Please check your credentials.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Access temporarily disabled due to many failed attempts. Try again later.';
      }
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('onereal_token');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const updateCurrentUserProfile = useCallback(async (data: Partial<User>) => {
    if (!state.user?.id) return;
    const uid = String(state.user.id);
    const userDocRef = doc(db, 'users', uid);
    
    const updatePayload: Record<string, unknown> = {};
    if ('avatar' in data) updatePayload.avatar = data.avatar || null;
    if (data.fullName !== undefined) {
      updatePayload.fullName = data.fullName;
      updatePayload.name = data.fullName;
    }
    if (data.className !== undefined) updatePayload.className = data.className;
    updatePayload.updatedAt = new Date().toISOString();

    const clean = Object.fromEntries(
      Object.entries(updatePayload).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(userDocRef, clean);

    setState(prev => prev.user ? {
      ...prev,
      user: {
        ...prev.user,
        ...data,
      }
    } : prev);
  }, [state.user?.id]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateCurrentUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
