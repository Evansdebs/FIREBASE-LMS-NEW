import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { settings } = useBranding();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setError('');
    setIsLoggingIn(true);

    try {
      const result = await login(email, needsPassword ? password : undefined);

      if (result.mustChangePassword) {
        navigate('/auth/change-password', { state: { email: result.email } });
        setIsLoggingIn(false);
        return;
      }

      if (result.needsPassword) {
        setNeedsPassword(true);
        setIsLoggingIn(false);
        return;
      }

      if (!result.success) {
        setError(result.error || 'Login failed');
        setIsLoggingIn(false);
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{ backgroundImage: "url('/assets/login-bg.png')" }}
    >
      <style>{`
        @keyframes rotate-border {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-border::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            transparent, 
            transparent, 
            transparent, 
            #8b5cf6, 
            #d946ef, 
            #8b5cf6
          );
          animation: rotate-border 4s linear infinite;
        }
      `}</style>

      {/* Immersive Purple Tint Overlay */}
      <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[1px]"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-transparent to-transparent"></div>
      
      {/* Animated Border Wrapper */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 group">
        <div className="absolute -inset-[1px] rounded-[2.05rem] overflow-hidden animate-border opacity-60 group-hover:opacity-90 transition-opacity"></div>
        
        {/* Floating Glass Card */}
        <div className="relative w-full px-8 py-12 backdrop-blur-3xl bg-black/70 border border-white/5 shadow-2xl rounded-[2rem] animate-in fade-in zoom-in-95 duration-700">
          
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/20 shadow-2xl mb-6 overflow-hidden backdrop-blur-xl group-hover:scale-110 transition-transform duration-500">
              {settings?.logo ? (
                <img src={settings.logo} className="w-full h-full object-contain p-2" />
              ) : (
                <GraduationCap className="w-12 h-12 text-purple-200 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              )}
            </div>
            <h1 className="font-heading text-4xl font-black tracking-tight text-white mb-2 drop-shadow-md">
              {settings?.schoolName || 'Onereal LMS'}
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full mb-4"></div>
            <p className="text-purple-100/80 font-semibold text-sm uppercase tracking-widest">Gateway to Excellence</p>
          </div>

          {settings?.lockdownMode && (
            <div className="mb-8 p-4 rounded-2xl border border-purple-500/30 bg-purple-900/40 backdrop-blur-md flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Maintenance Mode</p>
                <p className="text-xs text-purple-200/90 leading-relaxed font-medium">The platform is currently restricted for updates. Administrator access only.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 group/input">
              <Label htmlFor="email" className="text-purple-100 font-bold ml-1 text-xs uppercase tracking-wider">Student Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setNeedsPassword(false); setError(''); }}
                  placeholder="name@onereal.com"
                  autoFocus
                  className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 rounded-2xl transition-all pl-4 text-base"
                />
              </div>
            </div>

            <div
              className={`space-y-2 transition-all duration-500 ease-in-out ${
                needsPassword ? 'opacity-100 h-auto translate-y-0' : 'opacity-0 h-0 -translate-y-4 overflow-hidden'
              }`}
            >
              <Label htmlFor="password" className="text-purple-100 font-bold ml-1 text-xs uppercase tracking-wider">Access PIN</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 pr-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 rounded-2xl transition-all pl-4 text-base"
                  autoFocus={needsPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition-colors p-3"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-white text-sm bg-red-500/20 p-4 rounded-2xl border border-red-500/30 animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 font-black text-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 rounded-2xl shadow-[0_10px_20px_-5px_rgba(139,92,246,0.5)] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 group" 
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entering...</span>
                </>
              ) : (
                <span>{needsPassword ? 'Log In Now' : 'Join Classroom'}</span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
