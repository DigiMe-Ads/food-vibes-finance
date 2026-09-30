import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { getInvestments, deleteInvestment, getFinancialSummary, logActivity } from '@/services/api';
import type { Investment, FinancialSummary } from '@/types/types';
import { canAddData, canDeleteData } from '@/types/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Pencil, Trash2, PiggyBank, Sprout, Landmark } from 'lucide-react';
import AddInvestmentModal from '@/components/modals/AddInvestmentModal';
import ViewInvestmentModal from '@/components/modals/ViewInvestmentModal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  'Initial Investment': 'bg-primary/10 text-primary border-primary/20',
  'Additional Investment': 'bg-accent/10 text-accent border-accent/20',
  'Owner Injection': 'bg-success/10 text-success border-success/20',
  'Partner Investment': 'bg-warning/10 text-warning border-warning/20',
  'Loan / Borrowed Funds': 'bg-destructive/10 text-destructive border-destructive/20',
  'Other Funding': 'bg-muted text-muted-foreground border-border',
};

export default function InvestmentsPage() {
  const { project } = useProject();
  const { user, profile } = useAuth();
  const canAdd = canAddData(profile?.role);
  const canDel = canDeleteData(profile?.role);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editInv, setEditInv] = useState<Investment | null>(null);
  const [viewInv, setViewInv] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const loadData = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const [{ data, count }, s] = await Promise.all([
      getInvestments(project.id, page),
      getFinancialSummary(project.id),
    ]);
    setInvestments(data);
    setTotalCount(count);
    setSummary(s);
    setLoading(false);
  }, [project, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    await logActivity(user.id, 'Investment Deleted', 'investment', deleteTarget.id, deleteTarget, null);
    await deleteInvestment(deleteTarget.id);
    toast.success('Investment deleted.');
    setDeleteTarget(null);
    loadData();
  };

  if (!project) return null;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const rowActions = (inv: Investment) => (
    <div className="flex items-center justify-end gap-0.5">
      <button onClick={() => setViewInv(inv)} className="icon-btn" title="View" aria-label="View investment"><Eye className="h-4 w-4" /></button>
      {canAdd && <button onClick={() => setEditInv(inv)} className="icon-btn" title="Edit" aria-label="Edit investment"><Pencil className="h-4 w-4" /></button>}
      {canDel && <button onClick={() => setDeleteTarget(inv)} className="icon-btn icon-btn-danger" title="Delete" aria-label="Delete investment"><Trash2 className="h-4 w-4" /></button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Track all funding injected into the project."
        actions={canAdd && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add investment
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Initial investment" icon={Landmark} tone="primary" loading={loading}
          value={formatCurrency(summary?.initialInvestment ?? 0, project.currency)} />
        <StatCard label="Further investments" icon={Sprout} tone="accent" loading={loading}
          value={formatCurrency(summary?.furtherInvestments ?? 0, project.currency)} />
        <StatCard label="Total investment" icon={PiggyBank} tone="success" loading={loading}
          value={formatCurrency(summary?.totalInvestment ?? 0, project.currency)} />
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Investment ledger</h2>
          {!loading && <span className="text-xs text-muted-foreground">{totalCount} record{totalCount !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : investments.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No investments recorded yet"
            description="Funding you add will appear here."
            action={canAdd && <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add your first investment</Button>}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {investments.map(inv => (
                <li key={inv.id} className="flex gap-3 p-4">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewInv(inv)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{inv.source ?? inv.description ?? inv.investment_type}</p>
                      <p className="amount-text shrink-0 text-sm font-bold text-primary">{formatCurrency(inv.amount, project.currency)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(inv.date)} · {inv.payment_method}</p>
                    <Badge variant="outline" className={`mt-2 text-[11px] ${INVESTMENT_TYPE_COLORS[inv.investment_type] ?? ''}`}>{inv.investment_type}</Badge>
                  </button>
                  {rowActions(inv)}
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Source / investor</th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-left">Payment</th>
                    <th className="px-3 py-3 text-left">Reference</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map(inv => (
                    <tr key={inv.id}>
                      <td className="px-5 py-2.5 text-sm text-muted-foreground">{formatDate(inv.date)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-xs ${INVESTMENT_TYPE_COLORS[inv.investment_type] ?? ''}`}>
                          {inv.investment_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{inv.source ?? '—'}</td>
                      <td className="max-w-[220px] px-3 py-2.5 text-sm text-muted-foreground">
                        <span className="block truncate" title={inv.description ?? undefined}>{inv.description ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground">{inv.payment_method}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{inv.reference ?? '—'}</td>
                      <td className="amount-text px-3 py-2.5 text-right text-sm font-semibold text-primary">
                        {formatCurrency(inv.amount, project.currency)}
                      </td>
                      <td className="px-5 py-2.5">{rowActions(inv)}</td>
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

      <AddInvestmentModal
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={project.id}
        userId={user?.id ?? null}
        onSaved={loadData}
      />
      {editInv && (
        <AddInvestmentModal
          open={!!editInv}
          onOpenChange={open => { if (!open) setEditInv(null); }}
          projectId={project.id}
          userId={user?.id ?? null}
          editData={editInv}
          onSaved={() => { setEditInv(null); loadData(); }}
        />
      )}
      {viewInv && (
        <ViewInvestmentModal
          investment={viewInv}
          currency={project.currency}
          onClose={() => setViewInv(null)}
          onEdit={() => { setEditInv(viewInv); setViewInv(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete investment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this investment of <strong>{deleteTarget ? formatCurrency(deleteTarget.amount, project.currency) : ''}</strong>?
              This updates all financial figures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
