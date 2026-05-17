import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TTSButtonProps {
  text: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export const TTSButton: React.FC<TTSButtonProps> = ({ text, className, size = "icon" }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSupported(false);
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleSpeech = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!text) return;

    // Clean up text (remove HTML if any, though here it's mostly plain text)
    const cleanText = text.replace(/<[^>]*>?/gm, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9; // Slightly slower for better clarity
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!supported) return null;

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        "h-8 w-8 rounded-full transition-all duration-300",
        isSpeaking ? "bg-primary/20 text-primary animate-pulse" : "text-muted-foreground hover:text-primary",
        className
      )}
      onClick={toggleSpeech}
      title={isSpeaking ? "Stop Reading" : "Read Aloud"}
    >
      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </Button>
  );
};
