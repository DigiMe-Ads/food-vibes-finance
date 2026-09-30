import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Profile, UserRole } from '@/types/types';
import { USER_ROLES, canManageUsers } from '@/types/types';
import { formatDate, cn, displayName } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Eye, Shield, Mail, Calendar, Activity, RefreshCw, Trash2, Search,
  Users as UsersIcon, KeyRound, Wand2, Calculator, EyeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { PasswordInput, PasswordStrength, MIN_PASSWORD_LENGTH } from '@/components/common/PasswordInput';

// ─── API helpers ─────────────────────────────────────────────────────────────
// User management runs through SECURITY DEFINER SQL functions
// (supabase/migrations/00006_user_management_sql_rpcs.sql) that check the caller is an admin.

async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function createUser(email: string, password: string, username: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('admin_create_user', {
    p_email: email, p_password: password, p_username: username || null, p_role: role,
  });
  if (error) throw new Error(error.message);
}

async function updateUserRole(userId: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

async function setUserPassword(userId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_password', { p_user_id: userId, p_password: password });
  if (error) throw new Error(error.message);
}

async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
  if (error) throw new Error(error.message);
}

async function getUserActivityCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_activity_count', { p_user_id: userId });
  if (error) return 0;
  return data ?? 0;
}

/** Readable temporary password, e.g. "Vibes-4827-Kq". */
function generateTempPassword(): string {
  const words = ['Vibes', 'Spice', 'Grill', 'Table', 'Plate', 'Basil', 'Curry', 'Ember'];
  const rand = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  return `${words[rand(words.length)]}-${1000 + rand(9000)}-${letters[rand(letters.length)]}${letters[rand(letters.length)]}`;
}

const ROLE_STYLES: Record<UserRole, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-primary/10 text-primary border-primary/20' },
  accounts: { label: 'Accounts', className: 'bg-accent/10 text-accent border-accent/20' },
  viewer: { label: 'Viewer', className: 'bg-muted text-muted-foreground border-border' },
  user: { label: 'User', className: 'bg-muted text-muted-foreground border-border' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.user;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', s.className)}>
      {role === 'admin' && <Shield className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

function UserAvatar({ profile, size = 'md' }: { profile: Profile; size?: 'md' | 'lg' }) {
  const name = displayName(profile.email, profile.username);
  const initials = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return (
    <span className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary',
      size === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs',
    )}>
      {initials}
    </span>
  );
}

function RoleSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {USER_ROLES.map(r => (
          <SelectItem key={r.value} value={r.value}>
            <div className="py-0.5">
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TempPasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <PasswordInput id={id} autoComplete="new-password" placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`} value={value} onChange={e => onChange(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={() => onChange(generateTempPassword())} className="gap-1.5 shrink-0">
          <Wand2 className="h-4 w-4" /> Generate
        </Button>
      </div>
      <PasswordStrength password={value} />
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (email: string, password: string) => void;
}

function CreateUserModal({ open, onOpenChange, onCreated }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('viewer');
  const [saving, setSaving] = useState(false);

  const reset = () => { setEmail(''); setPassword(''); setUsername(''); setRole('viewer'); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      await createUser(email.trim(), password, username.trim(), role);
      toast.success(`User "${email.trim()}" created.`);
      onCreated(email.trim(), password);
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>They'll be asked to choose their own password the first time they sign in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email <span className="text-destructive">*</span></Label>
            <Input id="cu-email" type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Display name</Label>
            <Input id="cu-username" placeholder="Optional" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Temporary password <span className="text-destructive">*</span></Label>
            <TempPasswordField id="cu-password" value={password} onChange={setPassword} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-role">Role</Label>
            <RoleSelect id="cu-role" value={role} onChange={setRole} />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create user'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ profile, onClose, onDone }: { profile: Profile; onClose: () => void; onDone: (email: string, password: string) => void }) {
  const [password, setPassword] = useState(generateTempPassword);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      await setUserPassword(profile.id, password);
      toast.success('Password reset.');
      onDone(profile.email ?? '', password);
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for <strong className="text-foreground">{profile.email}</strong>. They'll have to choose a new one when they next sign in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">Temporary password</Label>
            <TempPasswordField id="rp-password" value={password} onChange={setPassword} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Reset password'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shows the temporary password once so the admin can pass it on. */
function CredentialsModal({ creds, onClose }: { creds: { email: string; password: string }; onClose: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${creds.email}\nTemporary password: ${creds.password}`);
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Could not copy — select the text instead.');
    }
  };
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>Share these sign-in details</DialogTitle>
          <DialogDescription>This password won't be shown again. The user will be asked to change it after signing in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-4 font-mono text-sm">
          <p><span className="text-muted-foreground">Email: </span>{creds.email}</p>
          <p><span className="text-muted-foreground">Password: </span><span className="font-semibold">{creds.password}</span></p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy}>Copy</Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── View User Modal ──────────────────────────────────────────────────────────

interface ViewUserModalProps {
  profile: Profile;
  onClose: () => void;
  onRoleChanged: () => void;
  onResetPassword: () => void;
  currentUserId: string;
}

