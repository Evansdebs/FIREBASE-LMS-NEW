import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FlaskConical, Search, Plus, Play, Trash2, Edit, 
  Maximize2, Loader2, Globe, Calculator, 
  Thermometer, Dna, Info, X, Heart, Settings, Activity, MessageCircle
} from 'lucide-react';
import {
  getSimulations, createSimulation, updateSimulation,
  deleteSimulation, Simulation
} from '@/lib/services/contentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
const CATEGORIES = [
  'Integrated Science', 'Mathematics', 'Computing/ICT', 'Creative Arts', 'Social Studies',
  'English Language', 'Religious & Moral Education', 'Career Technology', 'Physical Education', 'French'
];

const CATEGORY_ICONS: Record<string, any> = {
  'Integrated Science': FlaskConical,
  'Mathematics': Calculator,
  'Computing/ICT': Globe,
  'Creative Arts': Dna,
  'Social Studies': Thermometer,
  'English Language': Info,
  'Religious & Moral Education': Heart,
  'Career Technology': Settings,
  'Physical Education': Activity,
  'French': MessageCircle,
  // Keep legacy for compatibility
  'Physics': FlaskConical,
  'Math': Calculator,
  'Chemistry': Thermometer,
  'Biology': Dna,
  'Earth Science': Globe
};

