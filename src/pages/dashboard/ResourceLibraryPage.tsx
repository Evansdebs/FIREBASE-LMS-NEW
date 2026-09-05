import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Search, FileText, Video, Image, Download, File, Star, Clock, Loader2,
  Trash2, Upload, Plus, Edit, FileAudio, FileBadge, Play, Eye, BookOpen, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getMaterials, createMaterial, updateMaterial,
  deleteMaterial, MaterialDoc
} from '@/lib/services/contentService';
import { getCourses, getTopics } from '@/lib/services/academicService';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { TTSButton } from '@/components/ui/TTSButton';
import VideoPlayerModal from '@/components/dashboard/VideoPlayerModal';
import MediaRecorderModal from '@/components/dashboard/MediaRecorderModal';
import { Radio, Mic } from 'lucide-react';

export default function ResourceLibraryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const canManage = isAdmin || isTeacher;

  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [activeResource, setActiveResource] = useState<any>(null);
  const [previewResource, setPreviewResource] = useState<any>(null);
  const [videoResource, setVideoResource] = useState<any>(null);

  useEffect(() => { fetchMaterials(); }, [user]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await getMaterials();
      setResources(res || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm('Delete this resource? This cannot be undone.')) return;
    try {
      await deleteMaterial(id);
      toast.success('Resource deleted');
      fetchMaterials();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete resource');
    }
  };

  // ─── Download handler ────────────────────────────────────
  const handleDownload = async (resource: any) => {
    const url = resource.fileUrl || resource.externalUrl || resource.filePath || '';
    if (!url || url === 'text-content') {
      // TEXT type — download as .txt
      const blob = new Blob([resource.textContent || ''], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${resource.fileName || resource.title || 'note'}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // External or uploaded URL
    const isExternal = url.startsWith('http');
    const fullUrl = isExternal ? url : `${API_BASE}/${url}`;
    try {
      const response = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem('onereal_token')}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = resource.fileName || resource.title || 'resource';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(fullUrl, '_blank');
    }
  };

  // ─── Unique subjects for filter ──────────────────────────
  const subjects = Array.from(
    new Map(
      resources
        .map(r => r.topic?.course?.subject)
        .filter(Boolean)
        .map(s => [s.id, s])
    ).values()
  );

  const filtered = resources.filter(r => {
    const name = (r.title || r.fileName || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const typeLabel = (r.type || '').toLowerCase();
    const matchType = typeFilter === 'all' || typeLabel === typeFilter.toLowerCase();
    const matchSubject = subjectFilter === 'all' || r.topic?.course?.subject?.id?.toString() === subjectFilter;
    const matchStarred = !starredOnly || starredIds.has(r.id);
    return matchSearch && matchType && matchSubject && matchStarred;
  });

  const toggleStar = (id: number) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeIcon = (type: string, name?: string) => {
    const t = (type || '').toUpperCase();
    const ext = name?.split('.').pop()?.toLowerCase();
    if (t === 'VIDEO') return <Video className="w-5 h-5 text-rose-500" />;
    if (t === 'IMAGE') return <Image className="w-5 h-5 text-emerald-500" />;
    if (t === 'PDF') return <FileText className="w-5 h-5 text-red-500" />;
    if (t === 'WORD' || ext === 'doc' || ext === 'docx') return <FileText className="w-5 h-5 text-blue-500" />;
    if (t === 'EXCEL' || ext === 'xls' || ext === 'xlsx') return <FileBadge className="w-5 h-5 text-green-600" />;
    if (t === 'AUDIO') return <FileAudio className="w-5 h-5 text-purple-500" />;
    if (t === 'TEXT') return <FileText className="w-5 h-5 text-slate-500" />;
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) {
      const id = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('vimeo.com/')) {
      const id = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  };

  const getResourceUrl = (r: any) => r.fileUrl || r.externalUrl || (r.filePath && r.filePath !== 'text-content' ? `${API_BASE}/${r.filePath}` : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Resource Library</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {loading ? 'Loading...' : `${filtered.length} resource${filtered.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm"
              onClick={() => setShowRecorder(true)}
            >
              <Mic className="w-4 h-4 text-primary" /> Studio Recorder
            </Button>
            <Dialog open={showUpload} onOpenChange={setShowUpload}>
              <DialogTrigger asChild>
                <Button className="gap-2 text-xs sm:text-sm"><Plus className="w-4 h-4" /> Add Resource</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle className="font-heading">Add Resource / Material</DialogTitle></DialogHeader>
                <UploadResourceForm onClose={() => setShowUpload(false)} onRefresh={fetchMaterials} isAdmin={isAdmin} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <MediaRecorderModal
        isOpen={showRecorder}
        onClose={() => setShowRecorder(false)}
        onSaved={fetchMaterials}
        saveMode="material"
      />

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Edit Resource</DialogTitle></DialogHeader>
          {activeResource && (
            <EditResourceForm
              resource={activeResource}
              onClose={() => { setShowEdit(false); setActiveResource(null); }}
              onRefresh={fetchMaterials}
              isAdmin={isAdmin}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="word">Word Docs</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="text">Notes/Text</SelectItem>
              </SelectContent>
            </Select>
            {subjects.length > 0 && (
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-full sm:w-[160px] text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={starredOnly ? 'default' : 'outline'}
              size="icon"
              onClick={() => setStarredOnly(!starredOnly)}
              title="Show starred only"
            >
              <Star className={cn('w-4 h-4', starredOnly ? 'fill-current' : '')} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resource grid */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No resources found.</p>
            {isStudent && <p className="text-sm text-muted-foreground mt-1">Resources added by your teachers will appear here.</p>}
            {canManage && <p className="text-sm text-muted-foreground mt-1">Click "Add Resource" to upload one.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(resource => {
            const resourceUrl = getResourceUrl(resource);
            const isVideo = resource.type === 'VIDEO';
            const isText = resource.type === 'TEXT' || resource.textContent;
            const isImage = resource.type === 'IMAGE';
            const isPdf = resource.type === 'PDF';
            const canPreview = isVideo || isText || isImage || isPdf;
            const embedUrl = isVideo ? getEmbedUrl(resourceUrl || '') : null;
            const subject = resource.topic?.course?.subject?.name;
            const course = resource.topic?.course?.title;

            return (
              <Card key={resource.id} className="border-border hover:shadow-md transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {typeIcon(resource.type, resource.fileName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 pr-2 overflow-hidden">
                          {resource.isGlobal && <Globe className="w-4 h-4 text-primary shrink-0" />}
                          <h3 className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">
                            {resource.title || resource.fileName || 'Untitled'}
                          </h3>
                        </div>
                        <button onClick={() => toggleStar(resource.id)} className="shrink-0 flex-shrink-0">
                          <Star className={cn('w-4 h-4 transition-colors', starredIds.has(resource.id) ? 'text-warning fill-warning' : 'text-muted-foreground hover:text-warning')} />
                        </button>
                      </div>
                      {(subject || course) ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {subject && <span className="font-medium">{subject}</span>}
                          {subject && course && ' › '}
                          {course}
                        </p>
                      ) : (resource.isGlobal ? (
                        <p className="text-xs text-primary font-medium mt-0.5 truncate">
                          Global Resource
                        </p>
                      ) : null)}
                      {resource.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                          "{resource.description}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{resource.type || 'FILE'}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(resource.uploadedAt || resource.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        {/* Preview/Play */}
                        {isVideo ? (
                          <Button size="sm" variant="default" className="gap-1 flex-1 text-xs h-8 bg-rose-600 hover:bg-rose-700"
                            onClick={() => setVideoResource(resource)}>
                            <Play className="w-3 h-3" /> Play
                          </Button>
                        ) : canPreview ? (
                          <Button size="sm" variant="outline" className="gap-1 flex-1 text-xs h-8"
                            onClick={() => setPreviewResource(resource)}>
                            <Eye className="w-3 h-3" /> View
                          </Button>
                        ) : null}

                        {(isText || resource.fileName || resource.title) && (
                           <TTSButton 
                            text={`${resource.title || resource.fileName || 'Resource'}. ${resource.description ? `Description: ${resource.description}` : ''} ${isText ? `. Content: ${resource.textContent}` : ''}`} 
                            className="h-8 w-8"
                           />
                        )}

                        {/* Download button for all users */}
                        {(resourceUrl || isText) && (
                          <Button size="sm" variant="outline" className="gap-1 flex-1 text-xs h-8"
                            onClick={() => handleDownload(resource)}>
                            <Download className="w-3 h-3" /> Download
                          </Button>
                        )}

                        {/* Manage actions */}
                        {canManage && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="w-8 p-0 h-8"
                              onClick={() => { setActiveResource(resource); setShowEdit(true); }}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="w-8 p-0 h-8 text-destructive hover:text-destructive"
                              onClick={() => deleteMaterial(resource.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!previewResource} onOpenChange={() => setPreviewResource(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          {previewResource && (
            <div className="flex flex-col h-[80vh]">
              <div className="p-4 bg-background/10 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-medium">{previewResource.title || previewResource.fileName}</h3>
                  <p className="text-white/50 text-xs mt-0.5">{previewResource.topic?.course?.subject?.name} › {previewResource.topic?.course?.title}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:bg-white/10 gap-1 text-xs"
                    onClick={() => handleDownload(previewResource)}
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setPreviewResource(null)}>Close</Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-black flex items-center justify-center p-0">
                {previewResource.type === 'VIDEO' ? (
                  <iframe
                    src={getEmbedUrl(getResourceUrl(previewResource) || '') || ''}
                    className="w-full h-full border-none"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : previewResource.type === 'IMAGE' ? (
                  <img src={getResourceUrl(previewResource) || ''} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : previewResource.type === 'PDF' ? (
                  <iframe src={getResourceUrl(previewResource) || ''} className="w-full h-full border-none bg-background rounded" />
                ) : (
                  <div className="w-full h-full bg-background p-8 overflow-auto">
                    <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                      {previewResource.textContent}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Premium Video Player Modal */}
      {videoResource && (
        <VideoPlayerModal
          material={videoResource}
          isOpen={!!videoResource}
          onClose={() => setVideoResource(null)}
          onProgressComplete={() => {
            fetchMaterials();
          }}
        />
      )}
    </div>
  );
}

// ─── UPLOAD FORM ──────────────────────────────────────────
function detectTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'WORD';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'EXCEL';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'IMAGE';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'VIDEO';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'AUDIO';
  if (['txt', 'md'].includes(ext)) return 'TEXT';
  return 'PDF';
}

// ─── UPLOAD FORM ──────────────────────────────────────────
function UploadResourceForm({ onClose, onRefresh, isAdmin }: { onClose: () => void; onRefresh: () => void; isAdmin: boolean }) {
  const [form, setForm] = useState({ title: '', type: 'PDF', externalUrl: '', topicId: '', textContent: '', isGlobal: false, description: '' });
  const [sourceMode, setSourceMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCourses().then(async (courses) => {
      const allTopics: any[] = [];
      for (const c of courses) {
        const tops = await getTopics(c.id);
        tops.forEach(t => allTopics.push({ ...t, courseName: c.title }));
      }
      setTopics(allTopics);
    }).catch(() => {});
  }, [isAdmin]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 8 * 1024 * 1024) {
      toast.error(`File is ${(selected.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed upload size is 8MB.`);
      return;
    }
    const detected = detectTypeFromFileName(selected.name);
    setForm(prev => ({
      ...prev,
      type: detected,
      title: prev.title || selected.name.replace(/\.[^/.]+$/, '')
    }));
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, externalUrl: reader.result as string }));
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.isGlobal && !form.topicId) { toast.error('Please select a topic/module'); return; }
    if (!form.textContent && !form.externalUrl && !file) {
      toast.error('Please provide a file, URL, or text content.');
      return;
    }
    try {
      setLoading(true);
      await createMaterial({
        title: form.title,
        fileName: file?.name || form.title,
        type: form.type as any,
        topicId: form.topicId || undefined,
        isGlobal: form.isGlobal,
        fileUrl: form.externalUrl || undefined,
        fileSize: file?.size,
        textContent: form.textContent || undefined,
        description: form.description || undefined,
      });
      toast.success('Resource added successfully!');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto px-1">
      <div className="space-y-2">
        <Label>Resource Title</Label>
        <Input 
          value={form.title} 
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))} 
          placeholder="e.g. Intro to Genetics Notes" 
          required 
        />
      </div>

      <div className="space-y-2">
        <Label>Description (Optional)</Label>
        <Input 
          value={form.description} 
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
          placeholder="Briefly describe what this resource covers" 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category / Type</Label>
          <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF Document</SelectItem>
              <SelectItem value="WORD">Word Document (.docx)</SelectItem>
              <SelectItem value="EXCEL">Excel Sheet (.xlsx)</SelectItem>
              <SelectItem value="IMAGE">Image / Graphic</SelectItem>
              <SelectItem value="VIDEO">Video (File/URL)</SelectItem>
              <SelectItem value="AUDIO">Audio / Podcast</SelectItem>
              <SelectItem value="TEXT">Plain Text / Note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Topic / Module</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.isGlobal} 
                onChange={e => setForm(p => ({ ...p, isGlobal: e.target.checked, topicId: '' }))} 
                className="rounded border-gray-300 w-3.5 h-3.5" 
              />
              <span>Global Resource</span>
            </label>
          </div>
          <Select disabled={form.isGlobal} value={form.topicId} onValueChange={v => setForm(p => ({ ...p, topicId: v }))}>
            <SelectTrigger><SelectValue placeholder={form.isGlobal ? "N/A (Global Resource)" : "Select topic"} /></SelectTrigger>
            <SelectContent>
              {topics.length === 0 && <SelectItem value="none" disabled>No topics found</SelectItem>}
              {topics.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.courseName} › {t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.type === 'TEXT' ? (
        <div className="space-y-2">
          <Label>Content (Text / Markdown)</Label>
          <Textarea
            placeholder="Type or paste your lecture note or reference content here..."
            value={form.textContent}
            onChange={e => setForm(p => ({ ...p, textContent: e.target.value }))}
            className="min-h-[160px] text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg w-fit border border-border">
            <Button 
              type="button" 
              size="sm" 
              variant={sourceMode === 'file' ? 'default' : 'ghost'} 
              onClick={() => setSourceMode('file')} 
              className="h-7 text-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Local File
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={sourceMode === 'link' ? 'default' : 'ghost'} 
              onClick={() => setSourceMode('link')} 
              className="h-7 text-xs gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" /> Web Link (URL)
            </Button>
          </div>

          {sourceMode === 'file' ? (
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/20 transition-colors">
              <input 
                type="file" 
                id="upload-material-file" 
                className="hidden" 
                onChange={handleFileSelect}
                accept={
                  form.type === 'PDF' ? '.pdf' :
                  form.type === 'WORD' ? '.doc,.docx' :
                  form.type === 'EXCEL' ? '.xls,.xlsx,.csv' :
                  form.type === 'IMAGE' ? 'image/*' :
                  form.type === 'VIDEO' ? 'video/*' :
                  form.type === 'AUDIO' ? 'audio/*' :
                  '*'
                }
              />
              {file || (form.externalUrl && form.externalUrl.startsWith('data:')) ? (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">{file?.name || 'Local file attached'}</span>
                    {file && <span className="text-[10px] text-muted-foreground shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>}
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-destructive text-xs px-2" 
                    onClick={() => { setFile(null); setForm(p => ({ ...p, externalUrl: '' })); }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label htmlFor="upload-material-file" className="cursor-pointer flex flex-col items-center gap-1.5 py-3">
                  <Upload className="w-8 h-8 text-primary/70 mb-1" />
                  <span className="text-xs font-semibold text-foreground">Click to choose a file from your device</span>
                  <span className="text-[10px] text-muted-foreground">Supported: PDF, Word, Excel, Images, Video, Audio (Up to 8MB)</span>
                </label>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>External Web Link / Storage URL</Label>
              <Input 
                placeholder="https://drive.google.com/... or https://..." 
                value={form.externalUrl} 
                onChange={e => setForm(p => ({ ...p, externalUrl: e.target.value }))} 
              />
              <p className="text-[10px] text-muted-foreground">You can paste Google Drive, Dropbox, YouTube, Vimeo, or direct file URLs.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Add Resource</>}
        </Button>
      </div>
    </form>
  );
}

// ─── EDIT FORM ────────────────────────────────────────────
function EditResourceForm({ resource, onClose, onRefresh, isAdmin }: { resource: any; onClose: () => void; onRefresh: () => void; isAdmin: boolean }) {
  const [form, setForm] = useState({
    title: resource.title || resource.fileName || '',
    type: resource.type || 'PDF',
    externalUrl: resource.externalUrl || resource.fileUrl || (resource.filePath && resource.filePath !== 'text-content' ? resource.filePath : '') || '',
    topicId: resource.topicId?.toString() || '',
    textContent: resource.textContent || '',
    isGlobal: resource.isGlobal || false,
    description: resource.description || '',
  });
  const [sourceMode, setSourceMode] = useState<'file' | 'link'>(
    resource.fileUrl && resource.fileUrl.startsWith('data:') ? 'file' : 'link'
  );
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCourses().then(async (courses) => {
      const allTopics: any[] = [];
      for (const c of courses) {
        const tops = await getTopics(c.id);
        tops.forEach(t => allTopics.push({ ...t, courseName: c.title }));
      }
      setTopics(allTopics);
    }).catch(() => {});
  }, [isAdmin]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 8 * 1024 * 1024) {
      toast.error(`File is ${(selected.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed upload size is 8MB.`);
      return;
    }
    const detected = detectTypeFromFileName(selected.name);
    setForm(prev => ({
      ...prev,
      type: detected,
      title: prev.title || selected.name.replace(/\.[^/.]+$/, '')
    }));
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, externalUrl: reader.result as string }));
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateMaterial(resource.id, {
        title: form.title,
        type: form.type as any,
        topicId: form.topicId || undefined,
        isGlobal: form.isGlobal,
        fileUrl: form.externalUrl || undefined,
        fileSize: file?.size || resource.fileSize,
        textContent: form.textContent || undefined,
        description: form.description || undefined,
      });
      toast.success('Resource updated successfully!');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto px-1">
      <div className="space-y-2">
        <Label>Resource Title</Label>
        <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Briefly describe this resource" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category / Type</Label>
          <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF Document</SelectItem>
              <SelectItem value="WORD">Word Document (.docx)</SelectItem>
              <SelectItem value="EXCEL">Excel Sheet (.xlsx)</SelectItem>
              <SelectItem value="IMAGE">Image / Graphic</SelectItem>
              <SelectItem value="VIDEO">Video (URL/File)</SelectItem>
              <SelectItem value="AUDIO">Audio / Podcast</SelectItem>
              <SelectItem value="TEXT">Plain Text / Note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Topic / Module</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={form.isGlobal} onChange={e => setForm(p => ({ ...p, isGlobal: e.target.checked, topicId: '' }))} className="rounded border-gray-300 w-3.5 h-3.5" />
              <span>Global Resource</span>
            </label>
          </div>
          <Select disabled={form.isGlobal} value={form.topicId} onValueChange={v => setForm(p => ({ ...p, topicId: v }))}>
            <SelectTrigger><SelectValue placeholder={form.isGlobal ? "N/A (Global)" : "Select topic"} /></SelectTrigger>
            <SelectContent>
              {topics.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.courseName} › {t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.type === 'TEXT' ? (
        <div className="space-y-2">
          <Label>Content (Text)</Label>
          <Textarea
            placeholder="Paste or type your content here..."
            value={form.textContent}
            onChange={e => setForm(p => ({ ...p, textContent: e.target.value }))}
            className="min-h-[160px] text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg w-fit border border-border">
            <Button 
              type="button" 
              size="sm" 
              variant={sourceMode === 'file' ? 'default' : 'ghost'} 
              onClick={() => setSourceMode('file')} 
              className="h-7 text-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Local File
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant={sourceMode === 'link' ? 'default' : 'ghost'} 
              onClick={() => setSourceMode('link')} 
              className="h-7 text-xs gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" /> Web Link
            </Button>
          </div>

          {sourceMode === 'file' ? (
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/20 transition-colors">
              <input 
                type="file" 
                id="edit-material-file" 
                className="hidden" 
                onChange={handleFileSelect}
              />
              {file || (form.externalUrl && form.externalUrl.startsWith('data:')) ? (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">{file?.name || 'Local file attached'}</span>
                    {file && <span className="text-[10px] text-muted-foreground shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>}
                  </div>
                  <label htmlFor="edit-material-file" className="cursor-pointer text-xs text-primary font-medium hover:underline">
                    Change
                  </label>
                </div>
              ) : (
                <label htmlFor="edit-material-file" className="cursor-pointer flex flex-col items-center gap-1.5 py-3">
                  <Upload className="w-8 h-8 text-primary/70 mb-1" />
                  <span className="text-xs font-semibold text-foreground">Click to upload or replace file</span>
                  <span className="text-[10px] text-muted-foreground">PDF, Word, Excel, Images, Audio, Video (Up to 8MB)</span>
                </label>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>URL / Link</Label>
              <Input value={form.externalUrl} onChange={e => setForm(p => ({ ...p, externalUrl: e.target.value }))} placeholder="https://..." />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
