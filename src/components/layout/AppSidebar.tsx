import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding-context';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Settings, LogOut, GraduationCap,
  Shield, ClipboardList, MessageSquare, BarChart3, Calendar, FileText,
  HelpCircle, FolderOpen, Megaphone, Trophy, ChevronDown, ChevronRight,
  StickyNote, ShoppingBag, FlaskConical, Sparkles, Video, Grid, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[];
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['super_admin', 'teacher', 'student'] },
      { icon: User, label: 'My Profile', path: '/dashboard/profile', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Megaphone, label: 'Announcements', path: '/dashboard/announcements', roles: ['super_admin', 'student'], permission: 'send_announcements' },
    ]
  },
  {
    label: 'Management',
    items: [
      { icon: Users, label: 'User Management', path: '/dashboard/users', roles: ['super_admin'], permission: 'manage_users' },
      { icon: BookOpen, label: 'Academic Setup', path: '/dashboard/academic', roles: ['super_admin'], permission: 'manage_academic' },
      { icon: Shield, label: 'Permissions', path: '/dashboard/permissions', roles: ['super_admin'], permission: 'manage_roles' },
    ]
  },
  {
    label: 'Academic',
    items: [
      { icon: BookOpen, label: 'Subjects', path: '/dashboard/courses', roles: ['super_admin', 'student'], permission: 'manage_courses' },
      { icon: LayoutDashboard, label: 'Subject Hub', path: '/dashboard/subject-hub', roles: ['teacher'] },
      { icon: BookOpen, label: 'My Subject', path: '/dashboard/my-subject', roles: ['teacher'] },
      { icon: ClipboardList, label: 'Assignments', path: '/dashboard/assignments', roles: ['teacher', 'student'], permission: 'approve_content' },
      { icon: HelpCircle, label: 'Quizzes', path: '/dashboard/quizzes', roles: ['super_admin', 'teacher', 'student'], permission: 'approve_content' },
      { icon: BarChart3, label: 'Gradebook', path: '/dashboard/gradebook', roles: ['super_admin', 'teacher'], permission: 'view_all_grades' },
      { icon: Calendar, label: 'Interactive Calendar', path: '/dashboard/calendar', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Grid, label: 'Weekly Timetable', path: '/dashboard/timetable', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Video, label: 'Live Classes', path: '/dashboard/live-classes', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Sparkles, label: 'Interactive Whiteboard', path: '/dashboard/whiteboard', roles: ['super_admin', 'teacher', 'student'] },
      { icon: FlaskConical, label: 'Virtual Study Room', path: '/dashboard/study-room', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Sparkles, label: 'AI Tutor', path: '/dashboard/ai-tutor', roles: ['super_admin', 'teacher', 'student'] },
    ]
  },
  {
    label: 'Resources',
    items: [
      { icon: FolderOpen, label: 'Resource Library', path: '/dashboard/resources', roles: ['super_admin', 'teacher', 'student'], permission: 'manage_resources' },
      { icon: StickyNote, label: 'My Notes', path: '/dashboard/notes', roles: ['super_admin', 'teacher', 'student'] },
      { icon: ShoppingBag, label: 'E-Store', path: '/dashboard/shop', roles: ['super_admin', 'teacher', 'student'] },
      { icon: FlaskConical, label: 'Simulation Lab', path: '/dashboard/simulations', roles: ['super_admin', 'teacher', 'student'] },
      { icon: Trophy, label: 'Participation', path: '/dashboard/participation', roles: ['student'] },
    ]
  },
  {
    label: 'Communication',
    items: [
      { icon: MessageSquare, label: 'Messages', path: '/dashboard/messages', roles: ['super_admin', 'teacher', 'student'] },
      { icon: MessageSquare, label: 'Forums', path: '/dashboard/forums', roles: ['super_admin', 'teacher', 'student'] },
    ]
  },
  {
    label: 'System',
    items: [
      { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics', roles: ['super_admin'], permission: 'view_analytics' },
      { icon: FileText, label: 'Audit Logs', path: '/dashboard/audit', roles: ['super_admin'], permission: 'view_audit_logs' },
      { icon: Settings, label: 'Settings', path: '/dashboard/settings', roles: ['super_admin'], permission: 'manage_settings' },
      { icon: MessageSquare, label: 'Contact Developer', path: '/dashboard/developer', roles: ['super_admin', 'teacher', 'student'] },
    ]
  },
];

export interface AppSidebarProps {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
  schoolName?: string;
  logo?: string;
}

