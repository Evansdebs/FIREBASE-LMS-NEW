import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
      <Card className="border-border">
        <CardContent className="p-12 text-center">
          <Construction className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-heading text-lg font-semibold text-card-foreground">Coming Soon</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            This feature is under development. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
