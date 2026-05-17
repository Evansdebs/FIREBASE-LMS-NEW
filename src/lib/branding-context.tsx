import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from './api';

interface Settings {
  schoolName: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  lockdownMode: boolean;
  welcomeMessage?: string;
  [key: string]: any;
}

interface BrandingContextType {
  settings: Settings | null;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ws = useRef<WebSocket | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await api.get('/api/admin/settings/public');
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch public settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncStyles = (s: Settings) => {
    if (s.primaryColor) {
      document.documentElement.style.setProperty('--primary', s.primaryColor);
    }
    if (s.secondaryColor) {
      document.documentElement.style.setProperty('--accent', s.secondaryColor);
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
    fetchSettings();

    // Establish WebSocket connection for real-time synchronization
    const apiBase = import.meta.env.VITE_API_URL || '';
    let wsUrl = '';
    if (apiBase) {
      wsUrl = apiBase.replace(/^http/, 'ws') + '/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }
    const token = localStorage.getItem('onereal_token');
    
    ws.current = new WebSocket(`${wsUrl}${token ? `?token=${token}` : ''}`);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SETTINGS_UPDATED') {
          console.log('Branding sync: settings updated across devices', data.payload);
          setSettings(data.payload);
        }
      } catch (e) {
        // Ignore non-JSON or other message types
      }
    };

    ws.current.onclose = () => {
      // Simple reconnection logic could go here if needed
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    if (settings) {
      syncStyles(settings);
    }
  }, [settings]);

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
