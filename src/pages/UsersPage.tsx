import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { USER_ROLES, canManageUsers } from '@/types/types';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Shield, User, Mail, Calendar, Activity, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── API helpers ─────────────────────────────────────────────────────────────

async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function createUser(email: string, password: string, username: string, role: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'create_user', email, password, username: username || null, role },
  });
  // supabase.functions.invoke sets error.message to a generic string on non-2xx;
  // the real message is in data.error or error.context?.responseBody
  if (error) {
    const msg = data?.error ?? error.message ?? 'Edge Function error';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
}

async function updateUserRole(userId: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_user_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

async function deleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'delete_user', userId },
  });
  if (error) {
    const msg = data?.error ?? error.message ?? 'Edge Function error';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
}

async function getUserActivityCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_activity_count', { p_user_id: userId });
  if (error) return 0;
  return data ?? 0;
}

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
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
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await createUser(email.trim(), password, username.trim(), role);
      toast.success(`User "${email.trim()}" created successfully.`);
      reset();
      onOpenChange(false);
      onCreated();
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
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email <span className="text-destructive">*</span></Label>
            <Input id="cu-email" type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Username</Label>
            <Input id="cu-username" placeholder="Optional display name" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password <span className="text-destructive">*</span></Label>
            <Input id="cu-password" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="cu-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── View User Modal ──────────────────────────────────────────────────────────

interface ViewUserModalProps {
  profile: Profile;
  onClose: () => void;
  onRoleChanged: () => void;
  currentUserId: string;
}

function ViewUserModal({ profile, onClose, onRoleChanged, currentUserId }: ViewUserModalProps) {
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

  return (
    <>
      <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Avatar row */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {profile.username ?? profile.email?.split('@')[0] ?? 'Unknown'}
                </p>
                <p className="text-muted-foreground text-sm truncate">{profile.email ?? '—'}</p>
                <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="mt-1 text-xs">
                  {profile.role === 'admin' ? 'Admin' : 'User'}
                </Badge>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="text-xs">Email</span>
                </div>
                <p className="text-sm text-foreground break-words">{profile.email ?? '—'}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-xs">Role</span>
                </div>
                <p className="text-sm text-foreground capitalize">{profile.role}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs">Joined</span>
                </div>
                <p className="text-sm text-foreground">{formatDate(profile.created_at)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-xs">Activity Logs</span>
                </div>
                <p className="text-sm text-foreground font-semibold">
                  {activityCount === null ? '…' : activityCount}
                </p>
              </div>
            </div>

            {/* Role change (disabled for self to prevent lock-out) */}
            {!isSelf && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Change Role</p>
                <div className="flex items-center gap-3">
                  <Select value={newRole} onValueChange={v => setNewRole(v as typeof newRole)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          <div>
                            <span className="font-medium">{r.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{r.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={newRole === profile.role || saving}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Update
                  </Button>
                </div>
              </div>
            )}
            {isSelf && (
              <p className="text-xs text-muted-foreground italic">You cannot change your own role.</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{profile.email}</strong>'s role from <strong>{profile.role}</strong> to <strong>{newRole}</strong>?
              This will immediately affect what they can access.
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
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProfiles();
      setProfiles(data);
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

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.username ?? '').toLowerCase().includes(q)
    );
  });

  const adminCount = profiles.filter(p => p.role === 'admin').length;
  const userCount = profiles.filter(p => p.role === 'user').length;

  // Only admins can access this page
  if (currentProfile && !canManageUsers(currentProfile.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Shield className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-lg font-semibold text-foreground">Access Restricted</p>
        <p className="text-muted-foreground text-sm">Only administrators can manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage user accounts and roles</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /><span className="sr-only md:not-sr-only">Refresh</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New User
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Users</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : profiles.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Administrators</p>
            <p className="text-2xl font-bold text-primary">{loading ? '—' : adminCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Standard Users</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : userCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + table */}
      <Card className="shadow-card min-w-0">
        <CardHeader className="px-4 py-3 border-b border-border">
          <div className="relative max-w-sm">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or username…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground">{search ? 'No users match your search.' : 'No users found.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {p.username ?? p.email?.split('@')[0] ?? 'Unknown'}
                            </p>
                            {p.id === currentUser?.id && (
                              <span className="text-xs text-primary">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={p.role === 'admin' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {p.role === 'admin' ? <><Shield className="w-3 h-3 mr-1" />Admin</> : p.role ?? 'user'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewProfile(p)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {p.id !== currentUser?.id && (
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {viewProfile && (
        <ViewUserModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
          onRoleChanged={load}
          currentUserId={currentUser?.id ?? ''}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.email}</span>?
              This cannot be undone and will remove all their profile data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
