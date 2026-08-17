import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithUsername } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error('Please accept the User Agreement and Privacy Policy.'); return; }
    if (!username.trim()) { toast.error('Username is required.'); return; }
    if (!password) { toast.error('Password is required.'); return; }
    setLoading(true);
    const { error } = await signInWithUsername(username.trim(), password);
    setLoading(false);
    if (error) {
      toast.error('Invalid username or password. Please try again.');
    } else {
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-between p-12 bg-[#ffffff] bg-none">

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight mb-4 border-solid border-[#dbd1b9] border-[0px] text-[#a3824e] border-[#dbd1b9]">{"Finance Tracker - Food Vibes"}</h1>

          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: DollarSign, label: 'Total Investment', value: 'LKR 1,750,000' },
              { icon: BarChart2, label: 'Budget Used', value: '62.9%' },
            ].map(item => (
              <></>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#a3824e]">{"Construction Project Expenses"}</p>
      </div>
      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-foreground font-semibold text-base">RestaurantFinance</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-muted-foreground text-sm mt-1">Enter your credentials to access the dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Email / Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="your@email.com or admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="email"
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={v => setAgreed(Boolean(v))}
                className="mt-0.5"
              />
              <label htmlFor="agree" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                I agree to the{' '}
                <a href="#" className="text-primary underline underline-offset-2">User Agreement</a>
                {' '}and{' '}
                <a href="#" className="text-primary underline underline-offset-2">Privacy Policy</a>.
              </label>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Restaurant Project Finance Dashboard — Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
