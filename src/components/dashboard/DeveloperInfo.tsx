import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Mail, User, ShieldCheck, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DeveloperInfo() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Developer Information</h1>
          <p className="text-muted-foreground mt-1">Get in touch for technical support and system customization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border overflow-hidden group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-0">
            <div className="bg-primary p-6 text-primary-foreground relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-heading">EVANS K. DEBRAH</h2>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20 transition-colors">I.T. SPECIALIST</Badge>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -left-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 group/item">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary transition-all duration-300">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Call / WhatsApp</p>
                  <p className="text-sm font-semibold text-foreground">+233 257 537 457</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group/item">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary transition-all duration-300">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Alternative Line</p>
                  <p className="text-sm font-semibold text-foreground">+233 545 153 303</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group/item">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary transition-all duration-300">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Email Support</p>
                  <p className="text-sm font-semibold text-foreground truncate">evansdebrah111@gmail.com</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group/item">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary transition-all duration-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Backup Email</p>
                  <p className="text-sm font-semibold text-foreground">onereal381@gmail.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-muted/30 hover:bg-muted/50 transition-colors duration-300">
          <CardContent className="p-6">
            <h3 className="font-heading font-bold text-lg mb-4">Quick Technical Help</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              If you encounter any system bugs, synchronization issues, or require custom feature development, 
              please reach out via the provided channels. For immediate assistance, WhatsApp is preferred.
            </p>
            <div className="space-y-2">
              <Button className="w-full justify-start gap-2 shadow-sm" onClick={() => window.open('https://wa.me/233257537457')}>
                <MessageSquare className="w-4 h-4" /> Message on WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-white" onClick={() => window.location.href = 'mailto:evansdebrah111@gmail.com'}>
                <Mail className="w-4 h-4" /> Send Email Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
