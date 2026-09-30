import { useState, useEffect, useCallback } from 'react';
import { getCategories, addCategory, updateCategory, disableCategory, getCategoryExpenseCount } from '@/services/api';
import type { Category } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Tag, CheckCircle2, XCircle, Search, Tags, Ban } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { toast } from 'sonner';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [disableTarget, setDisableTarget] = useState<Category | null>(null);
  const [enableTarget, setEnableTarget] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    const cats = await getCategories(false);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const openAdd = () => { setEditCat(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (cat: Category) => { setEditCat(cat); setName(cat.name); setDescription(cat.description ?? ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Category name is required.'); return; }
    setSaving(true);
    if (editCat) {
      await updateCategory(editCat.id, { name: name.trim(), description: description.trim() || null });
      toast.success('Category updated.');
    } else {
      await addCategory(name.trim(), description.trim() || undefined);
      toast.success('Category added.');
    }
    setSaving(false);
    setDialogOpen(false);
    loadCategories();
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    const count = await getCategoryExpenseCount(disableTarget.id);
    if (count > 0) {
      await disableCategory(disableTarget.id);
      toast.success(`Category disabled. ${count} existing expense(s) retain this category.`);
    } else {
      await disableCategory(disableTarget.id);
      toast.success('Category disabled.');
    }
    setDisableTarget(null);
    loadCategories();
  };

  const handleEnable = async () => {
    if (!enableTarget) return;
    await updateCategory(enableTarget.id, { is_active: true });
    toast.success('Category re-enabled.');
    setEnableTarget(null);
    loadCategories();
  };

  const active = categories.filter(c => c.is_active);
  const disabled = categories.filter(c => !c.is_active);
  const q = search.trim().toLowerCase();
  const matches = (c: Category) => !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
  const shownActive = active.filter(matches);
  const shownDisabled = disabled.filter(matches);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organise expenses into categories. Disabled ones stay on past expenses."
        actions={
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add category
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total" value={categories.length} icon={Tags} tone="neutral" loading={loading} />
        <StatCard label="Active" value={active.length} icon={CheckCircle2} tone="success" loading={loading} valueClassName="text-success" />
        <StatCard label="Disabled" value={disabled.length} icon={Ban} tone="neutral" loading={loading} className="col-span-2 md:col-span-1" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search categories…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Active categories */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <CardTitle className="text-base">Active categories</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : shownActive.length === 0 ? (
            <EmptyState icon={Tag} title={q ? 'No matching categories' : 'No active categories'} className="py-8" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {shownActive.map(cat => (
                <div key={cat.id} className="group flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Tag className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => openEdit(cat)} className="icon-btn" title="Edit" aria-label={`Edit ${cat.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDisableTarget(cat)} className="icon-btn icon-btn-danger" title="Disable" aria-label={`Disable ${cat.name}`}>
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disabled categories */}
      {shownDisabled.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base text-muted-foreground">Disabled categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {shownDisabled.map(cat => (
                <div key={cat.id} className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{cat.name}</p>
                      <Badge variant="secondary" className="text-xs mt-0.5">Disabled</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEnableTarget(cat)} className="ml-2 shrink-0 gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Enable
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCat ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Construction Materials" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation */}
      <AlertDialog open={!!disableTarget} onOpenChange={open => { if (!open) setDisableTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Category</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable <strong>{disableTarget?.name}</strong>. It will no longer appear in the expense form, but all existing expenses retain this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisable}>Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enable confirmation */}
      <AlertDialog open={!!enableTarget} onOpenChange={open => { if (!open) setEnableTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Re-enable Category</AlertDialogTitle>
            <AlertDialogDescription>This will re-enable <strong>{enableTarget?.name}</strong> for use in new expenses.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnable}>Enable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
