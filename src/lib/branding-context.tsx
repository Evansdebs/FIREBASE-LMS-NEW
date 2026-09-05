import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { api } from './api';

interface Settings {
  schoolName: string;
  logo?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  textColorLight?: string;
  textColorDark?: string;
  lockdownMode?: boolean;
  welcomeMessage?: string;
  schoolCode?: string;
  [key: string]: any;
}

interface BrandingContextType {
  settings: Settings | null;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

const DEFAULT_SETTINGS: Settings = {
  schoolCode: 'ONEREAL2026',
  schoolName: 'ONEREAL Academy',
  primaryColor: '#6366f1',
  secondaryColor: '#4f46e5',
  textColorLight: '#0f172a',
  textColorDark: '#f8fafc',
  lockdownMode: false,
  welcomeMessage: 'Welcome to ONEREAL LMS',
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const syncStyles = (s: Settings) => {
    if (s.primaryColor) {
      document.documentElement.style.setProperty('--primary', s.primaryColor);
    }
    if (s.secondaryColor) {
      document.documentElement.style.setProperty('--accent', s.secondaryColor);
    }
    if (s.textColorLight && !document.documentElement.classList.contains('dark')) {
      document.documentElement.style.setProperty('--foreground', s.textColorLight);
    }
    if (s.textColorDark && document.documentElement.classList.contains('dark')) {
      document.documentElement.style.setProperty('--foreground', s.textColorDark);
    }
    
    // Sync document title
    if (s.schoolName) {
      document.title = `${s.schoolName} | Elevate Your Intelligence`;
    }
    
    // Sync favicon
    if (s.logo) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = s.logo;
      }
    }
  };

  useEffect(() => {
    if (isFirebaseConfigured()) {
      // Real-time listener directly from Firestore
      const unsubscribe = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Settings;
          setSettings(data);
          syncStyles(data);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setIsLoading(false);
      }, (error) => {
        console.warn('Firestore branding listener error, using defaults:', error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Fallback to REST API if Firebase is not configured
      api.get('/api/admin/settings/public')
        .then((data) => {
          setSettings(data);
          if (data) syncStyles(data);
        })
        .catch(() => setSettings(DEFAULT_SETTINGS))
        .finally(() => setIsLoading(false));
    }
  }, []);

  return (
    <BrandingContext.Provider value={{ settings, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
