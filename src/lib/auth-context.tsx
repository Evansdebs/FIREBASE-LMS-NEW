import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Role = 'super_admin' | 'teacher' | 'student';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  avatar?: string;
  student?: any;
  teacher?: any;
  className?: string; 
  permissions?: Record<string, boolean>;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; needsPassword?: boolean; mustChangePassword?: boolean; email?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default school code is no longer required as backend handles fallbacks

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ 
    user: null, 
    isAuthenticated: false,
    isLoading: true 
  });
  const BASE_URL = import.meta.env.VITE_API_URL || '';

  const normalizeUser = useCallback((user: any): User => {
    let parsedPermissions = {};
    if (user.permissions) {
      try {
        parsedPermissions = typeof user.permissions === 'string' 
          ? JSON.parse(user.permissions) 
          : user.permissions;
      } catch (e) {
        console.error('Failed to parse user permissions', e);
      }
    }

    return {
      ...user,
      fullName: user.fullName || user.name, 
      role: user.role.toLowerCase() as Role,
      className: user.student?.class?.name || undefined,
      permissions: parsedPermissions
    };
  }, []);

  const fetchUser = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const rawUser = await response.json();
        setState({ user: normalizeUser(rawUser), isAuthenticated: true, isLoading: false });
      } else {
        localStorage.removeItem('onereal_token');
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, [normalizeUser]);

  useEffect(() => {
    const token = localStorage.getItem('onereal_token');
    if (token) {
      fetchUser(token);
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [fetchUser]);

  const login = useCallback(async (email: string, password?: string) => {
    // If no password, we check if user exists and needs password (mocked original behavior)
    // In real API, we just try to login.
    if (!password) {
      // In this specific UI flow, users get a 'needsPassword' check before logging in.
      // We can mock this check or just assume it's true for everyone except students?
      // For now, let's just use the real login API if password is provided.
      return { success: false, needsPassword: true };
    }

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.mustChangePassword) {
          return { success: false, mustChangePassword: true, email: data.email };
        }
        localStorage.setItem('onereal_token', data.token);
        setState({ user: normalizeUser(data.user), isAuthenticated: true, isLoading: false });
        if (data.school?.primaryColor) {
          document.documentElement.style.setProperty('--primary', data.school.primaryColor);
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('onereal_token');
    if (token) {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('onereal_token');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  if (state.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-primary font-heading text-xl">Loading ONEREAL LMS...</div>
    </div>;
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
