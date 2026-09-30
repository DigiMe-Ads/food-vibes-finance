import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { updateProject } from '@/services/api';
import type { ProjectStatus } from '@/types/types';
import { PROJECT_STATUSES } from '@/types/types';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Building2, Save, KeyRound, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { project, refresh } = useProject();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    expected_completion_date: '',
    status: 'Planning' as ProjectStatus,
    notes: '',
    currency: 'LKR',
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description ?? '',
        start_date: project.start_date ?? '',
        expected_completion_date: project.expected_completion_date ?? '',
        status: project.status,
        notes: project.notes ?? '',
        currency: project.currency,
      });
    }
  }, [project]);

  const handleSave = async () => {
    if (!project || !form.name.trim()) { toast.error('Project name is required.'); return; }
    setSaving(true);
    await updateProject(project.id, {
      name: form.name.trim(),
      description: form.description || null,
      start_date: form.start_date || null,
      expected_completion_date: form.expected_completion_date || null,
      status: form.status,
      notes: form.notes || null,
      currency: form.currency,
    });
    await refresh();
    setSaving(false);
    toast.success('Project settings saved.');
  };

  if (!project) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Configure the project and your account." />

      {/* Project info summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{project.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">{project.status}</Badge>
                {project.start_date && (
                  <span className="text-xs text-muted-foreground">Started {formatDate(project.start_date)}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project settings form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Project Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Project Name <span className="text-destructive">*</span></label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Restaurant Project 01" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the project…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Expected Completion</label>
              <Input type="date" value={form.expected_completion_date} onChange={e => setForm(f => ({ ...f, expected_completion_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ProjectStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Currency</label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="LKR" maxLength={5} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes about the project…"
              rows={3}
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <button
          onClick={() => navigate('/account/password')}
          className="flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Account & security</p>
            <p className="truncate text-sm text-muted-foreground">Change the password for {user?.email ?? 'your account'}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      </Card>

      {/* App info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-muted-foreground">About</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Application', value: 'Food Vibes Finance Dashboard' },
              { label: 'Version', value: '2.0.0' },
              { label: 'Currency Format', value: `${form.currency} 1,250,000.00` },
              { label: 'Database', value: 'Supabase PostgreSQL' },
            ].map(item => (
              <div key={item.label} className="flex gap-4">
                <dt className="text-muted-foreground w-36 shrink-0">{item.label}</dt>
                <dd className="text-foreground font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
