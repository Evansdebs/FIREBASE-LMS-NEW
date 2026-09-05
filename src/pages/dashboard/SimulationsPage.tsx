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
  Thermometer, Dna, Info, X, Heart, Settings, Activity, MessageCircle,
  GraduationCap, Sparkles, Layers
} from 'lucide-react';
import {
  getSimulations, createSimulation, updateSimulation,
  deleteSimulation, Simulation
} from '@/lib/services/contentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'Integrated Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Computing/ICT', 'Social Studies', 'Creative Arts'
];

const GRADE_LEVELS = [
  'Primary (Grades 1-6)',
  'Junior High (JHS)',
  'Senior High (SHS)',
  'All Levels'
];

const CATEGORY_ICONS: Record<string, any> = {
  'Integrated Science': FlaskConical,
  'Mathematics': Calculator,
  'Physics': FlaskConical,
  'Chemistry': Thermometer,
  'Biology': Dna,
  'Computing/ICT': Globe,
  'Social Studies': Globe,
  'Creative Arts': Dna,
};

const DEFAULT_CURATED_SIMS = [
  {
    title: 'Projectile Motion',
    description: 'Blast cars, baseballs, and cannonballs out of a cannon and investigate drag, velocity, angles, and trajectories.',
    category: 'Physics',
    level: 'Senior High (SHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Fractions: Intro',
    description: 'Explore fractions using fun visual models with shapes, pizzas, water cylinders, and numbers.',
    category: 'Mathematics',
    level: 'Primary (Grades 1-6)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/fractions-intro/latest/fractions-intro_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/fractions-intro/latest/fractions-intro-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Circuit Construction Kit: DC',
    description: 'Experiment with batteries, resistors, light bulbs, switches, and conductors to build electric circuits.',
    category: 'Integrated Science',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Forces and Motion: Basics',
    description: 'Explore net force, tug-of-war, friction, acceleration, and Newton’s laws of motion with intuitive interactive carts.',
    category: 'Integrated Science',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Energy Skate Park: Basics',
    description: 'Learn about conservation of energy with a skater riding different tracks, analyzing kinetic, potential, and thermal energy.',
    category: 'Physics',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'States of Matter: Basics',
    description: 'Heat, cool, and compress atoms and molecules to observe dynamic transitions between solid, liquid, and gas phases.',
    category: 'Chemistry',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/states-of-matter-basics/latest/states-of-matter-basics_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/states-of-matter-basics/latest/states-of-matter-basics-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Build an Atom',
    description: 'Build atoms from protons, neutrons, and electrons, and watch how element names, atomic mass, and ionic charge change.',
    category: 'Chemistry',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Balancing Act',
    description: 'Play with objects on a teeter-totter to discover rotational equilibrium, torque, and proportional mathematical thinking.',
    category: 'Mathematics',
    level: 'Primary (Grades 1-6)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/balancing-act/latest/balancing-act_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/balancing-act/latest/balancing-act-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Area Model Multiplication',
    description: 'Decompose numbers into partial products using geometric area grids to master single and double-digit multiplication.',
    category: 'Mathematics',
    level: 'Primary (Grades 1-6)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/area-model-multiplication/latest/area-model-multiplication_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/area-model-multiplication/latest/area-model-multiplication-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Gravity and Orbits',
    description: 'Move the sun, earth, moon, and space station to see how gravitational attraction, velocity, and orbital paths interact.',
    category: 'Physics',
    level: 'Senior High (SHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/gravity-and-orbits/latest/gravity-and-orbits_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/gravity-and-orbits/latest/gravity-and-orbits-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Density',
    description: 'Drop custom blocks of wood, ice, brick, and aluminum into water to explore mass, volume, buoyant force, and flotation.',
    category: 'Integrated Science',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/density/latest/density_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/density/latest/density-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Wave on a String',
    description: 'Wiggle a string to generate waves, adjusting frequency, amplitude, damping, and tension with manual or oscillator drive.',
    category: 'Physics',
    level: 'Senior High (SHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/wave-on-a-string/latest/wave-on-a-string_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/wave-on-a-string/latest/wave-on-a-string-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Natural Selection',
    description: 'Explore natural selection and genetics by controlling bunny mutations, wolves, food availability, and environmental factors.',
    category: 'Biology',
    level: 'Senior High (SHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/natural-selection/latest/natural-selection_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/natural-selection/latest/natural-selection-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Acid-Base Solutions',
    description: 'Test pH levels of strong acids, weak acids, and bases with indicators, electrodes, and conductivity meters.',
    category: 'Chemistry',
    level: 'Senior High (SHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/acid-base-solutions/latest/acid-base-solutions_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/acid-base-solutions/latest/acid-base-solutions-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Function Builder',
    description: 'Build mathematical function machines with algebraic operations and visualize inputs, outputs, and equations.',
    category: 'Mathematics',
    level: 'Junior High (JHS)',
    iframeUrl: 'https://phet.colorado.edu/sims/html/function-builder/latest/function-builder_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/function-builder/latest/function-builder-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  },
  {
    title: 'Color Vision',
    description: 'Mix red, green, and blue light to form white light and rainbow colors, or use colored filters to investigate perception.',
    category: 'Physics',
    level: 'All Levels',
    iframeUrl: 'https://phet.colorado.edu/sims/html/color-vision/latest/color-vision_all.html',
    thumbnail: 'https://phet.colorado.edu/sims/html/color-vision/latest/color-vision-600.png',
    isGlobal: true,
    uploadedBy: 'system'
  }
];

export default function SimulationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const canManage = isAdmin;

  const [simulations, setSimulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'level'>('none');
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

  const extractPhetThumbnail = (url: string) => {
    if (!url) return '';
    const match = url.match(/\/sims\/html\/([^/]+)\//);
    if (match && match[1]) {
      return `https://phet.colorado.edu/sims/html/${match[1]}/latest/${match[1]}-600.png`;
    }
    return '';
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Integrated Science',
    level: 'All Levels',
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
        // Seed full curated simulations library
        for (const s of DEFAULT_CURATED_SIMS) {
          await createSimulation(s);
        }
        res = await getSimulations();
      } else {
        // Backfill thumbnails if any existing records lack thumbnails or level
        let needsUpdate = false;
        for (const existing of res) {
          if (!existing.thumbnail) {
            const autoThumb = extractPhetThumbnail(existing.iframeUrl);
            if (autoThumb) {
              await updateSimulation(existing.id, { thumbnail: autoThumb });
              existing.thumbnail = autoThumb;
              needsUpdate = true;
            }
          }
        }
        if (needsUpdate) {
          res = await getSimulations();
        }
      }
      setSimulations(res || []);
    } catch (err: any) {
      toast.error('Failed to load simulations');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    const autoThumb = extractPhetThumbnail(url);
    setFormData(prev => ({
      ...prev,
      iframeUrl: url,
      thumbnail: prev.thumbnail || autoThumb
    }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalThumb = formData.thumbnail.trim() || extractPhetThumbnail(formData.iframeUrl);
      await createSimulation({ 
        ...formData, 
        thumbnail: finalThumb,
        uploadedBy: user?.id ? String(user.id) : 'admin' 
      });
      toast.success('Simulation added to lab successfully');
      setShowAdd(false);
      setFormData({ title: '', description: '', category: 'Integrated Science', level: 'All Levels', iframeUrl: '', thumbnail: '', isGlobal: true });
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add simulation');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSim) return;
    try {
      const finalThumb = formData.thumbnail.trim() || extractPhetThumbnail(formData.iframeUrl);
      await updateSimulation(editingSim.id, {
        ...formData,
        thumbnail: finalThumb
      });
      toast.success('Simulation updated successfully');
      setShowEdit(false);
      setEditingSim(null);
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update simulation');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this simulation from the lab?')) return;
    try {
      await deleteSimulation(id);
      toast.success('Simulation removed');
      fetchSimulations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete simulation');
    }
  };

  const filteredSims = simulations.filter(sim => {
    const matchSearch = sim.title.toLowerCase().includes(search.toLowerCase()) || 
      (sim.description && sim.description.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === 'all' || sim.category === categoryFilter;
    const matchLevel = levelFilter === 'all' || !sim.level || sim.level === 'All Levels' || sim.level === levelFilter;
    return matchSearch && matchCat && matchLevel;
  });

  const renderSimCard = (sim: any) => {
    const Icon = CATEGORY_ICONS[sim.category] || FlaskConical;
    const thumbUrl = sim.thumbnail || extractPhetThumbnail(sim.iframeUrl);
    return (
      <Card key={sim.id} className="group overflow-hidden border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card flex flex-col">
        <div className="aspect-[16/10] bg-muted relative overflow-hidden shrink-0">
          {thumbUrl ? (
            <img 
              src={thumbUrl} 
              alt={sim.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              onError={(e: any) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className="w-full h-full hidden flex-col items-center justify-center text-muted-foreground/40 gap-2 bg-muted">
            <Icon className="w-12 h-12" />
            <span className="text-[10px] uppercase font-bold tracking-widest">{sim.category}</span>
          </div>

          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
            <Button size="sm" onClick={() => handleLaunch(sim)} className="gap-2 shadow-lg">
              <Play className="w-4 h-4 fill-current" /> Launch Lab
            </Button>
          </div>

          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            <Badge className="bg-background/90 backdrop-blur-md text-foreground border-none text-[10px] font-semibold">
              {sim.category}
            </Badge>
            {sim.level && sim.level !== 'All Levels' && (
              <Badge variant="secondary" className="bg-primary/90 text-primary-foreground border-none text-[10px]">
                {sim.level}
              </Badge>
            )}
          </div>
        </div>

        <CardHeader className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2">
              <CardTitle className="text-sm sm:text-base font-semibold line-clamp-1">{sim.title}</CardTitle>
              {canManage && (
                <div className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditingSim(sim);
                    setFormData({
                      title: sim.title,
                      description: sim.description || '',
                      category: sim.category,
                      level: sim.level || 'All Levels',
                      iframeUrl: sim.iframeUrl,
                      thumbnail: sim.thumbnail || '',
                      isGlobal: sim.isGlobal ?? true
                    });
                    setShowEdit(true);
                  }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(sim.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
              {sim.description || 'Explore scientific concepts through interactive virtual lab experimentation.'}
            </CardDescription>
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              {sim.level || 'All Grades'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => handleLaunch(sim)} className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10">
              Open &rarr;
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-primary" /> PhET Science & Math Lab
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Interactive virtual simulations grouped by subjects and grade levels
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)} className="gap-2 shrink-0 self-start sm:self-auto shadow-md">
            <Plus className="w-4 h-4" /> Add Simulation
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search experiments and simulations..." 
                className="pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[170px] text-xs">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[170px] text-xs">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades / Levels</SelectItem>
                {GRADE_LEVELS.map(lvl => (
                  <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
              <SelectTrigger className="w-full sm:w-[170px] text-xs">
                <SelectValue placeholder="Group By..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="category">Group by Subject</SelectItem>
                <SelectItem value="level">Group by Grade Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Calibrating lab equipment...</p>
        </div>
      ) : filteredSims.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <FlaskConical className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg">No simulations found</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Try adjusting your search or category filters.
                {canManage && " Or add a new simulation to get started!"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groupBy === 'none' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredSims.map(renderSimCard)}
        </div>
      ) : groupBy === 'category' ? (
        <div className="space-y-8">
          {CATEGORIES.filter(cat => filteredSims.some(s => s.category === cat)).map(cat => {
            const groupSims = filteredSims.filter(s => s.category === cat);
            const Icon = CATEGORY_ICONS[cat] || FlaskConical;
            return (
              <div key={cat} className="space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                  <Icon className="w-5 h-5 text-primary" />
                  <h2 className="font-heading text-lg font-bold text-foreground">{cat}</h2>
                  <Badge variant="outline" className="text-xs">{groupSims.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupSims.map(renderSimCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {GRADE_LEVELS.filter(lvl => filteredSims.some(s => (s.level || 'All Levels') === lvl)).map(lvl => {
            const groupSims = filteredSims.filter(s => (s.level || 'All Levels') === lvl);
            return (
              <div key={lvl} className="space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <h2 className="font-heading text-lg font-bold text-foreground">{lvl}</h2>
                  <Badge variant="outline" className="text-xs">{groupSims.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupSims.map(renderSimCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simulation Player Dialog */}
      <Dialog open={!!activeSim} onOpenChange={(open) => !open && setActiveSim(null)}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 overflow-hidden flex flex-col border-primary/20">
          <div className="p-3 sm:p-4 bg-muted/80 backdrop-blur-md flex items-center justify-between border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-primary shrink-0" />
              <div>
                <h3 className="font-heading font-semibold text-sm sm:text-base text-foreground line-clamp-1">{activeSim?.title}</h3>
                <p className="text-[11px] text-muted-foreground">{activeSim?.category} {activeSim?.level ? `• ${activeSim.level}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullScreen} title="Toggle Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setActiveSim(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div ref={playerRef} className="flex-1 w-full bg-[#111] relative">
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

      {/* Add / Edit Simulation Dialog */}
      <Dialog open={showAdd || showEdit} onOpenChange={(open) => {
        if (!open) {
          setShowAdd(false);
          setShowEdit(false);
          setEditingSim(null);
        }
      }}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              {showEdit ? 'Update Simulation' : 'Add Simulation to Lab'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={showEdit ? handleUpdate : handleAdd} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="title">Simulation Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. Bending Light" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Subject Category</Label>
                <Select value={formData.category} onValueChange={cat => setFormData({...formData, category: cat})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Grade / Education Level</Label>
                <Select value={formData.level} onValueChange={lvl => setFormData({...formData, level: lvl})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_LEVELS.map(lvl => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">PhET HTML5 Simulation URL</Label>
              <Input 
                id="url" 
                placeholder="https://phet.colorado.edu/sims/html/..." 
                value={formData.iframeUrl}
                onChange={e => handleUrlChange(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                Thumbnail is automatically extracted when pasting an official PhET simulation link.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="thumb">Thumbnail Image URL</Label>
                {formData.iframeUrl && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[11px] text-primary"
                    onClick={() => {
                      const t = extractPhetThumbnail(formData.iframeUrl);
                      if (t) setFormData(p => ({ ...p, thumbnail: t }));
                    }}
                  >
                    Auto-Extract
                  </Button>
                )}
              </div>
              <Input 
                id="thumb" 
                placeholder="https://phet.colorado.edu/sims/html/...-600.png" 
                value={formData.thumbnail}
                onChange={e => setFormData({...formData, thumbnail: e.target.value})}
              />
              {formData.thumbnail && (
                <div className="w-full h-24 rounded-lg overflow-hidden border border-border mt-1">
                  <img src={formData.thumbnail} className="w-full h-full object-cover" alt="Preview" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Learning Objectives / Description</Label>
              <Textarea 
                id="desc" 
                placeholder="Explain what students will observe or practice in this simulation..." 
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="resize-none text-sm"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setShowEdit(false); }}>Cancel</Button>
              <Button type="submit">
                {showEdit ? 'Save Changes' : 'Add to Lab'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
