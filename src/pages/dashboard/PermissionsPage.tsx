import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, CheckCircle, Loader2, Search, Settings2, Save } from 'lucide-react';
import { getAllUsers, updateUserPermissions } from '@/lib/services/userService';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const PERMISSION_GROUPS = [
  {
    title: 'System Administration',
    permissions: [
      { id: 'manage_settings', label: 'Manage Settings', description: 'Configure global styling and preferences' },
      { id: 'manage_roles', label: 'Manage Roles', description: 'Access to the Permissions Page itself' },
      { id: 'view_audit_logs', label: 'View Audit Logs', description: 'Access system Audit Logs' },
    ]
  },
  {
    title: 'User & Academic Operations',
    permissions: [
      { id: 'manage_users', label: 'Manage Users', description: 'Create, edit, and disable users' },
      { id: 'manage_academic', label: 'Manage Academic Setup', description: 'Create and configure Subjects and Classes' },
    ]
  },
  {
    title: 'Course & Content Control',
    permissions: [
      { id: 'manage_courses', label: 'Manage Global Courses', description: 'Create and assign global Courses' },
      { id: 'manage_resources', label: 'Manage Resources', description: 'Upload/edit items in Global Resource Library' },
      { id: 'approve_content', label: 'Approve Content', description: 'Moderate quizzes and assignments' },
    ]
  },
  {
    title: 'Data & Communications',
    permissions: [
      { id: 'send_announcements', label: 'Send Announcements', description: 'Post system-wide announcements' },
      { id: 'create_forum', label: 'Create Forum Categories & Topics', description: 'Allow creating new forum categories and starting discussion topics' },
      { id: 'view_analytics', label: 'View Analytics', description: 'Access global Analytics dashboard' },
      { id: 'view_all_grades', label: 'View All Grades', description: 'Access the Global Gradebook' },
    ]
  }
];

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Sheet state
  const [activeUser, setActiveUser] = useState<any | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getAllUsers();
      setUsers(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPermissions = (user: any) => {
    setActiveUser(user);
    if (!user.permissions) {
      setUserPermissions({});
      return;
    }

    try {
      // Robust parsing: handles already-parsed objects or double-stringified JSON
      const parsed = typeof user.permissions === 'string' 
        ? JSON.parse(user.permissions) 
        : user.permissions;
      
      // Ensure we have a valid object
      setUserPermissions(typeof parsed === 'object' && parsed !== null ? parsed : {});
    } catch (e) {
      console.error('Error parsing user permissions:', e);
      setUserPermissions({});
    }
  };

  const togglePermission = (id: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSavePermissions = async () => {
    if (!activeUser) return;
    try {
      setSaving(true);
      await updateUserPermissions(activeUser.id, userPermissions);
      toast.success('Permissions updated successfully!');
      
      // Update local state to reflect changes instantly
      setUsers(users.map(u => 
        u.id === activeUser.id 
          ? { ...u, permissions: userPermissions } 
          : u
      ));
      setActiveUser(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Show all users: super_admin, teacher, student
  const filtered = users.filter(u => {
    const name = (u.name || u.fullName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    const r = (u.role || '').toLowerCase();
    const matchRole = roleFilter === 'all' || 
      (roleFilter === 'super_admin' && r.includes('admin')) ||
      (roleFilter === 'teacher' && r.includes('teacher')) ||
      (roleFilter === 'student' && r.includes('student'));
    return matchSearch && matchRole;
  });

  const getRoleBadge = (rawRole: string) => {
    const r = (rawRole || '').toLowerCase();
    if (r.includes('admin')) {
      return <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20">Admin</Badge>;
    }
    if (r.includes('teacher')) {
      return <Badge variant="outline" className="font-semibold bg-info/10 text-info border-info/20">Teacher</Badge>;
    }
    return <Badge variant="outline" className="font-semibold bg-muted text-muted-foreground border-border">Student</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="text-muted-foreground mt-1">Manage fine-grained access control and module permissions for all accounts.</p>
      </div>

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search any user by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users ({users.length})</SelectItem>
                <SelectItem value="super_admin">Admins</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="student">Students</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Custom Access</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const r = (u.role || '').toLowerCase();
                  const isSuperAdmin = r.includes('admin');
                  const isTeacher = r.includes('teacher');
                  
                  // Parse permissions to check if any exist
                  let hasCustom = false;
                  try {
                    const p = typeof u.permissions === 'string' 
                      ? JSON.parse(u.permissions || '{}') 
                      : (u.permissions || {});
                    hasCustom = Object.values(p).some(Boolean);
                  } catch (e) {}

                  return (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs", 
                            isSuperAdmin ? "bg-primary/10 text-primary" : isTeacher ? "bg-info/10 text-info" : "bg-muted text-muted-foreground")}>
                            {(u.name || u.fullName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{u.name || u.fullName || 'User'}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-primary" /> Full Access Built-in
                          </span>
                        ) : hasCustom ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">Custom Granted</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Standard Role Only</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleOpenPermissions(u)}
                        >
                          <Settings2 className="w-4 h-4" /> Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No staff members found matching criteria</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Permissions Sliding Panel */}
      <Sheet open={!!activeUser} onOpenChange={(open) => !open && setActiveUser(null)}>
        <SheetContent className="sm:max-w-md p-0 flex flex-col h-full border-l border-border">
          <div className="p-6 border-b border-border bg-muted/20">
            <SheetHeader>
              <SheetTitle className="font-heading">Manage Access</SheetTitle>
              <SheetDescription>
                Configure fine-grained permissions for this user.
              </SheetDescription>
            </SheetHeader>
            {activeUser && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {activeUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{activeUser.name}</p>
                  <p className="text-xs text-muted-foreground">{activeUser.role === 'SUPER_ADMIN' ? 'Admin' : 'Teacher'}</p>
                </div>
              </div>
            )}
          </div>
          
          <ScrollArea className="flex-1 p-6">
            {activeUser?.role === 'SUPER_ADMIN' && (
              <div className="mb-6 p-4 border border-primary/30 bg-primary/5 rounded-xl flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Super Admin Detected</h4>
                  <p className="text-xs text-muted-foreground mt-1">This user is a Super Admin and implicitly has access to all system features. Toggling individual permissions below won't restrict their built-in access.</p>
                </div>
              </div>
            )}

            <div className="space-y-6 pb-6">
              {PERMISSION_GROUPS.map((group, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground font-heading border-b border-border pb-2">{group.title}</h3>
                  <div className="space-y-4">
                    {group.permissions.map(perm => (
                      <div key={perm.id} className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-sm hover:border-primary/30 transition-colors">
                        <div className="space-y-0.5 mr-4">
                          <Label htmlFor={perm.id} className="text-sm font-medium cursor-pointer">
                            {perm.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        </div>
                        <Switch
                          id={perm.id}
                          checked={!!userPermissions[perm.id]}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-background flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setActiveUser(null)}>
              Cancel
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSavePermissions} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
