import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Play, Pause, Volume2, RotateCcw, Award, CheckCircle2,
  Sparkles, Clock, X, Lock, Flame, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Confetti Particle interface
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
  spin: number;
  opacity: number;
}

export default function VideoPlayerModal({ material, isOpen, onClose, onProgressComplete }: {
  material: any;
  isOpen: boolean;
  onClose: () => void;
  onProgressComplete?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds threshold to earn points
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<any>(null);
  const particleIdRef = useRef(0);

  const isCompletedAlready = material.progress?.[0]?.status === 'COMPLETED';

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true);
      setTimeLeft(isCompletedAlready ? 0 : 30);
      setProgress(isCompletedAlready ? 100 : 0);
      setCompleted(isCompletedAlready);
      setCelebrate(false);
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isOpen, material, isCompletedAlready]);

  // Handle countdown
  useEffect(() => {
    if (isPlaying && timeLeft > 0 && !completed) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          const percentage = ((30 - next) / 30) * 100;
          setProgress(percentage);
          if (next <= 0) {
            stopTimer();
            handleComplete();
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isPlaying, completed, timeLeft]);

  // Confetti physics loop
  useEffect(() => {
    if (confetti.length === 0) return;

    const frame = requestAnimationFrame(() => {
      setConfetti((prevParticles) =>
        prevParticles
          .map((p) => ({
            ...p,
            x: p.x + Math.cos(p.angle) * p.speed,
            y: p.y + Math.sin(p.angle) * p.speed + 1.8, // gravity pulls down
            opacity: p.opacity - 0.012,
            spin: p.spin + 10
          }))
          .filter((p) => p.opacity > 0)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [confetti]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleComplete = async () => {
    try {
      setCompleted(true);
      setProgress(100);
      setCelebrate(true);
      triggerConfetti();

      toast.success("🎉 Lesson completed successfully! +10 Points awarded!", { duration: 4000 });

      if (onProgressComplete) {
        onProgressComplete();
      }
    } catch (err: any) {
      console.error('Failed to complete progress:', err);
    }
  };

  const triggerConfetti = () => {
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#a855f7', '#eab308', '#ff7849', '#ff3366'];
    const newParticles: ConfettiParticle[] = [];

    // Sparkle 60 particles outwards from center of the screen
    for (let i = 0; i < 75; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: 50, // center X percentage
        y: 45, // center Y percentage
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 5 + 3,
        spin: Math.random() * 360,
        opacity: 1
      });
    }
    setConfetti(newParticles);
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) return `https://www.youtube.com/embed/${url.split('v=')[1]?.split('&')[0]}?autoplay=1&enablejsapi=1`;
    if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]?.split('?')[0]}?autoplay=1&enablejsapi=1`;
    if (url.includes('vimeo.com/')) return `https://player.vimeo.com/video/${url.split('vimeo.com/')[1]?.split('?')[0]}?autoplay=1`;
    return null;
  };

  const url = material?.fileUrl || material?.externalUrl || material?.filePath || '';
  const embedUrl = getEmbedUrl(url);
  const isDirectVideo = !embedUrl && (url.endsWith('.mp4') || url.endsWith('.webm') || material?.type === 'VIDEO');

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl relative">
        {/* Floating confetti container */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: `rotate(${p.spin}deg)`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
          ))}
        </div>

        {/* Celebrate screen overlay */}
        {celebrate && (
          <div className="absolute inset-0 z-40 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 border border-emerald-500/30 mb-6 animate-bounce">
                <Award className="w-12 h-12" />
              </div>
              <Sparkles className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
              <Sparkles className="w-6 h-6 text-yellow-400 absolute -bottom-2 -left-2 animate-pulse delay-75" />
            </div>

            <h3 className="text-3xl font-extrabold text-white font-heading tracking-tight mb-2">
              Superb Job! 🌟
            </h3>
            <p className="text-zinc-400 max-w-md text-sm mb-6 leading-relaxed">
              You completed the video lesson <strong>"{material.fileName || material.title}"</strong>, successfully earned <span className="text-emerald-400 font-bold">+10 points</span>, and unlocked an achievement!
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                onClick={() => setCelebrate(false)}
              >
                Keep Watching
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30"
                onClick={() => onClose()}
              >
                Close & Return
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col h-[80vh]">
          {/* Header Controls */}
          <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 font-bold">
                VIDEO LESSON
              </Badge>
              <h3 className="text-sm font-semibold text-zinc-100 truncate max-w-sm sm:max-w-md">
                {material?.fileName || material?.title}
              </h3>
            </div>

            <div className="flex items-center gap-4">
              {/* Point Status Tracker */}
              <div className="hidden sm:flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 py-1 px-3 rounded-full text-xs">
                {completed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Completed (+10 XP)</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-yellow-500 animate-spin" />
                    <span className="text-zinc-300">Watch {timeLeft}s to earn +10 points</span>
                  </>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800/80 h-8 w-8 rounded-lg"
                onClick={() => onClose()}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Gamified Time Tracker Progress bar */}
          {!completed && (
            <div className="px-4 py-1.5 bg-zinc-900/90 border-b border-zinc-800/60 flex items-center gap-3">
              <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest shrink-0">
                LMS PROGRESS COUNTDOWN
              </span>
              <Progress value={progress} className="h-1.5 bg-zinc-800" indicatorClassName="bg-gradient-to-r from-rose-500 to-indigo-500 transition-all duration-300" />
              <span className="text-[10px] font-bold text-yellow-500 shrink-0">
                {timeLeft}s remaining
              </span>
            </div>
          )}

          {/* Video Player Display Container */}
          <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full border-none"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : isDirectVideo ? (
              <video
                ref={videoRef}
                src={url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}/${url}`}
                className="w-full h-full object-contain"
                controls
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (!completed) {
                    handleComplete();
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400 max-w-sm">
                <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
                <p className="font-bold text-white mb-1">Direct playback unavailable</p>
                <p className="text-xs mb-4 leading-relaxed">This external material needs to be viewed directly on the source platform.</p>
                <Button
                  className="bg-primary hover:bg-primary/90 text-white gap-1 text-xs px-4"
                  onClick={() => window.open(url, '_blank')}
                >
                  Open External Link <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Player controls bar */}
          <div className="p-4 bg-zinc-900/60 border-t border-zinc-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {isPlaying ? 'Pause Study' : 'Resume Study'}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {completed ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Award className="w-4 h-4" /> Finished Lesson
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-500 font-bold px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <Flame className="w-3.5 h-3.5 animate-pulse" /> Unlock +10 XP soon
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