function ViewUserModal({ profile, onClose, onRoleChanged, onResetPassword, currentUserId }: ViewUserModalProps) {
  const [activityCount, setActivityCount] = useState<number | null>(null);
  const [newRole, setNewRole] = useState(profile.role);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSelf = profile.id === currentUserId;

  useEffect(() => {
    getUserActivityCount(profile.id).then(setActivityCount);
  }, [profile.id]);

  const handleRoleChange = async () => {
    setSaving(true);
    try {
      await updateUserRole(profile.id, newRole);
      toast.success('Role updated successfully.');
      setConfirmOpen(false);
      onRoleChanged();
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  const details = [
    { icon: Mail, label: 'Email', value: profile.email ?? '—' },
    { icon: Shield, label: 'Role', value: ROLE_STYLES[profile.role]?.label ?? profile.role },
    { icon: Calendar, label: 'Joined', value: formatDate(profile.created_at) },
    { icon: Activity, label: 'Activity logs', value: activityCount === null ? '…' : String(activityCount) },
  ];

  return (
    <>
      <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>User profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <UserAvatar profile={profile} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-foreground">{displayName(profile.email, profile.username)}</p>
                <p className="truncate text-sm text-muted-foreground">{profile.email ?? '—'}</p>
                <div className="mt-1.5"><RoleBadge role={profile.role} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {details.map(d => (
                <div key={d.label} className="space-y-1 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <d.icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{d.label}</span>
                  </div>
                  <p className="break-words text-sm font-medium text-foreground">{d.value}</p>
                </div>
              ))}
            </div>

            {!isSelf ? (
              <>
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Change role</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1"><RoleSelect value={newRole} onChange={v => setNewRole(v as UserRole)} /></div>
                    <Button disabled={newRole === profile.role || saving} onClick={() => setConfirmOpen(true)}>Update</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">Set a temporary password if they're locked out.</p>
                  </div>
                  <Button variant="outline" onClick={onResetPassword} className="gap-1.5 shrink-0">
                    <KeyRound className="h-4 w-4" /> Reset
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                You can't change your own role. To change your password use <strong>Change password</strong> in the account menu.
              </p>
            )}
          </div>

          <DialogFooter className="pt-1">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm role change</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{profile.email}</strong>'s role from <strong>{profile.role}</strong> to <strong>{newRole}</strong>?
              This immediately affects what they can access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await listProfiles());
    } catch {
      toast.error('Failed to load users. Admin access required.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`User "${deleteTarget.email}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = profiles.filter(p => (p.email ?? '').toLowerCase().includes(q) || (p.username ?? '').toLowerCase().includes(q));
  const count = (r: UserRole) => profiles.filter(p => p.role === r).length;

  // Only admins can access this page
  if (currentProfile && !canManageUsers(currentProfile.role)) {
    return (
      <EmptyState icon={Shield} title="Access restricted" description="Only administrators can manage users." className="py-24" />
    );
  }

  const rowActions = (p: Profile) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => setViewProfile(p)} className="icon-btn" title="View profile" aria-label="View profile"><Eye className="h-4 w-4" /></button>
      {p.id !== currentUser?.id && (
        <>
          <button onClick={() => setResetTarget(p)} className="icon-btn" title="Reset password" aria-label="Reset password"><KeyRound className="h-4 w-4" /></button>
          <button onClick={() => setDeleteTarget(p)} className="icon-btn icon-btn-danger" title="Delete user" aria-label="Delete user"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage who can access the dashboard and what they can do."
        actions={
          <>
            <Button variant="outline" onClick={load} className="gap-2" aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /><span className="hidden md:inline">Refresh</span>
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New user
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={profiles.length} icon={UsersIcon} tone="neutral" loading={loading} />
        <StatCard label="Admins" value={count('admin')} icon={Shield} tone="primary" loading={loading} />
        <StatCard label="Accounts" value={count('accounts')} icon={Calculator} tone="accent" loading={loading} />
        <StatCard label="Viewers" value={count('viewer') + count('user')} icon={EyeIcon} tone="neutral" loading={loading} />
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by email or name…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UsersIcon} title={search ? 'No matching users' : 'No users yet'} description={search ? 'Try a different search.' : undefined} />
        ) : (
          <>
            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {filtered.map(p => (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <UserAvatar profile={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {displayName(p.email, p.username)} {p.id === currentUser?.id && <span className="text-xs font-medium text-primary">(You)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    <div className="mt-1.5"><RoleBadge role={p.role} /></div>
                  </div>
                  {rowActions(p)}
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table w-full whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">User</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Role</th>
                    <th className="px-5 py-3 text-left">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar profile={p} />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{displayName(p.email, p.username)}</p>
                            {p.id === currentUser?.id && <span className="text-xs font-medium text-primary">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{p.email ?? '—'}</td>
                      <td className="px-5 py-3"><RoleBadge role={p.role} /></td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3">{rowActions(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} onCreated={(email, password) => { load(); setCreds({ email, password }); }} />
      {viewProfile && (
        <ViewUserModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
          onRoleChanged={load}
          onResetPassword={() => { setResetTarget(viewProfile); setViewProfile(null); }}
          currentUserId={currentUser?.id ?? ''}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal profile={resetTarget} onClose={() => setResetTarget(null)} onDone={(email, password) => setCreds({ email, password })} />
      )}
      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-semibold text-foreground">{deleteTarget?.email}</span>? This can't be undone.
              Users who have recorded expenses, investments or activity can't be deleted — change their role to Viewer instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
