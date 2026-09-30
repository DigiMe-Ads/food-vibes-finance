import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BarChart3, Receipt, ShieldCheck, UtensilsCrossed, KeyRound } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { PasswordInput } from '@/components/common/PasswordInput';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const FEATURES = [
  { icon: BarChart3, title: 'Live financial overview', text: 'Investment, spend and balance at a glance.' },
  { icon: Receipt, title: 'Every expense tracked', text: 'Categorised, searchable and exportable.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Admins, accounts and viewers see what they need.' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithUsername } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

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
    <div className="min-h-screen flex bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex lg:w-[46%] flex-col justify-between overflow-hidden bg-sidebar p-12 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-sidebar-primary/10 blur-3xl" />

        <BrandMark inverted className="relative" />

        <div className="relative max-w-md space-y-10">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-sidebar-primary">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Construction project finance
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight">
              Every rupee of the <span className="text-sidebar-primary">Food Vibes</span> build, accounted for.
            </h1>
          </div>
          <ul className="space-y-5">
            {FEATURES.map(f => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sidebar-primary ring-1 ring-white/10">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-sidebar-foreground">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/70">Internal use only · © {new Date().getFullYear()} Food Vibes</p>
      </div>

      {/* Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-sm space-y-8">
          <BrandMark className="lg:hidden" />

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to the Food Vibes finance dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Email or username</Label>
              <Input
                id="username"
                type="text"
                placeholder="you@example.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => setForgotOpen(true)} className="text-xs font-medium text-primary hover:underline underline-offset-4">
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox id="agree" checked={agreed} onCheckedChange={v => setAgreed(Boolean(v))} className="mt-0.5" />
              <label htmlFor="agree" className="cursor-pointer text-xs leading-snug text-muted-foreground">
                I agree to the{' '}
                <a href="#" className="font-medium text-primary underline-offset-2 hover:underline">User Agreement</a>
                {' '}and{' '}
                <a href="#" className="font-medium text-primary underline-offset-2 hover:underline">Privacy Policy</a>.
              </label>
            </div>

            <Button type="submit" className="h-11 w-full text-[15px]" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle>Forgot your password?</DialogTitle>
            <DialogDescription className="pt-1 leading-relaxed">
              Ask an administrator to reset it. They can set a temporary password for you from the <strong>Users</strong> page,
              and you'll be asked to choose your own the next time you sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
