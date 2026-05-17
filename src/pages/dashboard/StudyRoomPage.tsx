import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, RotateCcw, Volume2, Music, Sparkles, Award, Clock,
  Sunset, Compass, CloudRain, Flame, HelpCircle, CheckCircle, VolumeX,
  Waves, Disc
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Confetti Particle Interface
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

export default function StudyRoomPage() {
  const [timerMode, setTimerMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [totalFocusSessions, setTotalFocusSessions] = useState(0);
  const [bgTheme, setBgTheme] = useState<'sunset' | 'space' | 'rain'>('sunset');

  // Meditative sound settings
  const [soundType, setSoundType] = useState<'none' | 'binaural' | 'waves' | 'bowl'>('none');
  const [volume, setVolume] = useState(0.4);

  // Confetti celebration state
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const timerIntervalRef = useRef<any>(null);
  
  // Advanced Audio Ref Handles
  const audioContextRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<any[]>([]);
  
  const particleIdRef = useRef(0);

  const getModeTime = (mode: 'focus' | 'short' | 'long') => {
    if (mode === 'focus') return 25 * 60;
    if (mode === 'short') return 5 * 60;
    return 15 * 60;
  };

  useEffect(() => {
    setTimeLeft(getModeTime(timerMode));
    setIsRunning(false);
  }, [timerMode]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsRunning(false);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRunning]);

  // Handle synthesizers initialization and volume changes
  useEffect(() => {
    if (soundType !== 'none') {
      initAudioEngine();
    } else {
      stopSynthesizers();
    }
  }, [soundType]);

  // Update volume node directly
  useEffect(() => {
    if (mainGainRef.current) {
      // Scale down slightly for pure comfort
      mainGainRef.current.gain.setValueAtTime(volume * 0.7, audioContextRef.current?.currentTime || 0);
    }
  }, [volume]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopSynthesizers();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Confetti loop animation
  useEffect(() => {
    if (confetti.length === 0) return;

    const frame = requestAnimationFrame(() => {
      setConfetti((prevParticles) =>
        prevParticles
          .map((p) => ({
            ...p,
            x: p.x + Math.cos(p.angle) * p.speed,
            y: p.y + Math.sin(p.angle) * p.speed + 1.5,
            opacity: p.opacity - 0.015,
            spin: p.spin + 8
          }))
          .filter((p) => p.opacity > 0)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [confetti]);

  // ─── ADVANCED MEDITATION SYNTHESIZER ENGINE ─────────────────────────
  const initAudioEngine = () => {
    try {
      if (!audioContextRef.current) {
        // @ts-ignore
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Initialize Master Gain controller
      if (!mainGainRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = volume * 0.7;
        gain.connect(ctx.destination);
        mainGainRef.current = gain;
      }

      const mainGain = mainGainRef.current;
      stopSynthesizers();

      // 1. Binaural Theta Beats (Left: 140Hz, Right: 146Hz) -> Perfect for deep focus
      if (soundType === 'binaural') {
        const oscLeft = ctx.createOscillator();
        oscLeft.type = 'sine';
        oscLeft.frequency.value = 140; // Warm baseline

        const pannerLeft = ctx.createStereoPanner();
        pannerLeft.pan.value = -1.0; // Left ear

        const oscRight = ctx.createOscillator();
        oscRight.type = 'sine';
        oscRight.frequency.value = 146; // Theta 6Hz delta

        const pannerRight = ctx.createStereoPanner();
        pannerRight.pan.value = 1.0; // Right ear

        // Add a low warm sub-harmonic to make it feel deeply relaxing
        const subOsc = ctx.createOscillator();
        subOsc.type = 'triangle';
        subOsc.frequency.value = 70; // 70Hz octave drop
        const subGain = ctx.createGain();
        subGain.gain.value = 0.25;

        // Routing
        oscLeft.connect(pannerLeft);
        pannerLeft.connect(mainGain);

        oscRight.connect(pannerRight);
        pannerRight.connect(mainGain);

        subOsc.connect(subGain);
        subGain.connect(mainGain);

        oscLeft.start();
        oscRight.start();
        subOsc.start();

        activeNodesRef.current.push(oscLeft, oscRight, subOsc);
      }

      // 2. Zen Ocean Swells (Sweeping Pink Noise + Filter LFO) -> Perfect for calmness
      if (soundType === 'waves') {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.12;
          b6 = white * 0.115926;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Bandpass Filter with narrow resonance to create rolling waves
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 380;
        filter.Q.value = 1.8;

        // Very slow LFO for wave sweeps (approx 12 second rolling waves)
        const waveLfo = ctx.createOscillator();
        waveLfo.type = 'sine';
        waveLfo.frequency.value = 0.08; 

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 240; // Swells up and down between 140Hz and 620Hz

        // Connect
        waveLfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noiseSource.connect(filter);
        filter.connect(mainGain);

        noiseSource.start();
        waveLfo.start();

        activeNodesRef.current.push(noiseSource, waveLfo);
      }

      // 3. Tibetan Singing Bowls (Detuned resonance with organic gain swells) -> Deep meditation
      if (soundType === 'bowl') {
        const frequencies = [144, 288.4, 432.2, 576.8]; // Pure resonance scale (Golden ratio)
        const gains = [0.45, 0.28, 0.16, 0.08];
        const lfoSpeeds = [0.11, 0.07, 0.14, 0.06];

        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;

          const bowlGain = ctx.createGain();
          bowlGain.gain.value = gains[idx];

          // Slow slow tremolo sweep
          const lfo = ctx.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = lfoSpeeds[idx];

          const lfoGain = ctx.createGain();
          lfoGain.gain.value = gains[idx] * 0.42;

          lfo.connect(lfoGain);
          lfoGain.connect(bowlGain.gain);

          osc.connect(bowlGain);
          bowlGain.connect(mainGain);

          osc.start();
          lfo.start();

          activeNodesRef.current.push(osc, lfo);
        });
      }

    } catch (err) {
      console.error('Audio synthesis engine error:', err);
    }
  };

  const stopSynthesizers = () => {
    if (activeNodesRef.current.length > 0) {
      activeNodesRef.current.forEach((node) => {
        try {
          node.stop();
        } catch (e) {}
      });
      activeNodesRef.current = [];
    }
  };

  // Play synthetic focus completion alarm tone
  const playSynthesizedChime = () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 2.3);
    } catch (e) {}
  };

  // Timer complete
  const handleTimerComplete = async (isSkipped = false) => {
    playSynthesizedChime();
    
    if (timerMode === 'focus') {
      setTotalFocusSessions((p) => p + 1);
      setEarnedPoints(isSkipped ? 5 : 15);
      setCelebrate(true);
      triggerConfetti();

      try {
        // Log Pomodoro to backend to award points
        const res = await api.post('/api/student/pomodoro/complete', { skipped: isSkipped });
        toast.success(res.message || (isSkipped ? '🎉 Focus session skipped! +5 XP points awarded.' : '🎉 Focus session finished! +15 XP points awarded.'));
      } catch (err: any) {
        toast.error('Session logged, but failed to synchronize leaderboard points.');
      }
    } else {
      toast.success('Break finished! Ready to resume focus?');
    }
  };

  const triggerConfetti = () => {
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#a855f7', '#eab308', '#ec4899'];
    const newParticles: ConfettiParticle[] = [];

    for (let i = 0; i < 60; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: 50,
        y: 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 5,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 4 + 2.5,
        spin: Math.random() * 360,
        opacity: 1
      });
    }
    setConfetti(newParticles);
  };

  const handleSoundToggle = (type: 'none' | 'binaural' | 'waves' | 'bowl') => {
    if (soundType === type) {
      setSoundType('none');
    } else {
      setSoundType(type);
    }
  };

  // Format time display
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate circular SVG stroke dash offset
  const maxTime = getModeTime(timerMode);
  const percentage = (timeLeft / maxTime) * 100;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn(
        "dark relative min-h-[90vh] rounded-3xl p-6 md:p-10 overflow-hidden transition-all duration-1000 shadow-inner flex flex-col items-center justify-center border border-border/10",
        bgTheme === 'sunset' && "bg-gradient-to-tr from-rose-950/60 via-purple-950/50 to-zinc-950",
        bgTheme === 'space' && "bg-gradient-to-br from-indigo-950/60 via-zinc-950/60 to-black",
        bgTheme === 'rain' && "bg-gradient-to-b from-slate-900/60 via-cyan-950/40 to-zinc-950"
      )}
    >
      {/* ─── DYNAMIC CSS-ANIMATED AMBIENT ELEMENTS ─────────────────── */}
      {bgTheme === 'sunset' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute w-[500px] h-[500px] rounded-full bg-rose-500/5 blur-[120px] -top-32 -left-32 animate-pulse duration-[8s]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-orange-500/5 blur-[100px] -bottom-32 -right-32 animate-pulse duration-[6s] delay-1000" />
          {/* Dust particles floating up */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(244,63,94,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />
        </div>
      )}

      {bgTheme === 'space' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[150px] top-1/4 left-1/3 animate-pulse duration-[12s]" />
          {/* Twinkling star field */}
          <div className="stars absolute inset-0 opacity-40 bg-[radial-gradient(white_1px,transparent_0)] [background-size:32px_32px] animate-pulse" />
        </div>
      )}

      {bgTheme === 'rain' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute w-[450px] h-[450px] rounded-full bg-cyan-500/5 blur-[110px] -top-10 right-1/4 animate-pulse duration-[9s]" />
          {/* Falling Rain drops */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_bottom,rgba(165,243,252,0.1)_0%,rgba(165,243,252,0)_100%)] [background-size:2px_80px] bg-repeat-y" style={{ animation: 'rain-fall 1.2s linear infinite' }} />
        </div>
      )}

      {/* Confetti Explosion Canvas */}
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
              borderRadius: Math.random() > 0.5 ? '50%' : '1px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          />
        ))}
      </div>

      {/* Focus complete modal card overlay */}
      {celebrate && (
        <div className="absolute inset-0 z-40 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30 animate-bounce">
              <Award className="w-10 h-10" />
            </div>
            <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
          </div>

          <h3 className="text-2xl font-extrabold text-white font-heading mb-1.5">
            {earnedPoints === 5 ? 'Session Logged! ⏱️' : 'Focus Session Complete! 🌟'}
          </h3>
          <p className="text-zinc-400 max-w-sm text-sm mb-6 leading-relaxed">
            {earnedPoints === 5 ? (
              <>You skipped your deep study session, recorded 1 focus session, and earned <span className="text-emerald-400 font-bold">+5 Points</span>!</>
            ) : (
              <>Awesome! You finished <strong>25 minutes</strong> of deep study, recorded 1 focus session, and earned <span className="text-emerald-400 font-bold">+15 Points</span>!</>
            )}
          </p>

          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-lg shadow-emerald-500/20 rounded-xl"
            onClick={() => setCelebrate(false)}
          >
            Claim Points & Continue
          </Button>
        </div>
      )}

      {/* ─── VIRTUAL STUDY ROOM UI PANEL ───────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        
        {/* Left column: Theme select & Stats */}
        <div className="space-y-6">
          {/* Background themes panel */}
          <Card className="border-border/30 bg-card/25 backdrop-blur-md shadow-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-zinc-300 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-primary" /> Atmospheric Theme
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => setBgTheme('sunset')}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold text-center transition-all",
                    bgTheme === 'sunset'
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-300 font-black shadow-md shadow-rose-500/5"
                      : "bg-background/40 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <Sunset className="w-4 h-4" /> Sunset
                </button>
                <button
                  onClick={() => setBgTheme('space')}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold text-center transition-all",
                    bgTheme === 'space'
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 font-black shadow-md shadow-indigo-500/5"
                      : "bg-background/40 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <Compass className="w-4 h-4" /> Galaxy
                </button>
                <button
                  onClick={() => setBgTheme('rain')}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold text-center transition-all",
                    bgTheme === 'rain'
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-black shadow-md shadow-cyan-500/5"
                      : "bg-background/40 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <CloudRain className="w-4 h-4" /> Storm
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Stats tracker card */}
          <Card className="border-border/30 bg-card/25 backdrop-blur-md shadow-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-zinc-300 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-yellow-500" /> Study Dashboard
              </h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/20 border border-border/10">
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Completed Sessions</p>
                  <p className="text-2xl font-bold text-foreground font-heading mt-0.5">{totalFocusSessions}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 leading-relaxed bg-zinc-950/10 p-2.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span>Completing 1 focus Pomodoro session rewards you with <strong>+15 XP</strong>!</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center column: Circular SVG clock */}
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* SVG circle meter */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r={radius}
                className="stroke-zinc-800/40 fill-none"
                strokeWidth="10"
              />
              <circle
                cx="128"
                cy="128"
                r={radius}
                className={cn(
                  "fill-none transition-all duration-300 stroke-linecap-round",
                  timerMode === 'focus' && "stroke-rose-500",
                  timerMode === 'short' && "stroke-cyan-400",
                  timerMode === 'long' && "stroke-indigo-400"
                )}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            {/* Time reading */}
            <div className="absolute flex flex-col items-center text-center">
              <Badge className={cn("uppercase text-[9px] font-black tracking-widest border mb-1.5",
                timerMode === 'focus' && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                timerMode === 'short' && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                timerMode === 'long' && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
              )}>
                {timerMode === 'focus' && 'Focus Session'}
                {timerMode === 'short' && 'Short Break'}
                {timerMode === 'long' && 'Long Break'}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tight select-none">
                {formatTime(timeLeft)}
              </h1>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase font-bold tracking-wider">
                {isRunning ? 'Studying deep...' : 'Paused'}
              </p>
            </div>
          </div>

          {/* Clock controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTimeLeft(getModeTime(timerMode))}
              className="h-10 w-10 bg-background/30 border-border/30 hover:bg-background/80 rounded-xl"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4 text-zinc-300" />
            </Button>

            <Button
              className={cn(
                "h-12 px-8 font-black font-heading rounded-xl text-white shadow-xl hover:scale-105 transition-all",
                timerMode === 'focus' && "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10",
                timerMode === 'short' && "bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/10",
                timerMode === 'long' && "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
              )}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isRunning ? 'Pause' : 'Start Focus'}
            </Button>

            {/* Quick skip */}
            <Button
              variant="outline"
              className="h-10 text-xs px-4 bg-background/30 border-border/30 hover:bg-background/80 rounded-xl text-zinc-300"
              onClick={() => handleTimerComplete(true)}
              title="Trigger focus completed manually (for validation testing!)"
            >
              Skip
            </Button>
          </div>
        </div>

        {/* Right column: Audio synthesis cassette deck */}
        <div className="space-y-6">
          <Card className="border-border/30 bg-card/25 backdrop-blur-md shadow-2xl overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-zinc-300 text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-primary" /> Meditative Ambient Sounds
              </h3>
              
              {/* White noise channels toggles */}
              <div className="space-y-2">
                <button
                  onClick={() => handleSoundToggle('binaural')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    soundType === 'binaural'
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-sm"
                      : "bg-background/30 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Disc className="w-4 h-4 text-rose-400 animate-spin" style={{ animationDuration: '6s' }} /> Binaural Theta Beats
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] border px-1.5",
                    soundType === 'binaural' ? "border-rose-500/30 text-rose-400" : "border-zinc-800 text-zinc-500"
                  )}>
                    {soundType === 'binaural' ? 'ACTIVE' : 'MUTED'}
                  </Badge>
                </button>

                <button
                  onClick={() => handleSoundToggle('waves')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    soundType === 'waves'
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-sm"
                      : "bg-background/30 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Waves className="w-4 h-4 text-cyan-400 animate-pulse" /> Zen Ocean Swells
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] border px-1.5",
                    soundType === 'waves' ? "border-cyan-500/30 text-cyan-400" : "border-zinc-800 text-zinc-500"
                  )}>
                    {soundType === 'waves' ? 'ACTIVE' : 'MUTED'}
                  </Badge>
                </button>

                <button
                  onClick={() => handleSoundToggle('bowl')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    soundType === 'bowl'
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm"
                      : "bg-background/30 border-transparent text-zinc-400 hover:bg-background/80"
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" style={{ animationDuration: '3s' }} /> Tibetan Singing Bowl
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] border px-1.5",
                    soundType === 'bowl' ? "border-amber-500/30 text-amber-400" : "border-zinc-800 text-zinc-500"
                  )}>
                    {soundType === 'bowl' ? 'ACTIVE' : 'MUTED'}
                  </Badge>
                </button>
              </div>

              {/* Volume Slider controller */}
              <div className="pt-2 border-t border-border/10 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-400">
                  <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Sound Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Mode switch helper buttons below slider */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/10">
                <Button
                  variant="ghost"
                  className={cn("h-7 text-[10px] px-0 rounded-lg font-bold", timerMode === 'focus' ? "text-rose-400" : "text-zinc-500")}
                  onClick={() => setTimerMode('focus')}
                >
                  Focus (25m)
                </Button>
                <Button
                  variant="ghost"
                  className={cn("h-7 text-[10px] px-0 rounded-lg font-bold", timerMode === 'short' ? "text-cyan-400" : "text-zinc-500")}
                  onClick={() => setTimerMode('short')}
                >
                  Short (5m)
                </Button>
                <Button
                  variant="ghost"
                  className={cn("h-7 text-[10px] px-0 rounded-lg font-bold", timerMode === 'long' ? "text-indigo-400" : "text-zinc-500")}
                  onClick={() => setTimerMode('long')}
                >
                  Long (15m)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
