import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Pencil, Eraser, Highlighter, Square, Circle, Triangle, ArrowRight,
  Minus, Type, Undo, Redo, Trash2, Download, Save, FolderOpen,
  Grid, Maximize2, Minimize2, Check, Sparkles, Loader2, RefreshCw
} from 'lucide-react';
import {
  getWhiteboards, saveWhiteboard, deleteWhiteboard, WhiteboardDoc
} from '@/lib/services/whiteboardService';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'text';

interface CanvasElement {
  id: string;
  type: Tool;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  color: string;
  width: number;
  text?: string;
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'
];

const STROKE_WIDTHS = [2, 4, 8, 14, 22];

export default function WhiteboardPage() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tool settings
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#3b82f6');
  const [currentWidth, setCurrentWidth] = useState<number>(4);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Drawing state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; value: string }>({
    x: 0, y: 0, visible: false, value: ''
  });

  // Cloud Save & Library
  const [boardTitle, setBoardTitle] = useState<string>('Untitled Lesson Board');
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [savedBoards, setSavedBoards] = useState<WhiteboardDoc[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [showLibraryDialog, setShowLibraryDialog] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingBoards, setLoadingBoards] = useState<boolean>(false);

  // Canvas resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      redrawCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redraw Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw math grid if active
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.12)';
      ctx.lineWidth = 1;
      const gridSize = 25;

      for (let x = 0; x < rect.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (let y = 0; y < rect.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render all elements
    const allElements = currentElement ? [...elements, currentElement] : elements;

    allElements.forEach((el) => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = el.width * 2.5;
      } else if (el.type === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = el.width * 3;
      }

      if (el.type === 'pen' || el.type === 'highlighter' || el.type === 'eraser') {
        if (el.points && el.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(el.startX || 0, el.startY || 0);
        ctx.lineTo(el.endX || 0, el.endY || 0);
        ctx.stroke();
      } else if (el.type === 'arrow') {
        const sx = el.startX || 0;
        const sy = el.startY || 0;
        const ex = el.endX || 0;
        const ey = el.endY || 0;
        const headlen = 14;
        const angle = Math.atan2(ey - sy, ex - sx);

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (el.type === 'rect') {
        const w = (el.endX || 0) - (el.startX || 0);
        const h = (el.endY || 0) - (el.startY || 0);
        ctx.strokeRect(el.startX || 0, el.startY || 0, w, h);
      } else if (el.type === 'circle') {
        const rx = ((el.endX || 0) - (el.startX || 0)) / 2;
        const ry = ((el.endY || 0) - (el.startY || 0)) / 2;
        const cx = (el.startX || 0) + rx;
        const cy = (el.startY || 0) + ry;

        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'triangle') {
        const sx = el.startX || 0;
        const sy = el.startY || 0;
        const ex = el.endX || 0;
        const ey = el.endY || 0;

        ctx.beginPath();
        ctx.moveTo((sx + ex) / 2, sy);
        ctx.lineTo(sx, ey);
        ctx.lineTo(ex, ey);
        ctx.closePath();
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.font = `bold ${Math.max(el.width * 4, 16)}px Inter, sans-serif`;
        ctx.fillText(el.text, el.startX || 0, el.startY || 0);
      }

      ctx.restore();
    });
  }, [elements, currentElement, showGrid]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer event helpers
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoordinates(e);

    if (currentTool === 'text') {
      setTextInput({ x, y, visible: true, value: '' });
      return;
    }

    setIsDrawing(true);
    const newEl: CanvasElement = {
      id: `el_${Date.now()}`,
      type: currentTool,
      points: [{ x, y }],
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      color: currentColor,
      width: currentWidth,
    };
    setCurrentElement(newEl);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;
    const { x, y } = getCoordinates(e);

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      setCurrentElement(prev => prev ? {
        ...prev,
        points: [...(prev.points || []), { x, y }]
      } : null);
    } else {
      setCurrentElement(prev => prev ? {
        ...prev,
        endX: x,
        endY: y
      } : null);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    const updated = [...elements, currentElement];
    setElements(updated);
    setCurrentElement(null);

    // Push to undo history
    const nextHistory = history.slice(0, historyStep + 1);
    setHistory([...nextHistory, updated]);
    setHistoryStep(nextHistory.length);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyStep > 0) {
      setHistoryStep(prev => prev - 1);
      setElements(history[historyStep - 1]);
    } else if (historyStep === 0) {
      setHistoryStep(-1);
      setElements([]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(prev => prev + 1);
      setElements(history[historyStep + 1]);
    }
  };

  const handleClear = () => {
    if (elements.length === 0) return;
    if (confirm('Clear the entire whiteboard?')) {
      const nextHistory = history.slice(0, historyStep + 1);
      setHistory([...nextHistory, []]);
      setHistoryStep(nextHistory.length);
      setElements([]);
    }
  };

  // Text submit
  const handleAddText = () => {
    if (!textInput.value.trim()) {
      setTextInput(p => ({ ...p, visible: false }));
      return;
    }
    const newEl: CanvasElement = {
      id: `el_${Date.now()}`,
      type: 'text',
      startX: textInput.x,
      startY: textInput.y,
      color: currentColor,
      width: currentWidth,
      text: textInput.value.trim()
    };
    const updated = [...elements, newEl];
    setElements(updated);
    setTextInput({ x: 0, y: 0, visible: false, value: '' });

    const nextHistory = history.slice(0, historyStep + 1);
    setHistory([...nextHistory, updated]);
    setHistoryStep(nextHistory.length);
  };

  // Export handlers
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `${boardTitle.replace(/\s+/g, '_')}.png`;
    a.click();
    toast.success('Whiteboard exported as PNG!');
  };

  const handleExportPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    doc.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height);
    doc.save(`${boardTitle.replace(/\s+/g, '_')}.pdf`);
    toast.success('Whiteboard exported as PDF!');
  };

  // Cloud Save
  const handleSaveToCloud = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const canvas = canvasRef.current;
      const preview = canvas ? canvas.toDataURL('image/jpeg', 0.5) : undefined;

      const boardId = await saveWhiteboard({
        id: currentBoardId || undefined,
        title: boardTitle,
        elements,
        previewDataUrl: preview,
        authorId: user.id as string,
        authorName: user.fullName || user.name || 'Teacher',
        isShared: true,
      });

      setCurrentBoardId(boardId);
      setShowSaveDialog(false);
      toast.success('Whiteboard saved to Cloud Library!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save whiteboard');
    } finally {
      setSaving(false);
    }
  };

  // Open Board Library
  const handleOpenLibrary = async () => {
    try {
      setLoadingBoards(true);
      setShowLibraryDialog(true);
      const boards = await getWhiteboards(user?.id as string);
      setSavedBoards(boards);
    } catch (err: any) {
      toast.error('Failed to load saved boards');
    } finally {
      setLoadingBoards(false);
    }
  };

  const handleLoadBoard = (board: WhiteboardDoc) => {
    setBoardTitle(board.title);
    setCurrentBoardId(board.id);
    setElements(board.elements || []);
    setHistory([board.elements || []]);
    setHistoryStep(0);
    setShowLibraryDialog(false);
    toast.success(`Loaded "${board.title}"`);
  };

  const handleDeleteSavedBoard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this saved whiteboard?')) return;
    try {
      await deleteWhiteboard(id);
      setSavedBoards(prev => prev.filter(b => b.id !== id));
      if (currentBoardId === id) setCurrentBoardId(null);
      toast.success('Whiteboard deleted');
    } catch (err: any) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-[calc(100vh-6.5rem)] space-y-3",
      isFullscreen && "fixed inset-0 z-50 bg-background p-4 h-screen"
    )}>
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card/70 backdrop-blur-md shadow-sm">
        {/* Title & Saved indicator */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Input
            value={boardTitle}
            onChange={e => setBoardTitle(e.target.value)}
            className="h-8 font-heading font-semibold text-sm max-w-[240px] bg-transparent border-transparent hover:border-border focus:border-primary"
            placeholder="Board title..."
          />
          {currentBoardId && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Synced
            </Badge>
          )}
        </div>

        {/* Primary Tool Buttons */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
          {[
            { id: 'pen', icon: Pencil, label: 'Pen' },
            { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
            { id: 'eraser', icon: Eraser, label: 'Eraser' },
            { id: 'line', icon: Minus, label: 'Line' },
            { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
            { id: 'rect', icon: Square, label: 'Rectangle' },
            { id: 'circle', icon: Circle, label: 'Circle' },
            { id: 'triangle', icon: Triangle, label: 'Triangle' },
            { id: 'text', icon: Type, label: 'Text' },
          ].map(tool => {
            const Icon = tool.icon;
            const isActive = currentTool === tool.id;
            return (
              <Button
                key={tool.id}
                variant={isActive ? "default" : "ghost"}
                size="icon"
                className={cn("h-8 w-8 rounded-lg", isActive && "shadow-sm")}
                onClick={() => setCurrentTool(tool.id as Tool)}
                title={tool.label}
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}
        </div>

        {/* Color Palette & Stroke Size */}
        <div className="flex items-center gap-2">
          {/* Color Selector */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border">
            {COLORS.slice(0, 7).map(c => (
              <button
                key={c}
                type="button"
                className={cn(
                  "w-5 h-5 rounded-full border border-black/10 transition-transform",
                  currentColor === c && "scale-125 ring-2 ring-primary ring-offset-1"
                )}
                style={{ backgroundColor: c }}
                onClick={() => setCurrentColor(c)}
              />
            ))}
            <input
              type="color"
              value={currentColor}
              onChange={e => setCurrentColor(e.target.value)}
              className="w-5 h-5 rounded-full cursor-pointer bg-transparent border-0"
              title="Custom Color"
            />
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border">
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                type="button"
                className={cn(
                  "h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                  currentWidth === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setCurrentWidth(w)}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: Math.max(w / 2, 3), height: Math.max(w / 2, 3) }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls (Undo, Redo, Grid, Clear, Save, Export) */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={historyStep < 0}
            onClick={handleUndo}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={historyStep >= history.length - 1}
            onClick={handleRedo}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </Button>
          <Button
            variant={showGrid ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowGrid(g => !g)}
            title="Toggle Math Grid"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={handleClear}
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={handleOpenLibrary}
          >
            <FolderOpen className="w-3.5 h-3.5" /> Library
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="w-3.5 h-3.5" /> Save
          </Button>

          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1 text-xs shadow-sm"
            onClick={handleExportPNG}
          >
            <Download className="w-3.5 h-3.5" /> Export PNG
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? "Exit Fullscreen" : "Presenter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-card rounded-2xl border border-border shadow-inner overflow-hidden cursor-crosshair touch-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0"
        />

        {/* Text Tool Overlay Input */}
        {textInput.visible && (
          <div
            className="absolute z-20"
            style={{ left: textInput.x, top: textInput.y }}
          >
            <div className="flex items-center gap-1 p-1 bg-card border border-primary rounded-lg shadow-xl">
              <Input
                autoFocus
                placeholder="Type note..."
                value={textInput.value}
                onChange={e => setTextInput(p => ({ ...p, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddText();
                  if (e.key === 'Escape') setTextInput(p => ({ ...p, visible: false }));
                }}
                className="h-7 text-xs w-48"
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddText}>
                <Check className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Save Board Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-heading">Save Whiteboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Board Title</label>
            <Input
              value={boardTitle}
              onChange={e => setBoardTitle(e.target.value)}
              placeholder="e.g. Calculus Derivatives Lesson"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveToCloud} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save to Cloud Library'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Boards Library Dialog */}
      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Whiteboard Library
            </DialogTitle>
          </DialogHeader>

          {loadingBoards ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
              <p>Loading saved boards...</p>
            </div>
          ) : savedBoards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              <Pencil className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No saved whiteboards found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {savedBoards.map(board => (
                <Card
                  key={board.id}
                  onClick={() => handleLoadBoard(board)}
                  className="cursor-pointer group hover:border-primary transition-all overflow-hidden border-border bg-muted/20"
                >
                  <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden border-b border-border">
                    {board.previewDataUrl ? (
                      <img src={board.previewDataUrl} alt={board.title} className="w-full h-full object-cover" />
                    ) : (
                      <Pencil className="w-8 h-8 text-muted-foreground/40" />
                    )}
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
                      onClick={e => handleDeleteSavedBoard(e, board.id)}
                      title="Delete Board"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{board.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">By {board.authorName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
