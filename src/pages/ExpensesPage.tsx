import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { getExpenses, deleteExpense, logActivity } from '@/services/api';
import type { Expense, ExpenseFilters, Category } from '@/types/types';
import { canAddData, canDeleteData, PAYMENT_METHODS } from '@/types/types';
import { formatCurrency, formatDate, formatExpenseId, exportToCSV } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, Filter, X, Paperclip, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import ViewExpenseModal from '@/components/modals/ViewExpenseModal';
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Record and manage all project expenses</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {someSelected && canDel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selected.size} selected
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /><span className="sr-only md:not-sr-only">Export CSV</span>
          </Button>
          {canAdd && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search description, supplier or reference…"
                className="pl-9"
                value={pendingFilters.search ?? ''}
                onChange={e => setPendingFilters(p => ({ ...p, search: e.target.value || undefined }))}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <Button variant="secondary" size="icon" onClick={() => setShowFilters(s => !s)}>
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">From Date</label>
                <Input type="date" value={pendingFilters.dateFrom ?? ''} onChange={e => setPendingFilters(p => ({ ...p, dateFrom: e.target.value || undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">To Date</label>
                <Input type="date" value={pendingFilters.dateTo ?? ''} onChange={e => setPendingFilters(p => ({ ...p, dateTo: e.target.value || undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={pendingFilters.categoryId ?? 'all'} onValueChange={v => setPendingFilters(p => ({ ...p, categoryId: v === 'all' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                <Select value={pendingFilters.paymentMethod ?? 'all'} onValueChange={v => setPendingFilters(p => ({ ...p, paymentMethod: v === 'all' ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="All Methods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Min Amount (LKR)</label>
                <Input type="number" placeholder="0" value={pendingFilters.minAmount ?? ''} onChange={e => setPendingFilters(p => ({ ...p, minAmount: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Max Amount (LKR)</label>
                <Input type="number" placeholder="Any" value={pendingFilters.maxAmount ?? ''} onChange={e => setPendingFilters(p => ({ ...p, maxAmount: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="col-span-full flex gap-3 pt-1">
                <Button onClick={applyFilters} size="sm">Apply Filters</Button>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1"><X className="w-3 h-3" /> Clear</Button>
              </div>
            </div>
          )}

          {(hasFilters || someSelected) && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {hasFilters && (
                <>
                  <span className="font-semibold">{totalCount} Expense{totalCount !== 1 ? 's' : ''}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold text-primary">{formatCurrency(filteredTotal, project.currency)}</span>
                  <span className="text-muted-foreground text-xs">(page total)</span>
                </>
              )}
              {someSelected && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {selected.size} selected · {formatCurrency(selectedTotal, project.currency)}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses table */}
      <Card className="shadow-card min-w-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No expenses found.</p>
              {canAdd && (
                <Button variant="ghost" className="mt-2 gap-2 text-primary" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4" /> Add your first expense
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="text-left px-4 py-3">
                      <button onClick={() => handleSort('date')} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        Date <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Supplier</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Payment</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Ref</th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => handleSort('amount')} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground ml-auto">
                        Amount <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Doc</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr
                      key={exp.id}
                      className={`border-b border-border last:border-0 transition-colors ${selected.has(exp.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selected.has(exp.id)}
                          onCheckedChange={() => toggleOne(exp.id)}
                          aria-label={`Select ${exp.description}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{formatExpenseId(exp.id)}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-[180px]">
                        <span className="block truncate">{exp.description}</span>
                      </td>
                      <td className="px-4 py-3">
                        {exp.categories
                          ? <Badge variant="secondary" className="text-xs">{exp.categories.name}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{exp.supplier ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{exp.payment_method}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{exp.reference ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground amount-text text-right">
                        {formatCurrency(exp.amount, project.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {exp.attachment_url
                          ? <a href={exp.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center text-accent hover:text-accent/80"><Paperclip className="w-3.5 h-3.5" /></a>
                          : <span className="text-muted-foreground/30 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewExpense(exp)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                          {canAdd && <button onClick={() => setEditExpense(exp)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>}
                          {canDel && <button onClick={() => setDeleteTarget(exp)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {totalCount} records
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
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
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.description}</strong>?
              This will permanently remove this expense and update all financial figures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open) setBulkDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Expense{selected.size > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selected.size} selected expense{selected.size > 1 ? 's' : ''}</strong> totalling{' '}
              <strong>{formatCurrency(selectedTotal, project.currency)}</strong>.
              All financial figures will be updated immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} Expense${selected.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