export default function AppSidebar({ 
  collapsed = false, 
  mobileOpen = false,
  onClose,
  schoolName, 
  logo 
}: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { settings } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (!user) return null;

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const hasBaseRole = item.roles.includes(user.role);
      const hasPermission = item.permission && user.permissions?.[item.permission];
      return hasBaseRole || hasPermission;
    }),
  })).filter(group => group.items.length > 0);

  const roleLabel = user.role === 'super_admin' ? 'Super Admin' : user.role === 'teacher' ? 'Teacher' : 'Student';

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className={cn(
      "min-h-screen bg-sidebar flex flex-col border-r border-sidebar-border shrink-0 transition-all duration-300 z-50",
      "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl",
      collapsed ? "w-20" : "w-64",
      mobileOpen ? "translate-x-0" : "max-md:-translate-x-full"
    )}>
      {/* Header */}
      <div className={cn("p-5 border-b border-sidebar-border transition-all duration-300", collapsed && "px-4")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {logo ? <img src={logo} className="w-full h-full object-contain" /> : <GraduationCap className="w-5 h-5 text-sidebar-primary" />}
          </div>
          {!collapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h1 className="font-heading text-base font-bold text-sidebar-primary-foreground">{schoolName || 'OnerealEdu'}</h1>
              <span className="text-xs text-sidebar-foreground/60">{schoolName ? 'LMS Platform' : 'Intelligence System'}</span>
            </div>
          )}
        </div>
      </div>
      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden">
        {filteredGroups.map(group => {
          const isCollapsed = collapsedGroups[group.label];
          return (
            <div key={group.label} className="mb-2">
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-primary transition-all duration-300"
                >
                  {group.label}
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              ) : (
                <div className="border-t border-sidebar-border/10 my-2" />
              )}
              {(!isCollapsed || collapsed) && (
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map(item => {
                    const isActive = item.path === '/dashboard' 
                      ? location.pathname === '/dashboard' 
                      : location.pathname.startsWith(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          if (onClose) onClose();
                        }}
                        title={collapsed ? (
                          user.role === 'teacher' && item.label === 'Quizzes' ? 'Create Quiz' : 
                          user.role === 'teacher' && item.label === 'Gradebook' ? 'Grade Work' : 
                          item.label
                        ) : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                          collapsed ? "justify-center px-0" : "justify-start",
                          isActive
                            ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white dark:hover:text-white'
                        )}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-sidebar-primary")} />
                        {!collapsed && (
                          <span className="truncate animate-in fade-in slide-in-from-left-1 duration-300">
                            {user.role === 'teacher' && item.label === 'Quizzes' ? 'Create Quiz' : 
                             user.role === 'teacher' && item.label === 'Gradebook' ? 'Grade Work' : 
                             item.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Support desk panel for students and teachers */}
        {!collapsed && user.role !== 'super_admin' && settings && (settings.supportEmail || settings.supportPhone) && (
          <div className="mt-6 p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/10 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[10px] font-bold text-sidebar-primary uppercase tracking-wider">Support Desk</p>
            {settings.supportEmail && (
              <a 
                href={`mailto:${settings.supportEmail}`} 
                className="flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-sidebar-primary transition-colors truncate"
              >
                <span className="font-semibold text-sidebar-primary">✉</span> {settings.supportEmail}
              </a>
            )}
            {settings.supportPhone && (
              <a 
                href={`tel:${settings.supportPhone}`} 
                className="flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-sidebar-primary transition-colors truncate"
              >
                <span className="font-semibold text-sidebar-primary">📞</span> {settings.supportPhone}
              </a>
            )}
          </div>
        )}

        {/* User profile integrated at the end of nav */}
        <div className={cn("mt-6 pt-4 border-t border-sidebar-border/10", collapsed && "mt-4")}>
          <div 
            onClick={() => navigate('/dashboard/profile')}
            className={cn("flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer group", collapsed && "justify-center")}
            title="View & manage my profile"
          >
            <div className="w-9 h-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-semibold text-sm shrink-0 overflow-hidden border border-sidebar-border/30">
              {user.avatar ? (
                <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                user.fullName.charAt(0)
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-1 duration-300">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate group-hover:text-sidebar-primary transition-colors">{user.fullName}</p>
                <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider font-bold">{roleLabel}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={(e) => { e.stopPropagation(); logout(); navigate('/'); }}
                className="p-2 rounded-md text-sidebar-foreground/60 hover:text-white hover:bg-destructive transition-all duration-300 ml-auto"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full flex justify-center p-2.5 mt-2 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}
