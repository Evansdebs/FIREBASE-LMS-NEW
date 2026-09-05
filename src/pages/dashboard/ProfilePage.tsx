import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getUserById, updateUserAvatar, updateUser, UserProfile } from '@/lib/services/userService';
import { getCourses, Course } from '@/lib/services/academicService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  User, Camera, Trash2, Shield, BookOpen, GraduationCap, 
  Lock, CheckCircle2, Calendar, Award, Phone, Mail, 
  Users, Layers, Loader2, Sparkles, AlertCircle, Edit2, Save, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, updateCurrentUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Admin-only editable state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    gender: '',
  });
  const [savingAdmin, setSavingAdmin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (user?.id) {
      loadProfileData(String(user.id));
    }
  }, [user?.id]);

  const loadProfileData = async (uid: string) => {
    try {
      setLoading(true);
      const [fetchedProfile, allCourses] = await Promise.all([
        getUserById(uid),
        getCourses().catch(() => [] as Course[])
      ]);

      if (fetchedProfile) {
        setProfile(fetchedProfile);
        setEditForm({
          name: fetchedProfile.name || fetchedProfile.fullName || '',
          gender: fetchedProfile.gender || '',
        });
      }
      setCourses(allCourses || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile details';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Profile Picture Upload Handler (Max 5MB)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Strict 5MB limit validation as specified
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Image size exceeds 5MB limit. Please choose a photo under 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WEBP).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const toastId = toast.loading('Uploading profile picture...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const uid = String(user.id);

        // Update in Firestore
        await updateUserAvatar(uid, base64Data);

        // Update in Auth state so navbar & sidebar update instantly
        if (updateCurrentUserProfile) {
          await updateCurrentUserProfile({ avatar: base64Data });
        }

        setProfile(prev => prev ? { ...prev, avatar: base64Data } : prev);
        toast.success('Profile picture updated successfully!', { id: toastId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save profile picture';
        toast.error(msg, { id: toastId });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read image file from device', { id: toastId });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsDataURL(file);
  };

  // Profile Picture Removal Handler
  const handlePhotoRemove = async () => {
    if (!user?.id) return;
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

    setUploading(true);
    const toastId = toast.loading('Removing profile picture...');
    try {
      const uid = String(user.id);
      await updateUserAvatar(uid, null);

      if (updateCurrentUserProfile) {
        await updateCurrentUserProfile({ avatar: undefined });
      }

      setProfile(prev => prev ? { ...prev, avatar: undefined } : prev);
      toast.success('Profile picture removed successfully.', { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove profile picture';
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Admin Self-Update Handler
  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user?.id) return;

    setSavingAdmin(true);
    const toastId = toast.loading('Saving profile changes...');
    try {
      const uid = String(user.id);
      await updateUser(uid, {
        name: editForm.name.trim(),
        fullName: editForm.name.trim(),
        gender: editForm.gender || undefined,
      });

      if (updateCurrentUserProfile) {
        await updateCurrentUserProfile({ fullName: editForm.name.trim() });
      }

      setProfile(prev => prev ? { 
        ...prev, 
        name: editForm.name.trim(), 
        fullName: editForm.name.trim(),
        gender: editForm.gender || undefined
      } : prev);

      setIsEditing(false);
      toast.success('Profile details updated successfully!', { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      toast.error(msg, { id: toastId });
    } finally {
      setSavingAdmin(false);
    }
  };

  // Compute teaching or student subjects
  const enrolledCourses = courses.filter(c => {
    if (profile?.role === 'TEACHER') {
      return String(c.teacherId) === String(user?.id);
    }
    if (profile?.role === 'STUDENT' && profile?.className) {
      return c.className?.toLowerCase() === profile.className.toLowerCase();
    }
    return false;
  });

  const displayAvatar = profile?.avatar || user?.avatar;
  const displayName = profile?.name || profile?.fullName || user?.fullName || 'User';
  const roleTitle = profile?.role === 'SUPER_ADMIN' ? 'System Administrator' 
    : profile?.role === 'TEACHER' ? 'Faculty Teacher' 
    : 'Enrolled Student';

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-indigo-700 text-white shadow-lg p-6 sm:p-8">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with live upload & remove controls */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-white/30 overflow-hidden bg-white/20 shadow-2xl flex items-center justify-center relative">
              {displayAvatar ? (
                <img 
                  src={displayAvatar} 
                  alt={displayName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white/15 text-white">
                  <span className="text-4xl font-bold font-heading">{displayName.charAt(0).toUpperCase()}</span>
                  <span className="text-[10px] font-medium opacity-80 mt-1">No photo</span>
                </div>
              )}

              {/* Hover overlay for instant camera action */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold cursor-pointer"
                title="Upload profile picture (Max 5MB)"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span>{displayAvatar ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
            </div>

            {/* Hidden file input with strict 5MB limitation */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoUpload} 
            />

            {/* Status dot */}
            <div className="absolute bottom-1 right-2 w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center shadow" title="Account Active">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* User Headline & Action Buttons */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-none font-semibold text-xs px-2.5 py-0.5">
                {roleTitle}
              </Badge>
              {profile?.className && (
                <Badge variant="outline" className="border-white/30 text-white text-xs px-2.5 py-0.5">
                  Class: {profile.className}
                </Badge>
              )}
              {profile?.points !== undefined && profile.points > 0 && (
                <Badge variant="secondary" className="bg-amber-400/20 text-amber-200 border-none text-xs flex items-center gap-1">
                  <Award className="w-3 h-3" /> {profile.points} XP
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight truncate">
              {displayName}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span>{profile?.email || user?.email}</span>
            </p>

            {/* Photo Action Row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4 pt-3 border-t border-white/15">
              <Button 
                type="button" 
                size="sm" 
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {displayAvatar ? 'Change Photo (Max 5MB)' : 'Upload Photo (Max 5MB)'}
              </Button>

              {displayAvatar && (
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  disabled={uploading}
                  onClick={handlePhotoRemove}
                  className="h-8 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Photo
                </Button>
              )}

              {isAdmin && !isEditing && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="h-8 text-xs font-semibold bg-white/10 border-white/30 text-white hover:bg-white/20 gap-1.5 ml-auto"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Details
                </Button>
              )}
            </div>
            <p className="text-[10px] text-white/70 mt-1.5">
              Profile pictures are visible across forums, study rooms, chats, and assignments. (Max 5MB, JPG/PNG/WEBP).
            </p>
          </div>
        </div>
      </div>

      {/* Permissions / Read-Only Notice Bar */}
      {!isAdmin ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card/60 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-card-foreground">Profile Information Is Secured & Managed by School Admin</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Apart from updating your profile picture above, all personal and academic details (including your legal name, assigned class, subjects, and contact information) are locked to maintain school record integrity. If you notice an error, please reach out to your school administrator to request an update.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">Super Administrator Privileges</p>
              <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">Full Control</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You are logged in as a System Administrator. You can update your own details here, configure global system settings, and manage student and teacher records across the entire platform.
            </p>
          </div>
        </div>
      )}

      {/* Admin Edit Modal / Card (Only when Admin is editing their own details) */}
      {isAdmin && isEditing && (
        <Card className="border-primary/40 shadow-md animate-in fade-in duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-primary" /> Edit Administrator Profile
                </CardTitle>
                <CardDescription className="text-xs">Update your administrative name and personal settings.</CardDescription>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Full Display Name *</Label>
                  <Input 
                    value={editForm.name} 
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    required 
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gender</Label>
                  <select 
                    value={editForm.gender} 
                    onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Not Specified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={savingAdmin} className="gap-1.5">
                  {savingAdmin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal & Account Information */}
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Personal & Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Full Name</span>
              <span className="font-semibold text-foreground">{displayName}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Email Address</span>
              <span className="font-mono text-foreground">{profile?.email || user?.email}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">System Portal Role</span>
              <Badge variant="outline" className="font-bold text-[10px] uppercase">
                {profile?.role || user?.role}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Gender</span>
              <span className="font-medium text-foreground">{profile?.gender || 'Not specified'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Account Status</span>
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active & Verified
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Account User ID</span>
              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]" title={profile?.id}>
                {profile?.id}
              </span>
            </div>

            {profile?.createdAt && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Registered Since
                </span>
                <span className="text-muted-foreground">
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academic / Role Specific Details Card */}
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> Academic & Department Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            {profile?.role === 'STUDENT' ? (
              <>
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-medium">Enrolled Class / Grade</span>
                  <Badge variant="secondary" className="font-bold text-xs bg-primary/10 text-primary">
                    {profile.className || 'Class Unassigned'}
                  </Badge>
                </div>

                <div className="py-2 border-b border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" /> Enrolled Subjects
                    </span>
                    <span className="text-[10px] text-muted-foreground">{enrolledCourses.length} subjects</span>
                  </div>
                  {enrolledCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {enrolledCourses.map(c => (
                        <Badge key={c.id} variant="outline" className="text-[10px] bg-muted/40 font-medium">
                          {c.title || c.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-[11px]">Subjects will appear as courses are assigned to your class.</p>
                  )}
                </div>

                {/* Guardian Details */}
                <div className="py-2 border-b border-border/40 space-y-2">
                  <p className="font-bold text-card-foreground text-[11px] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> Parent / Guardian Record
                  </p>
                  <div className="bg-muted/30 p-2.5 rounded-lg border border-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Guardian Name:</span>
                      <span className="font-semibold text-foreground">{profile.parentName || 'Not recorded'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Guardian Phone:</span>
                      <span className="font-mono text-foreground">{profile.parentPhone || 'Not recorded'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Guardian Email:</span>
                      <span className="font-mono text-foreground">{profile.parentEmail || 'Not recorded'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> Participation Score
                  </span>
                  <span className="font-bold text-amber-600 text-sm">{profile.points || 0} Points</span>
                </div>
              </>
            ) : profile?.role === 'TEACHER' ? (
              <>
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-medium">Department / Faculty</span>
                  <span className="font-semibold text-foreground">Academic Teaching Staff</span>
                </div>

                <div className="py-2 border-b border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" /> Assigned Teaching Subjects
                    </span>
                    <span className="text-[10px] text-muted-foreground">{enrolledCourses.length} assigned</span>
                  </div>
                  {enrolledCourses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {enrolledCourses.map(c => (
                        <Badge key={c.id} variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary">
                          {c.title || c.name} {c.className ? `(${c.className})` : ''}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-[11px]">
                      {profile.subjects ? profile.subjects : 'No subjects assigned yet. Admin can assign courses via Courses page.'}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-medium">Assigned Form Class</span>
                  <span className="font-medium text-foreground">{profile.className || 'None'}</span>
                </div>

                <div className="p-3 bg-muted/40 rounded-xl border border-border text-[11px] text-muted-foreground leading-relaxed">
                  Teachers have grading, quiz creation, live class, and forum management permissions for all assigned students and courses.
                </div>
              </>
            ) : (
              /* Admin Profile Details */
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground font-medium">System Access</span>
                  <Badge variant="default" className="text-[10px] font-bold">Unrestricted Super Admin</Badge>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-semibold text-foreground text-xs">Administrative Quick Controls</p>
                  <p className="text-muted-foreground text-[11px]">
                    Manage users, define academic sessions, configure permissions, and customize institutional branding.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                      <Link to="/dashboard/users">Manage Users</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                      <Link to="/dashboard/settings">System Settings</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                      <Link to="/dashboard/permissions">Permissions</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
