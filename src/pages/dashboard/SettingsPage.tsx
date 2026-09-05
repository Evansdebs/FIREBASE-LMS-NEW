import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, Shield, Settings2, BookOpen, Database, Loader2, Palette, Globe, AlertTriangle, Download, Upload, Cloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  getSettings, updateSettings, 
  generateBackupData, restoreFromBackupData, 
  createCloudBackup, getCloudBackups, 
  deleteCloudBackup, restoreCloudBackup, BackupMetadata 
} from '@/lib/services/settingsService';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingLockdown, setPendingLockdown] = useState<boolean | null>(null);
  const [logoMode, setLogoMode] = useState<'url' | 'file'>('url');

  useEffect(() => {
    fetchSettings();
    fetchBackups();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await getSettings();
      setSettings(res);
    } catch (err: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const cloudList = await getCloudBackups();
      setBackups(cloudList);
    } catch (err: any) {
      console.error('Failed to load cloud backups:', err);
    }
  };

  const handleSave = async (section: string, passwordOverride?: string, settingsOverride?: any) => {
    try {
      setSaving(true);
      const payload = { ...(settingsOverride || settings) };
      if (passwordOverride) {
        payload.adminPassword = passwordOverride;
      }
      await updateSettings(payload);
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
                    <Label className="text-sm font-bold block mb-3">Brand & Global Theme Colors</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="p-3 rounded-xl border border-border space-y-2 bg-card/60">
                          <Label className="text-xs font-semibold">Primary Theme Color</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={settings.primaryColor || '#6366f1'} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="w-8 h-8 rounded border-none cursor-pointer shrink-0" />
                            <Input value={settings.primaryColor || '#6366f1'} onChange={e => setSettings({...settings, primaryColor: e.target.value})} className="h-8 text-xs font-mono uppercase" />
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: settings.primaryColor || '#6366f1' }} />
                       </div>
                       <div className="p-3 rounded-xl border border-border space-y-2 bg-card/60">
                          <Label className="text-xs font-semibold">Secondary Accent Color</Label>
                          <div className="flex items-center gap-2">
                              <input type="color" value={settings.secondaryColor || '#f59e0b'} onChange={e => setSettings({...settings, secondaryColor: e.target.value})} className="w-8 h-8 rounded border-none cursor-pointer shrink-0" />
                              <Input value={settings.secondaryColor || '#f59e0b'} onChange={e => setSettings({...settings, secondaryColor: e.target.value})} className="h-8 text-xs font-mono uppercase" />
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: settings.secondaryColor || '#f59e0b' }} />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                       <div className="p-3 rounded-xl border border-border space-y-2 bg-card/60">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Global Text (Light Theme)</Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 text-[10px] text-muted-foreground px-1"
                              onClick={() => setSettings({ ...settings, textColorLight: '#0f172a' })}
                            >
                              Reset Default
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={settings.textColorLight || '#0f172a'} 
                              onChange={e => setSettings({...settings, textColorLight: e.target.value})} 
                              className="w-8 h-8 rounded border-none cursor-pointer shrink-0" 
                            />
                            <Input 
                              value={settings.textColorLight || '#0f172a'} 
                              onChange={e => setSettings({...settings, textColorLight: e.target.value})} 
                              className="h-8 text-xs font-mono uppercase" 
                            />
                          </div>
                          <div className="p-2 rounded bg-slate-100 border border-slate-200 mt-2">
                            <span className="text-xs font-medium" style={{ color: settings.textColorLight || '#0f172a' }}>
                              Light mode sample text
                            </span>
                          </div>
                       </div>

                       <div className="p-3 rounded-xl border border-border space-y-2 bg-card/60">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Global Text (Dark Theme)</Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 text-[10px] text-muted-foreground px-1"
                              onClick={() => setSettings({ ...settings, textColorDark: '#f8fafc' })}
                            >
                              Reset Default
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={settings.textColorDark || '#f8fafc'} 
                              onChange={e => setSettings({...settings, textColorDark: e.target.value})} 
                              className="w-8 h-8 rounded border-none cursor-pointer shrink-0" 
                            />
                            <Input 
                              value={settings.textColorDark || '#f8fafc'} 
                              onChange={e => setSettings({...settings, textColorDark: e.target.value})} 
                              className="h-8 text-xs font-mono uppercase" 
                            />
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800 mt-2">
                            <span className="text-xs font-medium" style={{ color: settings.textColorDark || '#f8fafc' }}>
                              Dark mode sample text
                            </span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">School Branding Logo</Label>
                    
                    <div className="flex items-center gap-1.5 mb-3 bg-muted p-0.5 rounded-lg w-fit border border-border">
                      <button
                        type="button"
                        onClick={() => setLogoMode('url')}
                        className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${logoMode === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Image URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoMode('file')}
                        className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${logoMode === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Local PC Upload
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                       <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                          {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <Globe className="w-6 h-6 opacity-20" />}
                       </div>
                       
                       {logoMode === 'url' ? (
                         <Input 
                           value={settings.logo || ''} 
                           onChange={e => setSettings({...settings, logo: e.target.value})} 
                           placeholder="https://example.com/logo.png" 
                           className="flex-1 text-xs" 
                         />
                       ) : (
                         <Input 
                           type="file" 
                           accept="image/*" 
                           className="flex-1 text-xs cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" 
                           onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if (!file) return;
                             const uploadToast = toast.loading('Uploading logo to system server...');
                             try {
                               const formData = new FormData();
                               formData.append('logo', file);
                               const response = await api.post('/api/admin/settings/upload-logo', formData);
                               setSettings({ ...settings, logo: response.logo });
                               toast.success('Branding logo uploaded successfully!', { id: uploadToast });
                             } catch (err: any) {
                               toast.error(err.response?.data?.error || 'Failed to upload logo', { id: uploadToast });
                             }
                           }} 
                         />
                       )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Recommended format: Square SVG or PNG with transparent background.</p>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-card-foreground">System Backups & Archives</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Generate live cloud snapshots or export/restore local JSON backup files.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Local File Download */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 font-semibold text-xs border-primary/30 text-primary hover:bg-primary/10"
                        onClick={async () => {
                          try {
                            toast.loading('Generating local database snapshot...', { id: 'dl-backup' });
                            const { meta, data } = await generateBackupData();
                            const jsonStr = JSON.stringify({ meta, data }, null, 2);
                            const blob = new Blob([jsonStr], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            const dateStr = new Date().toISOString().slice(0, 10);
                            a.href = url;
                            a.download = `onereal_lms_backup_${dateStr}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            toast.success(`Exported ${meta.totalRecords} records across all collections!`, { id: 'dl-backup' });
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to generate local backup', { id: 'dl-backup' });
                          }
                        }}
                      >
                        <Download className="w-3.5 h-3.5" /> Download Local Backup
                      </Button>

                      {/* Local File Upload Restore */}
                      <input 
                        type="file" 
                        id="backup-upload" 
                        accept=".json" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!window.confirm("WARNING: Uploading a backup will restore and merge all records into your live Firestore database!\n\nDo you want to proceed?")) {
                            e.target.value = '';
                            return;
                          }
                          try {
                            toast.loading("Validating and restoring database from file...", { id: 'upload-restore' });
                            const text = await file.text();
                            const parsed = JSON.parse(text);
                            const res = await restoreFromBackupData(parsed);
                            toast.success(`Successfully restored ${res.restored} records! Reloading...`, { id: 'upload-restore' });
                            setTimeout(() => window.location.reload(), 1500);
                          } catch (err: any) {
                            toast.error(err.message || "Failed to restore from upload", { id: 'upload-restore' });
                          }
                          e.target.value = '';
                        }} 
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 font-semibold text-xs" 
                        onClick={() => document.getElementById('backup-upload')?.click()}
                      >
                        <Upload className="w-3.5 h-3.5" /> Restore from Device
                      </Button>

                      {/* Cloud Snapshot Creation */}
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-1.5 font-semibold text-xs shadow-md shadow-primary/20" 
                        onClick={async () => {
                          try {
                            toast.loading('Saving cloud snapshot to Firestore...', { id: 'cloud-backup' });
                            const created = await createCloudBackup();
                            toast.success(`Cloud snapshot created (${created.totalRecords} records)!`, { id: 'cloud-backup' });
                            fetchBackups();
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to create cloud backup', { id: 'cloud-backup' });
                          }
                        }}
                      >
                        <Cloud className="w-3.5 h-3.5" /> Create Cloud Snapshot
                      </Button>
                    </div>
                  </div>

                  {/* Cloud backups list */}
                  <div className="space-y-3 mt-4">
                    {backups.map((b, i) => (
                      <div key={b.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border bg-card/60 gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Cloud className="w-4 h-4 text-primary shrink-0" />
                            <p className="font-semibold text-sm text-card-foreground truncate">{b.filename}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Cloud Snapshot</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(b.createdAt).toLocaleString()} · {b.totalRecords} records · {(b.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs gap-1"
                            onClick={() => {
                              try {
                                const jsonStr = JSON.stringify(b.snapshotData || b, null, 2);
                                const blob = new Blob([jsonStr], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = b.filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                toast.success("Downloaded snapshot file");
                              } catch(err) {
                                toast.error("Failed to download");
                              }
                            }}
                          >
                            <Download className="w-3 h-3" /> Download JSON
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-8 text-xs"
                            onClick={async () => {
                              if (!window.confirm(`WARNING: Restoring this snapshot will sync all data into your live Firestore database.\n\nContinue?`)) return;
                              try {
                                toast.loading("Restoring cloud snapshot...", { id: 'cloud-restore' });
                                const res = await restoreCloudBackup(b);
                                toast.success(`Restored ${res.restored} records! Reloading...`, { id: 'cloud-restore' });
                                setTimeout(() => window.location.reload(), 1500);
                              } catch(err: any) {
                                toast.error(err.message || "Failed to restore cloud snapshot", { id: 'cloud-restore' });
                              }
                            }}
                          >
                            Restore
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs text-destructive hover:bg-destructive/10" 
                            onClick={async () => {
                              if (!window.confirm("Permanently delete this cloud snapshot?")) return;
                              try {
                                await deleteCloudBackup(b.id);
                                toast.success("Cloud snapshot deleted");
                                fetchBackups();
                              } catch(err: any) {
                                toast.error("Failed to delete snapshot");
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {backups.length === 0 && (
                      <div className="text-center py-6 border border-dashed border-border rounded-xl bg-muted/20">
                        <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">No cloud archives saved yet. Click "Create Cloud Snapshot" or "Download Local Backup" above.</p>
                      </div>
                    )}
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
