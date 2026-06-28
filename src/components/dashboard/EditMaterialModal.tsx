// src/components/dashboard/EditMaterialModal.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface Material {
  id: number;
  type: string;
  fileName?: string;
  title?: string;
  filePath?: string;
  externalUrl?: string;
  textContent?: string;
  description?: string;
  topicId?: number | null;
}

interface Props {
  material: Material | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditMaterialModal({ material, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'PDF',
    textContent: '',
    externalUrl: '',
  });

  // Pre-fill form when material changes
  useEffect(() => {
    if (material) {
      setForm({
        title: material.title || material.fileName || '',
        description: material.description || '',
        type: material.type || 'PDF',
        textContent: material.textContent || '',
        externalUrl: material.externalUrl || (material.filePath?.startsWith('http') ? material.filePath : '') || '',
      });
    }
  }, [material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!form.title.trim()) {
      toast({ title: 'Validation', description: 'Title is required.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      await api.put(`/api/teacher/materials/${material.id}`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        textContent: form.type === 'TEXT' ? form.textContent : undefined,
        externalUrl: form.type !== 'TEXT' && form.externalUrl ? form.externalUrl : undefined,
        topicId: material.topicId ?? undefined,
      });
      toast({ title: 'Saved', description: `Material "${form.title}" updated successfully.` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message || 'Could not update material.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] border-border bg-card shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 bg-muted/10">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" /> Edit Material
          </DialogTitle>
          <DialogDescription>
            Update the title, description, or content of this learning resource.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase">Title</label>
              <Input
                required
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="bg-muted/30 focus:bg-background border-border/60 font-semibold py-5"
                placeholder="Material title…"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase">Description (optional)</label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="bg-muted/30 focus:bg-background border-border/60 py-5"
                placeholder="Brief description…"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase">Material Type</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full h-10 px-3 py-2 rounded-md border border-border bg-background text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="PDF">PDF Presentation</option>
                <option value="WORD">Word Handout</option>
                <option value="EXCEL">Excel Spreadsheet</option>
                <option value="IMAGE">Image Diagram</option>
                <option value="VIDEO">Video Lesson</option>
                <option value="AUDIO">Audio Lecture</option>
                <option value="TEXT">Plain-text Notes</option>
              </select>
            </div>

            {/* Content fields */}
            {form.type === 'TEXT' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Text Content</label>
                <Textarea
                  value={form.textContent}
                  onChange={e => setForm(p => ({ ...p, textContent: e.target.value }))}
                  className="bg-muted/30 focus:bg-background border-border/60 min-h-[140px] resize-none"
                  placeholder="Paste or type study notes here…"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">External URL (optional)</label>
                <Input
                  value={form.externalUrl}
                  onChange={e => setForm(p => ({ ...p, externalUrl: e.target.value }))}
                  className="bg-muted/30 focus:bg-background border-border/60 py-5"
                  placeholder="https://…"
                />
                <p className="text-[10px] text-muted-foreground">Leave blank to keep the existing uploaded file.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-2 border-t border-border/40 bg-muted/5">
            <Button type="button" variant="ghost" onClick={onClose} className="font-bold">Cancel</Button>
            <Button type="submit" disabled={loading} className="font-bold px-8 shadow-lg gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Pencil className="w-4 h-4" /> Save Changes</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
