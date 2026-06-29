// src/components/dashboard/MaterialViewer.tsx
// Renders any uploaded material natively in-browser in its original format.
// Files on the server are served directly via the public /uploads static route —
// Express sets the correct Content-Type from the file extension automatically,
// so the browser renders PDF as PDF, images as images, video as video, etc.
// No HTML conversion, no forced download.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, Loader2, Download, Maximize, Minimize } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Material {
  id: number;
  type: string;
  fileName?: string;
  title?: string;
  filePath?: string;
  fileUrl?: string;
  externalUrl?: string;
  textContent?: string;
  description?: string;
}

interface Props {
  material: Material | null;
  open: boolean;
  onClose: () => void;
}

// ── MIME type map (file extension → MIME) ──────────────────────────────────
const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

// ── Build the best URL for a material ────────────────────────────────────
// For server-stored files: use the direct public /uploads URL — Express static
// automatically sends the correct Content-Type header based on file extension.
// This is the critical fix: avoid fetching + re-blobbing which strips the MIME type.
function getDirectUrl(material: Material): string {
  const path = material.fileUrl || material.externalUrl || material.filePath || '';
  if (!path || path === 'text-content') return '';
  if (path.startsWith('http')) return path; // already an absolute external URL
  // Normalise: strip leading slash if present, then prepend API_BASE
  const clean = path.replace(/^\/+/, '');
  return `${API_BASE}/${clean}`;
}

// ── YouTube / Vimeo helpers ───────────────────────────────────────────────
function isYouTube(url: string) { return url.includes('youtube.com') || url.includes('youtu.be'); }
function isVimeo(url: string) { return url.includes('vimeo.com'); }
function youtubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url;
}
function vimeoEmbed(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
}

// ── Main component ────────────────────────────────────────────────────────
export default function MaterialViewer({ material, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset loading state whenever we open a new file
  useEffect(() => {
    if (open && material) setLoading(true);
  }, [open, material?.id]);

  // Auto-enter fullscreen when a video opens
  useEffect(() => {
    if (!open || !material) return;
    const t = material.type?.toUpperCase();
    if (t !== 'VIDEO') return;
    // slight delay so the dialog has rendered
    const timer = setTimeout(() => {
      const el = containerRef.current;
      if (el && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, material?.id]);

  // Track fullscreen state changes (user pressed Escape, etc.)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  if (!material) return null;

  const name   = material.title || material.fileName || 'File';
  const type   = (material.type || '').toUpperCase();
  const rawPath = material.fileUrl || material.externalUrl || material.filePath || '';
  const directUrl = getDirectUrl(material);

  // ── Render the appropriate viewer ──
  // ── Render the appropriate viewer ──
  const renderContent = () => {

    // ── TEXT ── render readable prose directly in-page
    if (type === 'TEXT') return (
      <div className="p-6 h-full overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground bg-muted/30 rounded-xl p-5 border border-border">
          {material.textContent || '(No text content)'}
        </pre>
      </div>
    );

    // ── IMAGE ── native <img> — browser renders original format (PNG/JPEG/GIF/WebP etc.)
    if (type === 'IMAGE') return (
      <div className="flex items-center justify-center p-4 bg-muted/10 h-full overflow-auto">
        <img
          src={directUrl}
          alt={name}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          className="max-w-full max-h-full object-contain rounded-lg shadow-md"
        />
      </div>
    );

    // ── AUDIO ── native <audio> — browser uses original format (MP3/WAV/AAC etc.)
    if (type === 'AUDIO') return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-4xl select-none animate-pulse">🎵</div>
        <p className="font-semibold text-foreground text-sm">{name}</p>
        <audio
          controls
          className="w-full max-w-md mt-2"
          src={directUrl}
          onCanPlay={() => setLoading(false)}
          onError={() => setLoading(false)}
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );

    // ── VIDEO ── YouTube / Vimeo iframe embed, or native <video>
    if (type === 'VIDEO') {
      if (isYouTube(rawPath)) return (
        <iframe
          src={youtubeEmbed(rawPath) + '&autoplay=1'}
          className="w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={name}
          onLoad={() => setLoading(false)}
        />
      );
      if (isVimeo(rawPath)) return (
        <iframe
          src={vimeoEmbed(rawPath) + '?autoplay=1'}
          className="w-full h-full border-none"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={name}
          onLoad={() => setLoading(false)}
        />
      );
      // Local video file — served directly, browser plays in original format
      return (
        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full h-full bg-black object-contain"
          src={directUrl}
          onCanPlay={() => setLoading(false)}
          onError={() => setLoading(false)}
        >
          Your browser does not support the video element.
        </video>
      );
    }

    // ── PDF ── browser-native PDF viewer via <iframe>
    // The key: Express static sends Content-Type: application/pdf from the file extension.
    // The browser's built-in PDF viewer intercepts this and renders it as PDF, not HTML.
    if (type === 'PDF') return (
      <iframe
        ref={iframeRef}
        src={`${directUrl}#toolbar=1&navpanes=1&view=FitH`}
        className="w-full h-full"
        title={name}
        onLoad={() => setLoading(false)}
      />
    );

    // ── WORD / EXCEL / PowerPoint ──
    // If it's an external/public URL: use Microsoft Office Online viewer (renders natively).
    // If it's a local server file: offer a direct open link (browsers can't render .docx natively).
    if (type === 'WORD' || type === 'EXCEL' || type === 'POWERPOINT') {
      if (rawPath.startsWith('http')) {
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(rawPath)}`;
        return (
          <iframe
            src={officeUrl}
            className="w-full h-full"
            title={name}
            onLoad={() => setLoading(false)}
          />
        );
      }
      // Local file — cannot be sent to Office Online; offer direct download instead
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="text-5xl select-none animate-bounce">
            {type === 'EXCEL' ? '📊' : type === 'POWERPOINT' ? '📑' : '📄'}
          </div>
          <p className="font-semibold text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Office documents stored on the server cannot be previewed inline —
            open in Microsoft Office or LibreOffice.
          </p>
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg"
          >
            <Download className="w-4 h-4" /> Open / Download
          </a>
        </div>
      );
    }

    // ── Fallback — unknown type ──
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-sm space-y-3">
        <p>Preview not available for this file type.</p>
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:underline font-semibold"
        >
          <ExternalLink className="w-4 h-4" /> Open File
        </a>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden border-border bg-card rounded-2xl shadow-2xl">
        <div ref={containerRef} className="flex flex-col h-[80vh] bg-card">
          {/* Header */}
          <DialogHeader className="p-4 pb-3 border-b border-border bg-muted/20 flex flex-row items-center gap-3 shrink-0">
            <DialogTitle className="flex-1 text-base font-bold truncate">{name}</DialogTitle>
            {/* Type badge */}
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
              {type}
            </span>
            {/* Fullscreen toggle for videos */}
            {type === 'VIDEO' && (
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                {isFullscreen
                  ? <Minimize className="w-3.5 h-3.5" />
                  : <Maximize className="w-3.5 h-3.5" />}
              </button>
            )}
            {/* Direct open link */}
            {directUrl && (
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </DialogHeader>

          {/* Loading spinner — shown until the iframe/media fires onLoad */}
          {loading && type !== 'TEXT' && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10 pointer-events-none">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          <div className="flex-1 min-h-0 relative">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
