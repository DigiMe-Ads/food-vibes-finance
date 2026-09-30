import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/PageHeader';
import { BrandMark } from '@/components/common/BrandMark';
import { PasswordInput, PasswordStrength, MIN_PASSWORD_LENGTH } from '@/components/common/PasswordInput';

function ChangePasswordForm({ forced, onDone }: { forced: boolean; onDone: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && next !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forced && !current) return setError('Enter your current password.');
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next !== confirm) return setError('The two new passwords do not match.');
    setSaving(true);
    const { error: err } = await changePassword(next, forced ? undefined : current);
    setSaving(false);
    if (err) return setError(err.message);
    toast.success('Password updated.');
    setCurrent(''); setNext(''); setConfirm('');
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {!forced && (
        <div className="space-y-2">
          <Label htmlFor="pw-current">Current password</Label>
          <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} autoFocus />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="pw-new">New password</Label>
        <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} autoFocus={forced} />
        <PasswordStrength password={next} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <PasswordInput
          id="pw-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          aria-invalid={mismatch}
          className={mismatch ? 'border-destructive focus-visible:border-destructive' : undefined}
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don't match yet.</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full h-11" disabled={saving}>
        {saving ? 'Saving…' : forced ? 'Set password & continue' : 'Update password'}
      </Button>
    </form>
  );
}

/** Full-screen gate shown after logging in with a temporary password. */
export function ForcedPasswordChange() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><BrandMark /></div>
        <Card className="p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold">Choose a new password</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You signed in with a temporary password. Set your own to continue{user?.email ? ` as ${user.email}` : ''}.
              </p>
            </div>
          </div>
          <ChangePasswordForm forced onDone={() => navigate('/', { replace: true })} />
        </Card>
        <button
          type="button"
          onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
          className="mx-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out instead
        </button>
      </div>
    </div>
  );
}

/** In-app page: Account → Change password. */
export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Change password" description={`Update the password for ${user?.email ?? 'your account'}.`} />
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> Password
        </div>
        <ChangePasswordForm forced={false} onDone={() => navigate(-1)} />
      </Card>
      <p className="text-xs text-muted-foreground">
        Tip: use at least {MIN_PASSWORD_LENGTH} characters with a mix of upper- and lower-case letters, numbers and symbols.
      </p>
    </div>
  );
}