export default function SimulationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const canManage = isAdmin; // Only admin can add/edit/delete simulations

  const [simulations, setSimulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeSim, setActiveSim] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingSim, setEditingSim] = useState<any>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (playerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      }
    }
  };

  const handleLaunch = (sim: any) => {
    setActiveSim(sim);
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Integrated Science',
    iframeUrl: '',
    thumbnail: '',
    isGlobal: true
  });

  useEffect(() => {
    fetchSimulations();
  }, []);

  const fetchSimulations = async () => {
    try {
      setLoading(true);
      let res = await getSimulations();
      if (res.length === 0) {
        // Seed default educational simulations if none exist
        const defaultSims = [
          {
            title: 'Projectile Motion',
            description: 'Blast a car out of a cannon and explore physics vectors and drag.',
            category: 'Integrated Science',
            iframeUrl: 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_all.html',
            isGlobal: true,
            uploadedBy: 'system'
          },
          {
            title: 'Fractions: Intro',
            description: 'Explore fractions with shapes and numbers.',
            category: 'Mathematics',
            iframeUrl: 'https://phet.colorado.edu/sims/html/fractions-intro/latest/fractions-intro_all.html',
            isGlobal: true,
            uploadedBy: 'system'
          },
          {
            title: 'Circuit Construction Kit: DC',
            description: 'Experiment with batteries, resistors, light bulbs, and switches.',
            category: 'Integrated Science',
            iframeUrl: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html',
            isGlobal: true,
            uploadedBy: 'system'
          }
        ];
        for (const s of defaultSims) {
          await createSimulation(s);
        }
        res = await getSimulations();
      }
      setSimulations(res || []);
    } catch (err: any) {
      toast.error('Failed to load simulations');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSimulation({ ...formData, uploadedBy: user?.id as string || 'admin' });
      toast.success('Simulation added to lab');
      setShowAdd(false);
      setFormData({ title: '', description: '', category: 'Integrated Science', iframeUrl: '', thumbnail: '', isGlobal: true });
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add simulation');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSim) return;
    try {
      await updateSimulation(editingSim.id, formData);
      toast.success('Simulation updated');
      setShowEdit(false);
      setEditingSim(null);
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update simulation');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this simulation from the lab?')) return;
    try {
      await deleteSimulation(id);
      toast.success('Simulation removed');
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete simulation');
    }
  };

  const filteredSims = simulations.filter(sim => {
    const matchesSearch = sim.title.toLowerCase().includes(search.toLowerCase()) || 
                          sim.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || sim.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Simulation Lab</h1>
          <p className="text-muted-foreground mt-1">Interactive virtual experiments and simulations</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)} className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Simulation
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search experiments..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Calibrating lab equipment...</p>
        </div>
      ) : filteredSims.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg">No simulations found</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Try adjusting your search or category filter. 
                {canManage && " Or add your first simulation to get started!"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSims.map((sim) => {
            const Icon = CATEGORY_ICONS[sim.category] || FlaskConical;
            return (
              <Card key={sim.id} className="group overflow-hidden border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/50">
                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                  {sim.thumbnail ? (
                    <img src={sim.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-2">
                       <Icon className="w-12 h-12" />
                       <span className="text-[10px] uppercase font-bold tracking-widest">{sim.category}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                     <Button size="sm" onClick={() => handleLaunch(sim)} className="gap-2">
                        <Play className="w-4 h-4 fill-current" /> Launch Lab
                     </Button>
                  </div>
                  <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-md text-foreground border-none">
                    {sim.category}
                  </Badge>
                </div>
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-1">{sim.title}</CardTitle>
                    {canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                           setEditingSim(sim);
                           setFormData({
                             title: sim.title,
                             description: sim.description || '',
                             category: sim.category,
                             iframeUrl: sim.iframeUrl,
                             thumbnail: sim.thumbnail || '',
                             isGlobal: sim.isGlobal
                           });
                           setShowEdit(true);
                         }}>
                            <Edit className="w-3.5 h-3.5" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(sim.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                         </Button>
                      </div>
                    )}
                  </div>
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {sim.description || "Interactive simulation for educational purposes."}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Simulation Player Dialog */}
      <Dialog open={!!activeSim} onOpenChange={(open) => !open && setActiveSim(null)}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-black border-none gap-0">
          <div className="bg-background/5 border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-1.5 rounded-lg bg-primary/10">
                 <FlaskConical className="w-4 h-4 text-primary" />
               </div>
               <div>
                  <h3 className="text-white text-sm font-semibold leading-none">{activeSim?.title}</h3>
                  <p className="text-[10px] text-white/50 mt-1 uppercase tracking-wider">{activeSim?.category}</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={toggleFullScreen} title="Toggle Full Screen">
                  <Maximize2 className="w-4 h-4" />
               </Button>
               <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={() => setActiveSim(null)}>
                  <X className="w-5 h-5" />
               </Button>
            </div>
          </div>
          <div ref={playerRef} className="flex-1 w-full bg-[#333] relative">
            {activeSim && (
              <iframe 
                src={activeSim.iframeUrl}
                className="w-full h-full border-none"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                scrolling="no"
                title={activeSim.title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialogs */}
      <Dialog open={showAdd || showEdit} onOpenChange={(open) => {
        if (!open) {
          setShowAdd(false);
          setShowEdit(false);
          setEditingSim(null);
        }
      }}>
        <DialogContent className={cn("sm:max-w-[500px]", "glass-morphism border-primary/20")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              {showEdit ? 'Update Simulation' : 'Add New Simulation'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={showEdit ? handleUpdate : handleAdd} className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Simulation Title</Label>
              <Input 
                id="title" 
                placeholder="e.g., Bending Light" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={cat => setFormData({...formData, category: cat})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">PhET Iframe/Share URL</Label>
              <Input 
                id="url" 
                placeholder="https://phet.colorado.edu/sims/html/..." 
                value={formData.iframeUrl}
                onChange={e => setFormData({...formData, iframeUrl: e.target.value})}
                required
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Use the direct HTML5 link from PhET's share options.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="thumb">Thumbnail URL (Optional)</Label>
              <Input 
                id="thumb" 
                placeholder="Image URL..." 
                value={formData.thumbnail}
                onChange={e => setFormData({...formData, thumbnail: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea 
                id="desc" 
                placeholder="Explain what the students should learn from this lab..." 
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => { setShowAdd(false); setShowEdit(false); }}>Cancel</Button>
              <Button type="submit" className="gap-2">
                {showEdit ? 'Save Changes' : 'Add to Lab'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
