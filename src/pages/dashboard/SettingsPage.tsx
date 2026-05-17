import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, Shield, Settings2, BookOpen, Database, Loader2, Palette, Globe, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingLockdown, setPendingLockdown] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/admin/settings');
      setSettings(res);
    } catch (err: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/api/admin/backups');
      setBackups(res);
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  const handleSave = async (section: string, passwordOverride?: string, settingsOverride?: any) => {
    try {
      setSaving(true);
      const payload = { ...(settingsOverride || settings) };
      if (passwordOverride) {
        payload.adminPassword = passwordOverride;
      }
      await api.put('/api/admin/settings', payload);
      toast.success(`${section} settings updated successfully.`);
      if (passwordOverride) {
        setAdminPassword('');
        setShowPasswordDialog(false);
        setPendingLockdown(null);
      }
      // Re-fetch to ensure sync
      await fetchSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
      // Always re-fetch settings on error to revert optimistic or failed states
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your LMS platform ({settings.schoolCode})</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" /> General</TabsTrigger>
          <TabsTrigger value="academic" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Academic</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5 text-accent"><Palette className="w-3.5 h-3.5" /> Appearance & Branding</TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5"><Database className="w-3.5 h-3.5" /> System / Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="border-border">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-heading text-lg font-semibold text-card-foreground">General Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input value={settings.schoolName || ''} onChange={e => setSettings({...settings, schoolName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={settings.primaryColor || '#6366f1'} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={settings.primaryColor || '#6366f1'} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="w-32 uppercase font-mono" />
                  </div>
                </div>
              </div>
              <h3 className="font-heading text-lg font-semibold text-card-foreground mt-8">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input type="email" value={settings.supportEmail || ''} onChange={e => setSettings({...settings, supportEmail: e.target.value})} placeholder="support@school.edu" />
                </div>
                <div className="space-y-2">
                  <Label>Support Phone</Label>
                  <Input type="tel" value={settings.supportPhone || ''} onChange={e => setSettings({...settings, supportPhone: e.target.value})} placeholder="+233 55 000 0000" />
                </div>
              </div>
              <div className="space-y-2 mt-6">
                <Label>Welcome Message</Label>
                <Textarea value={settings.welcomeMessage || ''} onChange={e => setSettings({...settings, welcomeMessage: e.target.value})} placeholder="Message shown on login screen..." />
              </div>
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => handleSave('General')} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card className="border-border">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-heading text-lg font-semibold text-card-foreground">Academic Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Current Academic Session</Label>
                  <Input value={settings.academicYear || ''} onChange={e => setSettings({...settings, academicYear: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Current Term</Label>
                  <Select value={settings.term} onValueChange={v => setSettings({...settings, term: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Term">First Term</SelectItem>
                      <SelectItem value="Second Term">Second Term</SelectItem>
                      <SelectItem value="Third Term">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h3 className="font-heading text-lg font-semibold text-card-foreground mt-8 border-t border-border pt-6">Grading Defaults</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Passing Grade (%)</Label>
                  <Input type="number" min="0" max="100" value={settings.passingGrade || 50} onChange={e => setSettings({...settings, passingGrade: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Grading System</Label>
                  <Select value={settings.gradingSystem || 'PERCENTAGE'} onValueChange={v => setSettings({...settings, gradingSystem: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (0-100%)</SelectItem>
                      <SelectItem value="LETTER">Letter Grades (A, B, C)</SelectItem>
                      <SelectItem value="GPA">GPA Scale (4.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button className="gap-2" onClick={() => handleSave('Academic')} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="border-border shadow-md">
            <CardContent className="p-6 space-y-8">
              <div>
                <h3 className="font-heading text-lg font-semibold text-card-foreground flex items-center gap-2">
                   <Palette className="w-5 h-5 text-accent" /> Identity & Theme
                </h3>
                <p className="text-xs text-muted-foreground">Customize how the LMS looks to students and teachers.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">School Brand Name</Label>
                    <Input value={settings.schoolName || ''} onChange={e => setSettings({...settings, schoolName: e.target.value})} placeholder="e.g. Royal Academy" />
                    <p className="text-[10px] text-muted-foreground italic">This name appears in the sidebar and navigation headers.</p>
                  </div>
                  
                  <div className="space-y-4 pt-4">
                    <Label className="text-sm font-bold block mb-3">Brand Colors</Label>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-3 rounded-xl border border-border space-y-2">
                          <Label className="text-xs">Primary Color</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={settings.primaryColor || '#6366f1'} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="w-8 h-8 rounded border-none cursor-pointer" />
                            <Input value={settings.primaryColor} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="h-8 text-[10px] font-mono" />
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: settings.primaryColor }} />
                       </div>
                       <div className="p-3 rounded-xl border border-border space-y-2">
                          <Label className="text-xs">Secondary (Accent)</Label>
                          <div className="flex items-center gap-2">
                             <input type="color" value={settings.secondaryColor || '#f59e0b'} onChange={e => setSettings({...settings, secondaryColor: e.target.value})} className="w-8 h-8 rounded border-none cursor-pointer" />
                             <Input value={settings.secondaryColor} onChange={e => setSettings({...settings, secondaryColor: e.target.value})} className="h-8 text-[10px] font-mono" />
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: settings.secondaryColor }} />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Public/Login Logo URL</Label>
                    <div className="flex gap-2">
                       <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                          {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <Globe className="w-6 h-6 opacity-20" />}
                       </div>
                       <Input value={settings.logo || ''} onChange={e => setSettings({...settings, logo: e.target.value})} placeholder="https://path-to-logo.png" className="flex-1" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Recommended size: 200x200px. Supports PNG/SVG.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/40 border border-border mt-4">
                     <p className="text-xs font-bold text-card-foreground mb-1 flex items-center gap-1.5">
                       <Loader2 className="w-3 h-3 text-primary" /> Live Preview
                     </p>
                     <p className="text-[10px] text-muted-foreground mb-3">This is how your primary buttons will look:</p>
                     <div className="flex gap-2">
                        <Button size="sm" style={{ backgroundColor: settings.primaryColor }} className="text-[10px] h-7 px-4">Sample Primary</Button>
                        <Button size="sm" variant="outline" style={{ borderColor: settings.primaryColor, color: settings.primaryColor }} className="text-[10px] h-7 px-4">Outline Sample</Button>
                     </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-border mt-8">
                <Button className="gap-2 px-8 shadow-lg shadow-primary/20" onClick={() => handleSave('Appearance')} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Apply Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <div className="space-y-4">
            <Card className="border-border">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                   <Shield className="text-destructive w-5 h-5"/>
                   <h3 className="font-heading text-lg font-semibold text-card-foreground">System Control</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Maintenance (Lockdown) Mode</p>
                      <p className="text-xs text-muted-foreground">Disable access for all non-admin users instantly.</p>
                    </div>
                    <Switch 
                      checked={settings.lockdownMode} 
                      onCheckedChange={v => {
                        if (v !== settings.lockdownMode) {
                          setPendingLockdown(v);
                          setShowPasswordDialog(true);
                        }
                      }} 
                      className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-primary" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div>
                        <p className="text-sm font-medium text-card-foreground">Allow New Teacher Registrations</p>
                        <p className="text-xs text-muted-foreground">Enable the public registration form on the login screen.</p>
                    </div>
                    <Switch checked={settings.allowRegistration} onCheckedChange={v => setSettings({...settings, allowRegistration: v})} className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-primary" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div>
                        <p className="text-sm font-medium text-card-foreground">Enable Direct Messaging</p>
                        <p className="text-xs text-muted-foreground">Allow students and teachers to use the internal 1-to-1 chat system.</p>
                    </div>
                    <Switch checked={settings.enableMessaging ?? true} onCheckedChange={v => setSettings({...settings, enableMessaging: v})} className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-primary" />
                  </div>
                </div>

                <h3 className="font-heading text-lg font-semibold text-card-foreground mt-8 border-t border-border pt-6">System Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <Label>Maximum Upload Size (MB)</Label>
                    <Input type="number" min="1" max="100" value={settings.maxUploadSize || 5} onChange={e => setSettings({...settings, maxUploadSize: parseInt(e.target.value)})} />
                    <p className="text-xs text-muted-foreground mt-1">Global file size limit for assignments and resources.</p>
                  </div>
                </div>
                <div className="mt-8 border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading text-lg font-semibold text-card-foreground">System Backups & Archives</h3>
                    <div className="flex gap-2">
                      <input type="file" id="backup-upload" accept=".tar.gz" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!window.confirm("WARNING: Uploading a backup will instantly overwrite your live database and uploads! \n\nContinue?")) {
                          e.target.value = '';
                          return;
                        }
                        try {
                          toast.loading("Uploading and Restoring...", { id: 'upload-restore' });
                          const formData = new FormData();
                          formData.append('backup', file);
                          await api.post('/api/admin/backups/upload-restore', formData);
                          toast.success("Restore completed! Forcing refresh...", { id: 'upload-restore' });
                          setTimeout(() => window.location.reload(), 2000);
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || "Failed to restore from upload", { id: 'upload-restore' });
                        }
                        e.target.value = '';
                      }} />
                      <Button variant="outline" className="gap-2" onClick={() => document.getElementById('backup-upload')?.click()}>
                        <Database className="w-4 h-4" /> Restore from Device
                      </Button>
                      <Button variant="outline" className="gap-2 border-primary/50 text-foreground" onClick={async () => {
                        try {
                          toast.loading('Generating hybrid backup archive...', { id: 'backup' });
                          await api.post('/api/admin/backups', {});
                          toast.success('Backup generated & archived', { id: 'backup' });
                          fetchBackups();
                        } catch (err) {
                          toast.error('Failed to generate backup', { id: 'backup' });
                        }
                      }}>
                        <Save className="w-4 h-4" /> Create New Archive
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {backups.map((b, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border bg-card">
                        <div>
                          <p className="font-medium text-sm text-card-foreground">{b.filename}</p>
                          <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()} · {(b.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <div className="flex gap-2">
                           <Button size="sm" variant="outline" onClick={async () => {
                             try {
                               toast.loading("Downloading securely...", { id: 'dl' });
                               const res = await api.get(`/api/admin/backups/${b.filename}`, { responseType: 'blob' });
                               const url = window.URL.createObjectURL(new Blob([res as any], { type: 'application/gzip' }));
                               const a = document.createElement('a'); a.href = url; a.download = b.filename;
                               document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
                               toast.success("Download started", { id: 'dl' });
                             } catch(err) { toast.error("Failed to download", { id: 'dl' }); }
                           }}>Download File</Button>
                           <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={async () => {
                             if (!window.confirm("Delete this archive forever?")) return;
                             try {
                               await api.delete(`/api/admin/backups/${b.filename}`);
                               toast.success("Archive deleted");
                               fetchBackups();
                             } catch(err) { toast.error("Failed to delete archive"); }
                           }}>Delete</Button>
                           <Button size="sm" variant="destructive" onClick={async () => {
                             if (!window.confirm("WARNING: Restoring this archive will INSTANTLY OVERWRITE your live database and uploads directory. Any data created since this backup will be permanently lost! \n\nContinue with Restore?")) return;
                             try {
                               toast.loading("Restoring backup... System going offline temporarily.", { id: 'restore' });
                               await api.post(`/api/admin/backups/${b.filename}/restore`, {});
                               toast.success("Restore completed! Forcing refresh...", { id: 'restore' });
                               setTimeout(() => window.location.reload(), 2000);
                             } catch(err) { toast.error("Failed to restore backup", { id: 'restore' }); }
                           }}>Restore</Button>
                        </div>
                      </div>
                    ))}
                    {backups.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">No archives found. Max 5 backups allowed.</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-border pt-6">
                  <Button className="gap-2" variant="destructive" onClick={() => handleSave('System')} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Submit Security Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
      </Tabs>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {pendingLockdown ? 'Activate' : 'Deactivate'} Maintenance Mode
            </DialogTitle>
            <DialogDescription>
              {pendingLockdown 
                ? 'Activating maintenance mode will instantly log out all students and teachers. Only Super Admins will be able to access the system.' 
                : 'Deactivating maintenance mode will allow students and teachers to access the system again.'}
              <br /><br />
              Please enter the <strong>Maintenance Password</strong> to confirm:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="admin-password">Password</Label>
            <Input 
              id="admin-password"
              type="password" 
              placeholder="Enter maintenance password..." 
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && adminPassword) {
                  const newSettings = {...settings, lockdownMode: pendingLockdown};
                  handleSave('System', adminPassword, newSettings);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPasswordDialog(false);
              setAdminPassword('');
              setPendingLockdown(null);
            }}>Cancel</Button>
            <Button 
              variant="destructive" 
              disabled={!adminPassword || saving}
              onClick={() => {
                const newSettings = {...settings, lockdownMode: pendingLockdown};
                handleSave('System', adminPassword, newSettings);
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm {pendingLockdown ? 'Lockdown' : 'Deactivation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
