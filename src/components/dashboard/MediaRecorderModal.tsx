import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Mic, Video, Square, Play, Pause, RotateCcw,
  CheckCircle, Loader2, Volume2, Sparkles, Radio, Download
} from 'lucide-react';
import { createMaterial } from '@/lib/services/contentService';
import { getCourses, getTopics, CourseDoc, TopicDoc } from '@/lib/services/academicService';
import { createNote } from '@/lib/services/contentService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultTopicId?: string;
  saveMode?: 'material' | 'note';
}

export default function MediaRecorderModal({ isOpen, onClose, onSaved, defaultTopicId, saveMode = 'material' }: Props) {
  const { user } = useAuth();
  const [recordType, setRecordType] = useState<'audio' | 'video'>('audio');
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'review'>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [topicId, setTopicId] = useState<string>(defaultTopicId || '');
  const [isGlobal, setIsGlobal] = useState<boolean>(false);
  const [topics, setTopics] = useState<any[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  // Hardware Media Stream Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Audio Visualizer Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Fetch topics for curriculum attachment
  useEffect(() => {
    if (saveMode === 'material') {
      getCourses().then(async (courses) => {
        const all: any[] = [];
        for (const c of courses) {
          const tops = await getTopics(c.id);
          tops.forEach(t => all.push({ ...t, courseName: c.title }));
        }
        setTopics(all);
      }).catch(() => {});
    }
  }, [saveMode]);

  // Clean up streams on close
  useEffect(() => {
    if (!isOpen) {
      cleanupStreams();
      resetState();
    }
  }, [isOpen]);

  const cleanupStreams = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetState = () => {
    setRecordingState('idle');
    setDuration(0);
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setTitle('');
    setDescription('');
  };

  // Start Recording
  const startRecording = async () => {
    try {
      chunksRef.current = [];
      const constraints: MediaStreamConstraints = recordType === 'video'
        ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Attach video preview if video mode
      if (recordType === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      // Start Audio Frequency Visualizer
      setupAudioVisualizer(stream);

      // Initialize MediaRecorder with best supported mime
      const mimeType = recordType === 'video'
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg');

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: recordType === 'video' ? 'video/webm' : 'audio/webm'
        });
        setRecordedBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setPreviewUrl(url);
        setRecordingState('review');
      };

      recorder.start(250); // collect 250ms chunks
      setRecordingState('recording');
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Recording initialization error:', err);
      toast.error(err.message || 'Could not access microphone/camera. Please grant permissions.');
    }
  };

  // Setup Audio Waveform Visualizer
  const setupAudioVisualizer = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = visualizerCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = `rgba(99, 102, 241, ${0.4 + (dataArray[i] / 255) * 0.6})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.error('Visualizer setup error:', e);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop();
      cleanupStreams();
    }
  };

  // Convert Blob to Base64 Data URL for persistent in-browser streaming & Firestore storage
  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Save to Curriculum or Notes
  const handleSaveRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordedBlob || !user) return;
    if (!title.trim()) return toast.error('Please enter a title for the recording');

    try {
      setSaving(true);
      const dataUrl = await blobToDataURL(recordedBlob);

      if (saveMode === 'material') {
        if (!isGlobal && !topicId) {
          toast.error('Please select a target topic/module or mark as global');
          return;
        }

        await createMaterial({
          title: title.trim(),
          type: recordType === 'video' ? 'VIDEO' : 'AUDIO',
          fileUrl: dataUrl,
          description: description.trim() || `Recorded ${recordType} note (${formatTime(duration)})`,
          topicId: isGlobal ? undefined : topicId,
          isGlobal,
        });

        toast.success(`Voice/Video lesson "${title}" added to curriculum!`);
      } else {
        // Save as Personal Note with media attachment
        await createNote({
          title: title.trim(),
          content: description.trim() || `Recorded ${recordType} note (${formatTime(duration)})`,
          userId: String(user.id),
          authorName: user.fullName || user.name || 'Author',
          category: recordType === 'video' ? 'Video Memo' : 'Voice Memo',
          notebook: 'Voice & Video Memos',
          mediaUrl: dataUrl,
          mediaType: recordType,
          duration: duration,
          isShared: false,
        });

        toast.success(`${recordType === 'video' ? 'Video' : 'Voice'} memo "${title}" saved to personal notes!`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save recording');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold font-heading flex items-center gap-2">
              {recordType === 'audio' ? <Mic className="w-5 h-5 text-primary" /> : <Video className="w-5 h-5 text-primary" />}
              Studio Recorder
            </DialogTitle>
            {/* Mode Switcher */}
            {recordingState === 'idle' && (
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
                <Button
                  type="button"
                  variant={recordType === 'audio' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setRecordType('audio')}
                >
                  <Mic className="w-3.5 h-3.5" /> Audio
                </Button>
                <Button
                  type="button"
                  variant={recordType === 'video' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setRecordType('video')}
                >
                  <Video className="w-3.5 h-3.5" /> Video
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Recording & Preview Viewport */}
          <div className="relative aspect-video rounded-2xl bg-muted/40 border border-border overflow-hidden flex flex-col items-center justify-center">
            {recordingState === 'review' && previewUrl ? (
              recordType === 'video' ? (
                <video src={previewUrl} controls className="w-full h-full object-contain bg-black" />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 space-y-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Volume2 className="w-8 h-8 animate-pulse" />
                  </div>
                  <p className="font-heading font-semibold text-lg">Audio Recording Ready ({formatTime(duration)})</p>
                  <audio src={previewUrl} controls className="w-full max-w-sm" />
                </div>
              )
            ) : recordType === 'video' ? (
              <video
                ref={videoPreviewRef}
                muted
                playsInline
                className={cn(
                  "w-full h-full object-cover",
                  recordingState === 'idle' && "hidden"
                )}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 space-y-3 w-full">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                  recordingState === 'recording' ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-primary/10 text-primary"
                )}>
                  <Mic className="w-8 h-8" />
                </div>
                {/* Waveform Canvas */}
                <canvas
                  ref={visualizerCanvasRef}
                  width={240}
                  height={40}
                  className="w-60 h-10 rounded-lg"
                />
              </div>
            )}

            {/* Live Timer Badge */}
            {(recordingState === 'recording' || recordingState === 'paused') && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-mono">
                <div className={cn("w-2.5 h-2.5 rounded-full bg-red-500", recordingState === 'recording' && "animate-ping")} />
                {formatTime(duration)}
                {recordingState === 'paused' && <span className="text-yellow-400 font-sans">(PAUSED)</span>}
              </div>
            )}
          </div>

          {/* Recording Controls Bar */}
          <div className="flex items-center justify-center gap-3">
            {recordingState === 'idle' && (
              <Button
                type="button"
                size="lg"
                className="gap-2 bg-red-600 hover:bg-red-700 text-white rounded-full px-8 shadow-lg shadow-red-600/20"
                onClick={startRecording}
              >
                <Radio className="w-4 h-4" /> Start Recording
              </Button>
            )}

            {recordingState === 'recording' && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={pauseRecording} className="gap-1 rounded-full">
                  <Pause className="w-4 h-4" /> Pause
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-1 rounded-full px-6">
                  <Square className="w-4 h-4" /> Stop Recording
                </Button>
              </>
            )}

            {recordingState === 'paused' && (
              <>
                <Button type="button" variant="default" size="sm" onClick={resumeRecording} className="gap-1 rounded-full">
                  <Play className="w-4 h-4" /> Resume
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-1 rounded-full px-6">
                  <Square className="w-4 h-4" /> Stop & Finish
                </Button>
              </>
            )}

            {recordingState === 'review' && (
              <Button type="button" variant="outline" size="sm" onClick={resetState} className="gap-1.5 rounded-full text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Re-record
              </Button>
            )}
          </div>

          {/* Details Form for Saving */}
          {recordingState === 'review' && (
            <form onSubmit={handleSaveRecording} className="space-y-4 pt-4 border-t border-border animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`e.g. Chapter 4 Oral Summary`}
                  required
                />
              </div>

              {saveMode === 'material' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label>Target Topic / Module</Label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isGlobal}
                          onChange={e => { setIsGlobal(e.target.checked); setTopicId(''); }}
                          className="rounded border-border"
                        />
                        <span>Global Resource</span>
                      </label>
                    </div>
                    <Select disabled={isGlobal} value={topicId} onValueChange={setTopicId}>
                      <SelectTrigger><SelectValue placeholder={isGlobal ? "N/A (Global Resource)" : "Select topic"} /></SelectTrigger>
                      <SelectContent>
                        {topics.map(t => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.courseName} › {t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Description / Note (Optional)</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Key pointers covered in this recording..."
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={onClose}>Discard</Button>
                <Button type="submit" disabled={saving} className="gap-2 shadow-lg shadow-primary/20">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Save to {saveMode === 'material' ? 'Curriculum' : 'Notebook'}</>}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
