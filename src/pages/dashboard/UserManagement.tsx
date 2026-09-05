import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAllUsers, createUser, updateUser, deleteUserProfile, toggleUserActive } from '@/lib/services/userService';
import { getClasses } from '@/lib/services/academicService';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Search, Plus, MoreVertical, UserCheck, UserX, Edit, Trash2, Loader2, Eye, EyeOff, RefreshCw, User as UserIcon, Download, AlertCircle
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BulkUploadModal } from '@/components/admin/BulkUploadModal';

function ResetPasswordForm({ user, onClose }: { user: any; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
    if (score <= 3) return { score, label: 'Medium', color: 'bg-orange-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' };
    return { score, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Password reset is handled by Firebase — flag the user to change password on next login
      await updateUser(user.id, { mustChangePassword: true });
      toast.success('User flagged to change password on next login.');
      onClose();
      toast.success('Password reset successfully. User will be forced to change it.');
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs leading-relaxed text-warning-foreground">
        Resetting <strong>{user.name}</strong>'s password. They will be required to change it on their next login.
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>New Password</Label>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/5"
            onClick={() => {
              const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
              const pass = Array.from({length: 12}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
              setPassword(pass);
              setShowPassword(true);
            }}
          >
            <RefreshCw className="w-3 h-3" /> Generate
          </Button>
        </div>
        <div className="relative">
          <Input 
            type={showPassword ? 'text' : 'password'} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            className="pr-10"
            placeholder="Min 8 characters recommended..."
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        
        {password && (
          <div className="space-y-1.5 mt-1.5">
            <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wider">
              <span className="text-muted-foreground">Strength:</span>
              <span className={cn(
                strength.label === 'Weak' ? 'text-destructive' :
                strength.label === 'Medium' ? 'text-orange-500' :
                strength.label === 'Strong' ? 'text-green-500' : 'text-emerald-500'
              )}>
                {strength.label}
              </span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-300", strength.color)} 
                style={{ width: `${(strength.score / 5) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading || !password}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign New Password'}
        </Button>
      </div>
    </form>
  );
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [showReset, setShowReset] = useState(false);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [classes, setClasses] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUsers();
    getClasses().then(setClasses).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus = statusFilter === 'all' || (u.isActive ? 'active' : 'inactive') === statusFilter;
    const matchClass = classFilter === 'all' || (u.role === 'STUDENT' && u.student?.class?.id?.toString() === classFilter);
    return matchSearch && matchRole && matchStatus && matchClass;
  });

  const handleExport = async () => {
    try {
      setExporting(true);
      const { utils, writeFile } = await import('xlsx');
      const exportData = filtered.map(u => ({
        Name: u.name || u.fullName,
        Email: u.email,
        Role: u.role,
        Status: u.isActive !== false ? 'Active' : 'Inactive',
        Class: u.className || '',
        Gender: u.gender || '',
        'Created At': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
      }));
      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Users');
      writeFile(wb, `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Users exported successfully!');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleUserActive(id, !currentStatus);
      toast.success('User status updated');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteUserProfile(id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUserToDelete(null);
    }
  };

  const roleBadge = (role: string) => {
    const r = role.toLowerCase();
    const styles: any = {
      super_admin: 'bg-primary/10 text-primary border-primary/20',
      admin: 'bg-primary/10 text-primary border-primary/20',
      teacher: 'bg-info/10 text-info border-info/20',
      student: 'bg-accent/10 text-accent border-accent/20',
    };
    const labels: any = { super_admin: 'Admin', admin: 'Admin', teacher: 'Teacher', student: 'Student' };
    return <Badge variant="outline" className={cn('font-medium', styles[r])}>{labels[r] || role}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{users.length} total users</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm order-first sm:order-last">
                <Plus className="w-4 h-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Create New User</DialogTitle></DialogHeader>
              <CreateUserForm onClose={() => setShowCreate(false)} onRefresh={fetchUsers} existingUsers={users} />
            </DialogContent>
          </Dialog>

          <BulkUploadModal onComplete={fetchUsers} />

          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Filter by Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Username</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Class</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Last Login</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-mono">{u.email.split('@')[0]}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.role === 'STUDENT' ? (u.student?.class?.name || '-') : '-'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('font-medium', u.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20')}>
                      {u.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.lastLogin || 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => { setActiveUser(u); setShowView(true); }}>
                          <UserIcon className="w-3.5 h-3.5" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => { setActiveUser(u); setShowEdit(true); }}>
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => toggleStatus(u.id, u.isActive)}>
                          {u.isActive ? <><UserX className="w-3.5 h-3.5" /> Disable</> : <><UserCheck className="w-3.5 h-3.5" /> Enable</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-warning" onClick={() => { setActiveUser(u); setShowReset(true); }}>
                          <RefreshCw className="w-3.5 h-3.5" /> Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setUserToDelete(u)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Edit User</DialogTitle></DialogHeader>
          {activeUser && <EditUserForm user={activeUser} onClose={() => { setShowEdit(false); setActiveUser(null); }} onRefresh={fetchUsers} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Reset User Password</DialogTitle></DialogHeader>
          {activeUser && <ResetPasswordForm user={activeUser} onClose={() => { setShowReset(false); setActiveUser(null); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">User Profile</DialogTitle></DialogHeader>
          {activeUser && <ViewUserProfileModal userId={activeUser.id} onClose={() => { setShowView(false); setActiveUser(null); }} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for <strong>{userToDelete?.name}</strong>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteUser(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateUserForm({ onClose, onRefresh, existingUsers }: { onClose: () => void; onRefresh: () => void; existingUsers?: any[] }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', classId: '', gender: '' });
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if the typed email is already registered in the system
  const isEmailDuplicate = (emailToCheck: string) => {
    const clean = emailToCheck.trim().toLowerCase();
    if (!clean) return false;
    return (existingUsers || []).some(
      u => (u.email || '').trim().toLowerCase() === clean
    );
  };

  const isDuplicate = isEmailDuplicate(form.email);

  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
    if (score <= 3) return { score, label: 'Medium', color: 'bg-orange-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' };
    return { score, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(form.password);

  useEffect(() => {
    getClasses().then(setClasses).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = form.email.trim().toLowerCase();

    // Check if email already in system and prompt admin
    if (isEmailDuplicate(cleanEmail)) {
      toast.error(`The email "${cleanEmail}" is already in the system. Please choose a different email before continuing.`);
      return;
    }

    try {
      setLoading(true);
      await createUser({ 
        ...form, 
        email: cleanEmail,
        role: form.role.toUpperCase() as any, 
        mustChangePassword: true 
      });
      toast.success('User created successfully');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kwame Mensah" required />
      </div>
      <div className="space-y-2">
        <Label>Email *</Label>
        <Input 
          type="email" 
          value={form.email} 
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
          placeholder="student@school.edu"
          required 
          className={cn(isDuplicate && "border-destructive focus-visible:ring-destructive")}
        />
        {/* Real-time duplicate prompt */}
        {isDuplicate && (
          <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Email already in system</p>
              <p className="mt-0.5">
                This email address is already registered in the LMS. Please choose a different email before continuing.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Default Password *</Label>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/5"
            onClick={() => {
              const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
              const pass = Array.from({length: 12}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
              setForm(p => ({ ...p, password: pass }));
              setShowPassword(true);
            }}
          >
            <RefreshCw className="w-3 h-3" /> Generate
          </Button>
        </div>
        <div className="relative">
          <Input 
            type={showPassword ? 'text' : 'password'} 
            value={form.password} 
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} 
            required 
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {form.password && (
          <div className="space-y-1.5 mt-1.5">
            <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wider">
              <span className="text-muted-foreground">Strength:</span>
              <span className={cn(
                strength.label === 'Weak' ? 'text-destructive' :
                strength.label === 'Medium' ? 'text-orange-500' :
                strength.label === 'Strong' ? 'text-green-500' : 'text-emerald-500'
              )}>
                {strength.label}
              </span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-300", strength.color)} 
                style={{ width: `${(strength.score / 5) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="super_admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.role === 'student' && (
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Gender</Label>
        <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
          <SelectTrigger><SelectValue placeholder="Select gender (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading || isDuplicate}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
        </Button>
      </div>
    </form>
  );
}

function EditUserForm({ user, onClose, onRefresh }: { user: any; onClose: () => void; onRefresh: () => void }) {
  const [form, setForm] = useState({ 
    name: user.name, 
    email: user.email, 
    role: user.role.toLowerCase(),
    classId: user.student?.classId?.toString() || 'unassigned',
    gender: user.gender || ''
  });
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.role === 'student') {
       getClasses().then(setClasses).catch(() => {});
    }
  }, [form.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = { 
        ...form, 
        role: (user.role || form.role).toUpperCase() as any,
        classId: form.classId === 'unassigned' ? '' : form.classId 
      };
      await updateUser(user.id, { ...payload });
      toast.success('User updated successfully');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))} disabled>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="super_admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">Role changes require explicit data migration. Email updates are allowed.</p>
      </div>

      {form.role === 'student' && (
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">None</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Gender</Label>
        <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
          <SelectTrigger><SelectValue placeholder="Select gender (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

function ViewUserProfileModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/lib/services/userService').then(m => m.getUserById(String(userId)))
      .then(setDetails)
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!details) return <div className="py-4 text-center text-muted-foreground">User not found</div>;

  const getSubjectsForStudent = () => {
    if (!details.student?.class?.subjects) return [];
    return details.student.class.subjects;
  };

  const getSubjectsForTeacher = () => {
    if (!details.teacher?.courseTeachers) return [];
    return details.teacher.courseTeachers.map((ct: any) => ct.course);
  };

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-2xl">
          {details.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading">{details.name}</h2>
          <p className="text-sm text-muted-foreground">{details.email}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <Badge variant="outline" className={cn('uppercase font-bold', details.role === 'SUPER_ADMIN' || details.role === 'ADMIN' ? 'bg-primary/10 text-primary border-primary/20' : details.role === 'TEACHER' ? 'bg-info/10 text-info border-info/20' : 'bg-accent/10 text-accent border-accent/20')}>{details.role}</Badge>
          <Badge variant="outline" className={details.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>{details.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         <Card className="shadow-none border-border">
           <CardContent className="p-4 flex justify-between items-center">
             <p className="text-sm font-medium text-muted-foreground">Joined At</p>
             <p className="font-heading font-medium">{new Date(details.createdAt).toLocaleDateString()}</p>
           </CardContent>
         </Card>
      </div>

      {details.role === 'STUDENT' && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-lg border-b pb-2">Academic Profile</h3>
          <div>
             <p className="text-sm font-medium text-muted-foreground">Assigned Class</p>
             <div className="mt-2 p-3 bg-accent/5 border border-accent/10 rounded-lg flex items-center justify-between">
                <span className="font-heading font-bold text-lg">{details.student?.class?.name || 'No class assigned'}</span>
             </div>
          </div>

          <div className="pt-2">
             <p className="text-sm font-medium text-muted-foreground mb-2">Enrolled Subjects</p>
             <div className="space-y-2">
               {getSubjectsForStudent().length > 0 ? getSubjectsForStudent().map((subject: any, i: number) => (
                 <div key={i} className="px-3 py-2 border rounded border-border text-sm flex justify-between">
                   <span className="font-medium">{subject.name}</span>
                 </div>
               )) : <p className="text-xs text-muted-foreground italic">No subjects currently assigned to this class.</p>}
             </div>
          </div>
        </div>
      )}

      {details.role === 'TEACHER' && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-lg border-b pb-2">Teaching Profile</h3>
          <div>
             <p className="text-sm font-medium text-muted-foreground mb-2">Taught Subjects</p>
             <div className="space-y-2">
               {getSubjectsForTeacher().length > 0 ? getSubjectsForTeacher().map((course: any, i: number) => (
                 <div key={i} className="px-3 py-2 border rounded border-border text-sm flex justify-between items-center gap-4">
                   <span className="font-medium">{course.title}</span>
                   <div className="text-xs text-muted-foreground flex items-center gap-2">
                     {course.courseClasses && course.courseClasses.length > 0 && (
                       <Badge variant="outline" className="bg-accent/10">
                         {course.courseClasses.map((cc: any) => cc.class.name).join(', ')}
                       </Badge>
                     )}
                     {course.subject && <Badge variant="secondary">{course.subject.name}</Badge>}
                   </div>
                 </div>
               )) : <p className="text-xs text-muted-foreground italic">Teacher has not been assigned to any subjects yet.</p>}
             </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={onClose} variant="outline">Close Profile</Button>
      </div>
    </div>
  );
}
