import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, Eye, EyeOff, ShieldCheck, AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};
  
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!email) {
    navigate('/');
    return null;
  }

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
    if (score <= 3) return { score, label: 'Medium', color: 'bg-orange-500' };
    if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' };
    return { score, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/auth/change-forced-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, newPassword })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('onereal_token', data.token);
        toast.success('Password updated successfully! Welcome to ONEREAL.');
        window.location.href = '/dashboard';
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Secure Your Account</h1>
          <p className="text-muted-foreground mt-1 font-body text-sm">Your administrator has required a password update.</p>
        </div>

        <Card className="border-border shadow-xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Reset Password
            </CardTitle>
            <CardDescription>Enter the temporary password you were given and set your new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <div className="relative">
                  <Input 
                    type={showPass ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label>New Password</Label>
                <div className="relative">
                  <Input 
                    type={showNewPass ? 'text' : 'password'} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                    placeholder="Create a strong password"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {newPassword && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-medium uppercase tracking-wider">
                      <span className="text-muted-foreground">Strength:</span>
                      <span className={cn(
                        strength.label === 'Weak' ? 'text-destructive' :
                        strength.label === 'Medium' ? 'text-orange-500' :
                        strength.label === 'Strong' ? 'text-green-500' : 'text-emerald-500'
                      )}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all duration-300", strength.color)} style={{ width: `${(strength.score / 5) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                  placeholder="Repeat your new password"
                />
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div className="flex items-center gap-2 text-destructive text-xs py-1">
                  <AlertCircle className="w-3 h-3" /> Passwords do not match
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold mt-4" disabled={loading || !newPassword || newPassword !== confirmPassword}>
                {loading ? 'Updating...' : 'Update Password & Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-6">
          Contact your administrator if you've lost your temporary credentials.
        </p>
      </div>
    </div>
  );
}
