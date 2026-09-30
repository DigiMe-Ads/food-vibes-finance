import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { getExpenses, deleteExpense, logActivity } from '@/services/api';
import type { Expense, ExpenseFilters, Category } from '@/types/types';
import { canAddData, canDeleteData, PAYMENT_METHODS } from '@/types/types';
import { formatCurrency, formatDate, formatExpenseId, exportToCSV } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, SlidersHorizontal, X, Paperclip, Eye, Pencil, Trash2, Download,
  ArrowUpDown, ArrowUp, ArrowDown, Receipt,
} from 'lucide-react';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import ViewExpenseModal from '@/components/modals/ViewExpenseModal';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { toast } from 'sonner';
import { getCategories } from '@/services/api';

const PAGE_SIZE = 20;

export default function ExpensesPage() {
  const { project } = useProject();
  const { user, profile } = useAuth();
  const canAdd = canAddData(profile?.role);
  const canDel = canDeleteData(profile?.role);
  const [searchParams] = useSearchParams();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sortCol, setSortCol] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [filters, setFilters] = useState<ExpenseFilters>({
    categoryId: searchParams.get('category') ?? undefined,
  });
  const [pendingFilters, setPendingFilters] = useState<ExpenseFilters>({
    categoryId: searchParams.get('category') ?? undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const loadCategories = useCallback(async () => {
    const cats = await getCategories(false);
    setCategories(cats);
  }, []);

  const loadExpenses = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const { data, count } = await getExpenses(project.id, filters, page, sortCol, sortDir);
    setExpenses(data);
    setTotalCount(count);
    setFilteredTotal(data.reduce((s, e) => s + Number(e.amount), 0));
    setSelected(new Set());
    setLoading(false);
  }, [project, filters, page, sortCol, sortDir]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { setPage(0); }, [filters]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const applyFilters = () => { setFilters({ ...pendingFilters }); };
  const clearFilters = () => {
    const empty: ExpenseFilters = {};
    setPendingFilters(empty);
    setFilters(empty);
  };

  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  const handleSort = (col: 'date' | 'amount') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  // Single-row delete
  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    await logActivity(user.id, 'Expense Deleted', 'expense', deleteTarget.id, deleteTarget, null);
    await deleteExpense(deleteTarget.id);
    toast.success('Expense deleted.');
    setDeleteTarget(null);
    loadExpenses();
  };

  // Bulk selection helpers
  const allSelected = expenses.length > 0 && expenses.every(e => selected.has(e.id));
  const someSelected = selected.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(expenses.map(e => e.id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!user || selected.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      const exp = expenses.find(e => e.id === id);
      await logActivity(user.id, 'Expense Deleted', 'expense', id, exp ?? null, null);
      await deleteExpense(id);
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    toast.success(`${ids.length} expense${ids.length > 1 ? 's' : ''} deleted.`);
    loadExpenses();
  };

  const selectedTotal = expenses
    .filter(e => selected.has(e.id))
    .reduce((s, e) => s + Number(e.amount), 0);

  const handleExportCSV = () => {
    const headers = ['Date', 'Expense ID', 'Description', 'Category', 'Supplier', 'Payment Method', 'Reference', 'Amount'];
    const rows = expenses.map(e => [
      formatDate(e.date),
      formatExpenseId(e.id),
      e.description,
      e.categories?.name ?? '',
      e.supplier ?? '',
      e.payment_method,
      e.reference ?? '',
      e.amount,
    ]);
    exportToCSV('expenses.csv', headers, rows);
  };

  if (!project) return null;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== undefined && v !== '').length;
  const categoryName = (id?: string) => categories.find(c => c.id === id)?.name;

  const rowActions = (exp: Expense) => (
    <div className="flex items-center justify-end gap-0.5">
      <button onClick={() => setViewExpense(exp)} className="icon-btn" title="View" aria-label="View expense"><Eye className="h-4 w-4" /></button>
      {canAdd && <button onClick={() => setEditExpense(exp)} className="icon-btn" title="Edit" aria-label="Edit expense"><Pencil className="h-4 w-4" /></button>}
      {canDel && <button onClick={() => setDeleteTarget(exp)} className="icon-btn icon-btn-danger" title="Delete" aria-label="Delete expense"><Trash2 className="h-4 w-4" /></button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record and manage all project expenses."
        actions={
          <>
            <Button variant="outline" onClick={handleExportCSV} className="gap-2" aria-label="Export CSV">
              <Download className="h-4 w-4" /><span className="hidden md:inline">Export CSV</span>
            </Button>
            {canAdd && (
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add expense
              </Button>
            )}
          </>
        }
      />

      <Card className="min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search description, supplier or reference…"
                className="pl-9"
                value={pendingFilters.search ?? ''}
                onChange={e => setPendingFilters(p => ({ ...p, search: e.target.value || undefined }))}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <Button variant="outline" onClick={applyFilters} className="hidden sm:inline-flex">Search</Button>
            <Button
              variant={showFilters || activeFilterCount > 0 ? 'secondary' : 'outline'}
              onClick={() => setShowFilters(s => !s)}
              className="gap-2"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{activeFilterCount}</span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">From date</label>
                <Input type="date" value={pendingFilters.dateFrom ?? ''} onChange={e => setPendingFilters(p => ({ ...p, dateFrom: e.target.value || undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">To date</label>
                <Input type="date" value={pendingFilters.dateTo ?? ''} onChange={e => setPendingFilters(p => ({ ...p, dateTo: e.target.value || undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={pendingFilters.categoryId ?? 'all'} onValueChange={v => setPendingFilters(p => ({ ...p, categoryId: v === 'all' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Payment method</label>
                <Select value={pendingFilters.paymentMethod ?? 'all'} onValueChange={v => setPendingFilters(p => ({ ...p, paymentMethod: v === 'all' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="All methods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Min amount ({project.currency})</label>
                <Input type="number" placeholder="0" value={pendingFilters.minAmount ?? ''} onChange={e => setPendingFilters(p => ({ ...p, minAmount: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Max amount ({project.currency})</label>
                <Input type="number" placeholder="Any" value={pendingFilters.maxAmount ?? ''} onChange={e => setPendingFilters(p => ({ ...p, maxAmount: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="col-span-full flex gap-2">
                <Button onClick={applyFilters} size="sm">Apply filters</Button>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="h-3.5 w-3.5" /> Clear all</Button>
              </div>
            </div>
          )}

          {hasFilters && !showFilters && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {filters.search && <FilterChip label={`"${filters.search}"`} />}
              {filters.categoryId && <FilterChip label={categoryName(filters.categoryId) ?? 'Category'} />}
              {filters.paymentMethod && <FilterChip label={filters.paymentMethod} />}
              {(filters.dateFrom || filters.dateTo) && (
                <FilterChip label={`${filters.dateFrom ? formatDate(filters.dateFrom) : '…'} → ${filters.dateTo ? formatDate(filters.dateTo) : '…'}`} />
              )}
              {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && (
                <FilterChip label={`${filters.minAmount ?? 0} – ${filters.maxAmount ?? '∞'}`} />
              )}
              <button onClick={clearFilters} className="font-medium text-primary hover:underline">Clear</button>
            </div>
          )}

          {hasFilters && (
            <p className="text-sm">
              <span className="font-semibold">{totalCount} expense{totalCount !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="amount-text font-semibold text-primary">{formatCurrency(filteredTotal, project.currency)}</span>
              <span className="text-xs text-muted-foreground"> (page total)</span>
            </p>
          )}
        </div>

        {/* Bulk selection bar */}
        {someSelected && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-2.5">
            <p className="text-sm">
              <span className="font-semibold">{selected.size} selected</span>
              <span className="text-muted-foreground"> · {formatCurrency(selectedTotal, project.currency)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              {canDel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete selected
                </Button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-5">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? 'No expenses match these filters' : 'No expenses yet'}
            description={hasFilters ? 'Try widening the date range or clearing filters.' : 'Expenses you record will appear here.'}
            action={hasFilters
              ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              : canAdd && <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add your first expense</Button>}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {expenses.map(exp => (
                <li key={exp.id} className={`flex gap-3 p-4 ${selected.has(exp.id) ? 'bg-primary/5' : ''}`}>
                  <Checkbox
                    checked={selected.has(exp.id)}
                    onCheckedChange={() => toggleOne(exp.id)}
                    aria-label={`Select ${exp.description}`}
                    className="mt-1"
                  />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewExpense(exp)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{exp.description}</p>
                      <p className="amount-text shrink-0 text-sm font-bold">{formatCurrency(exp.amount, project.currency)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(exp.date)} · {exp.payment_method}{exp.supplier && <> · {exp.supplier}</>}
                    </p>
                    {exp.categories && <Badge variant="secondary" className="mt-2 text-[11px]">{exp.categories.name}</Badge>}
                  </button>
                  <div className="flex flex-col items-end">
                    {rowActions(exp)}
                    {exp.attachment_url && (
                      <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer" className="icon-btn text-accent" aria-label="Open attachment">
                        <Paperclip className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th className="px-3 py-3 text-left">
                      <SortButton label="Date" active={sortCol === 'date'} dir={sortDir} onClick={() => handleSort('date')} />
                    </th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-left">Category</th>
                    <th className="px-3 py-3 text-left">Supplier</th>
                    <th className="px-3 py-3 text-left">Payment / ref</th>
                    <th className="px-3 py-3 text-right">
                      <SortButton label="Amount" active={sortCol === 'amount'} dir={sortDir} onClick={() => handleSort('amount')} alignRight />
                    </th>
                    <th className="px-3 py-3 text-center">Doc</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className={selected.has(exp.id) ? 'bg-primary/5' : undefined}>
                      <td className="px-4 py-2.5">
                        <Checkbox checked={selected.has(exp.id)} onCheckedChange={() => toggleOne(exp.id)} aria-label={`Select ${exp.description}`} />
                      </td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(exp.date)}</td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <span className="block truncate text-sm font-medium text-foreground" title={exp.description}>{exp.description}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{formatExpenseId(exp.id)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {exp.categories
                          ? <Badge variant="secondary" className="text-xs">{exp.categories.name}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="max-w-[160px] px-3 py-2.5 text-sm text-muted-foreground"><span className="block truncate" title={exp.supplier ?? undefined}>{exp.supplier ?? '—'}</span></td>
                      <td className="px-3 py-2.5">
                        <span className="block text-sm text-muted-foreground">{exp.payment_method}</span>
                        {exp.reference && <span className="font-mono text-[11px] text-muted-foreground">{exp.reference}</span>}
                      </td>
                      <td className="amount-text px-3 py-2.5 text-right text-sm font-semibold text-foreground">
                        {formatCurrency(exp.amount, project.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {exp.attachment_url
                          ? <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer" className="icon-btn text-accent" aria-label="Open attachment"><Paperclip className="h-4 w-4" /></a>
                          : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5">{rowActions(exp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        )}
      </Card>

      {/* Modals */}
      <AddExpenseModal
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={project.id}
        userId={user?.id ?? null}
        onSaved={loadExpenses}
      />
      {editExpense && (
        <AddExpenseModal
          open={!!editExpense}
          onOpenChange={open => { if (!open) setEditExpense(null); }}
          projectId={project.id}
          userId={user?.id ?? null}
          editData={editExpense}
          onSaved={() => { setEditExpense(null); loadExpenses(); }}
        />
      )}
      {viewExpense && (
        <ViewExpenseModal
          expense={viewExpense}
          currency={project.currency}
          onClose={() => setViewExpense(null)}
          onEdit={() => { setEditExpense(viewExpense); setViewExpense(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.description}</strong>?
              This permanently removes the expense and updates all financial figures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open) setBulkDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} expense{selected.size > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{selected.size} selected expense{selected.size > 1 ? 's' : ''}</strong> totalling{' '}
              <strong>{formatCurrency(selectedTotal, project.currency)}</strong>.
              All financial figures update immediately. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive hover:bg-destructive/90">
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} expense${selected.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 font-medium text-foreground">{label}</span>
  );
}

function SortButton({ label, active, dir, onClick, alignRight }: {
  label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; alignRight?: boolean;
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? 'text-foreground' : ''} ${alignRight ? 'ml-auto' : ''}`}
    >
      {label} <Icon className="h-3 w-3" />
    </button>
  );
}
