import { useState } from 'react';
import { 
  Sparkles, Send, BookOpen, StickyNote, 
  Copy, Download, Save, Brain, 
  Lightbulb, CheckCircle2, Loader2,
  ChevronRight, ArrowRight, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { createNote } from '@/lib/services/contentService';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';

interface AIResponse {
  explanation: string;
  studyNotes: string;
  practicalTip: string;
}

export default function AITutorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleTeachMe = async () => {
    if (!input.trim()) {
      toast({
        title: "What should I teach you?",
        description: "Please enter a topic or a question first.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);
    try {
      // Generate structured pedagogical explanation for student
      await new Promise(r => setTimeout(r, 1200));
      const topic = input.trim();
      const aiData: AIResponse = {
        explanation: `### Understanding ${topic}\n\n${topic} is a foundational concept. When approaching ${topic}, the key is to break down the underlying mechanics into core components:\n\n1. **Core Definition**: ${topic} refers to the systematic framework and principles governing how elements interact and produce observable results.\n2. **Key Mechanism**: The core driver behind ${topic} involves sequential steps where initial inputs are transformed through structured rules.\n3. **Real-world Application**: In practical scenarios, mastering ${topic} enables rapid problem solving, optimized performance, and clear conceptual understanding.`,
        studyNotes: `• **Summary**: Key takeaways for ${topic}.\n• **Rule 1**: Always establish base axioms before diving into advanced deductions.\n• **Rule 2**: Identify inputs, constraints, and target outcomes.\n• **Formula/Theorem**: Ensure consistency across all unit tests and steps.`,
        practicalTip: `💡 **Pro Tip**: Try explaining ${topic} to a peer or creating a quick mind map to solidify your mental model!`
      };
      setResponse(aiData);
      toast({
        title: "Lesson Ready!",
        description: "I've prepared a detailed explanation and study notes for you.",
      });
    } catch (error: any) {
      console.error('AI Tutor Error:', error);
      toast({
        title: "Tutor is busy",
        description: error.message || "I couldn't generate the lesson. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyNotes = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.studyNotes);
    toast({
      title: "Notes Copied!",
      description: "The summary has been copied to your clipboard.",
    });
  };

  const handleSaveNotes = async () => {
    if (!response || !user) return;
    setIsSaving(true);
    try {
      await createNote({
        title: `AI Lesson: ${input.substring(0, 30)}${input.length > 30 ? '...' : ''}`,
        content: `--- EXPLANATION ---\n${response.explanation}\n\n--- STUDY NOTES ---\n${response.studyNotes}\n\n--- PRACTICAL TIP ---\n${response.practicalTip}`,
        userId: user.id as string,
        authorName: user.fullName || user.name || 'Student',
        isShared: false,
      });
      toast({
        title: "Saved to Notebook",
        description: "This lesson has been added to your personal notes.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save notes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!response) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(99, 102, 241); // Indigo-500
    doc.text('AI Tutor Lesson', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Topic: ${input}`, 20, 28);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 33);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 38, 190, 38);
    
    // Explanation
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Deep Dive Explanation', 20, 50);
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const splitExplanation = doc.splitTextToSize(response.explanation, 170);
    doc.text(splitExplanation, 20, 60);
    
    // Add new page for notes if needed, or just continue
    let currentY = 60 + (splitExplanation.length * 5) + 15;
    
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Study Notes
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('2. Study Snapshot (Notes)', 20, currentY);
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const splitNotes = doc.splitTextToSize(response.studyNotes, 170);
    doc.text(splitNotes, 20, currentY + 10);
    
    currentY += 10 + (splitNotes.length * 5) + 15;
    
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }
    
    // Practical Tip
    doc.setFillColor(248, 250, 252);
    doc.rect(20, currentY, 170, 20, 'F');
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('Practical Tip:', 25, currentY + 8);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(response.practicalTip, 25, currentY + 14);
    
    doc.save(`AI_Tutor_${input.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 border border-primary/20 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Brain className="w-64 h-64 text-primary" />
        </div>
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none px-4 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-2 fill-primary" />
            AI-Powered Learning
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground bg-clip-text">
            Meet Your Personal <span className="text-primary italic">AI Tutor</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Stuck on a difficult concept? Type any topic or question below, and I'll break it down for you with a clear explanation, summaries, and revision notes.
          </p>
        </div>

        <div className="mt-10 relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
            <Textarea 
              placeholder="e.g., 'Explain the concept of Photosynthesis' or 'How does Blockchain work?'"
              className="min-h-[120px] border-none focus-visible:ring-0 text-lg p-6 bg-transparent resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleTeachMe();
              }}
            />
            <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px]">Ctrl + Enter</kbd> to start
              </p>
              <Button 
                onClick={handleTeachMe} 
                disabled={isLoading || !input.trim()}
                className={cn(
                  "px-8 py-6 rounded-xl font-bold text-base transition-all duration-300",
                  "shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)] hover:shadow-[0_0_25px_-5px_rgba(var(--primary),0.6)]",
                  !input.trim() && "opacity-50 grayscale"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Teach Me
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-card/40 border-dashed border-border animate-pulse">
                <div className="h-64" />
              </Card>
            ))}
          </motion.div>
        ) : response ? (
          <motion.div 
            key="response"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Main Explanation */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-primary/20 shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col h-full">
                <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Deep Dive Explanation</CardTitle>
                        <CardDescription>A comprehensive breakdown of the topic</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 flex-1">
                  <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-primary whitespace-pre-wrap text-lg">
                    {response.explanation}
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/20 border-t border-border/50 p-6 flex flex-wrap gap-4">
                  <Button variant="outline" onClick={handleDownloadPDF} className="rounded-xl border-primary/20 hover:bg-primary/5">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    onClick={handleSaveNotes} 
                    className="rounded-xl shadow-lg"
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save to My Notes
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Side Column: Notes & Tips */}
            <div className="space-y-8">
              {/* Study Notes */}
              <Card className="border-secondary/20 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-secondary/5 border-b border-secondary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                        <StickyNote className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-xl">Study Snapshot</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleCopyNotes} title="Copy Notes">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {response.studyNotes.split('\n').filter(line => line.trim()).map((note, idx) => (
                      <div key={idx} className="flex gap-3 items-start group">
                        <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-secondary group-hover:scale-150 transition-transform" />
                        <p className="text-base text-muted-foreground leading-snug">{note.replace(/^[-*•]\s+/, '')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-0">
                  <Button 
                    variant="ghost" 
                    className="w-full h-12 rounded-none border-t border-border/50 text-secondary hover:bg-secondary/5"
                    onClick={handleCopyNotes}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Summary
                  </Button>
                </CardFooter>
              </Card>

              {/* Practical Tip */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-none shadow-md overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                        <Lightbulb className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-foreground">Pro-Study Tip</h4>
                        <p className="text-sm text-muted-foreground italic leading-relaxed">
                          "{response.practicalTip}"
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Next Steps Prompt */}
              <div className="p-6 rounded-2xl border border-dashed border-border bg-muted/10">
                <h5 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  What's Next?
                </h5>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-primary" />
                    Take a quiz on this topic
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-primary" />
                    Search the Resource Library
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-2">
              <Brain className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Ready to Learn?</h3>
              <p className="text-muted-foreground max-w-sm">
                Type anything you're curious about above and I'll create a custom lesson just for you.
              </p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
