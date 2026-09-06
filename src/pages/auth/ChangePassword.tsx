import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, Eye, EyeOff, ShieldAlert, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  signInWithEmailAndPassword, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, logout } = useAuth();
  
  const stateEmail = location.state?.email;
  const email = stateEmail || authUser?.email || auth.currentUser?.email || '';
  
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!email && !auth.currentUser) {
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

    if (!password) {
      toast.error('Please enter your current/temporary password');
      return;
    }

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (password === newPassword) {
      toast.error('New password must be different from your temporary password');
      return;
    }

    try {
      setLoading(true);

      const targetEmail = email || auth.currentUser?.email || '';
      let firebaseUser = auth.currentUser;

      // 1. Ensure user is authenticated with temporary password
      if (!firebaseUser || (targetEmail && firebaseUser.email?.toLowerCase() !== targetEmail.toLowerCase())) {
        try {
          const cred = await signInWithEmailAndPassword(auth, targetEmail.trim(), password);
          firebaseUser = cred.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
            toast.error('The temporary password you entered is incorrect.');
          } else if (signInErr.code === 'auth/too-many-requests') {
            toast.error('Too many attempts. Please try again later.');
          } else {
            toast.error(signInErr.message || 'Authentication failed. Please verify your temporary password.');
          }
          setLoading(false);
          return;
        }
      } else {
        // Reauthenticate existing session to verify temporary password
        try {
          const cred = EmailAuthProvider.credential(firebaseUser.email || targetEmail.trim(), password);
          await reauthenticateWithCredential(firebaseUser, cred);
        } catch (reauthErr: any) {
          if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential') {
            toast.error('The temporary password you entered is incorrect.');
          } else {
            toast.error(reauthErr.message || 'Verification of temporary password failed.');
          }
          setLoading(false);
          return;
        }
      }

      // 2. Update password in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      // 3. Update Firestore user document to remove mustChangePassword
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        mustChangePassword: false,
        updatedAt: new Date().toISOString()
      });

      // 4. Update ID token cache if used
      try {
        const idToken = await firebaseUser.getIdToken(true);
        localStorage.setItem('onereal_token', idToken);
      } catch (_) {}

      toast.success('Password updated successfully! Welcome to ONEREAL.');

      // 5. Navigate to dashboard with fresh state
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Password change error:', err);
      if (err.code === 'auth/weak-password') {
        toast.error('The new password is too weak. Please use at least 6 characters with a combination of letters and numbers.');
      } else if (err.code === 'auth/requires-recent-login') {
        toast.error('Session expired. Please log in again with your temporary password.');
        navigate('/');
      } else {
        toast.error(err.message || 'An error occurred while updating your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Secure Your Account</h1>
          <p className="text-muted-foreground mt-1 font-body text-sm">
            {email ? `Updating credentials for ${email}` : 'Your administrator has required a password update.'}
          </p>
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
                    disabled={loading}
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
                    placeholder="Create a strong password (min 6 characters)"
                    className="pr-10"
                    disabled={loading}
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
                  disabled={loading}
                />
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div className="flex items-center gap-2 text-destructive text-xs py-1">
                  <AlertCircle className="w-3 h-3" /> Passwords do not match
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold mt-4 gap-2" disabled={loading || !newPassword || newPassword !== confirmPassword}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  'Update Password & Login'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            Contact your administrator if you've lost your temporary credentials.
          </p>
          <button 
            type="button" 
            onClick={handleBackToLogin} 
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
