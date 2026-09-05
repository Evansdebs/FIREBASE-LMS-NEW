import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding-context';
import { Navigate, Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import NotificationBell from './NotificationBell';
import { ModeToggle } from './ModeToggle';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, ChevronLeft, GraduationCap } from 'lucide-react';

export default function DashboardLayout() {
  const { isAuthenticated, user } = useAuth();
  const { settings } = useBranding();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Dynamic Style Injection */}
      {settings && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${settings.primaryColor || '#6366f1'};
            --primary-foreground: 210 40% 98%;
            --accent: ${settings.secondaryColor || '#f59e0b'};
            --accent-foreground: 210 40% 98%;
          }
          .text-primary { color: ${settings.primaryColor} !important; }
          .bg-primary { background-color: ${settings.primaryColor} !important; }
          .border-primary { border-color: ${settings.primaryColor} !important; }
        `}} />
      )}
      {/* Backdrop for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <AppSidebar 
        collapsed={isMobile ? false : isSidebarCollapsed} 
        mobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        schoolName={settings?.schoolName} 
        logo={settings?.logo} 
      />
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden transition-all duration-300">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-3 sm:px-6 bg-card shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (isMobile) {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                } else {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }
              }}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            >
              {isMobile 
                ? <Menu className="w-5 h-5" /> 
                : (isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />)
              }
            </Button>
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 truncate">
              <h1 className="font-heading text-sm sm:text-base font-bold text-foreground truncate">
                {settings?.schoolName || 'Onereal LMS'}
              </h1>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">{settings?.schoolName ? 'LMS Platform' : 'Intelligence System'}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 bg-muted/30 px-6 py-1.5 rounded-full border border-border/50 shadow-sm animate-in fade-in duration-500 mx-2">
             <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-foreground">
                   {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                   Current Date
                </span>
             </div>
             <div className="w-[1px] h-6 bg-border" />
             <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-primary tabular-nums">
                   {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                   Live Time
                </span>
             </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ModeToggle />
            <NotificationBell />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {settings?.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <GraduationCap className="w-5 h-5 text-primary" />}
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs sm:text-sm ml-1">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full">
          <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
