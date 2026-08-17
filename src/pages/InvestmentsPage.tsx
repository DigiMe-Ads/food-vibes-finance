import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { getInvestments, deleteInvestment, getFinancialSummary, logActivity } from '@/services/api';
import type { Investment, FinancialSummary } from '@/types/types';
import { canAddData, canDeleteData } from '@/types/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import AddInvestmentModal from '@/components/modals/AddInvestmentModal';
import ViewInvestmentModal from '@/components/modals/ViewInvestmentModal';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const TYPE_COLORS: Record<string, string> = {
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start justify-between mb-1">
          <p className="text-2xl font-bold text-foreground">Investments</p>
          <p className="text-muted-foreground text-sm mt-0.5">Track all funding injected into the project</p>
        </div>
        {canAdd && (
          <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Investment
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Initial Investment', value: summary?.initialInvestment ?? 0, color: 'text-primary' },
          { label: 'Further Investments', value: summary?.furtherInvestments ?? 0, color: 'text-accent' },
          { label: 'Total Investment', value: summary?.totalInvestment ?? 0, color: 'text-foreground', bold: true },
        ].map(item => (
          <Card key={item.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <p className={`text-2xl font-bold amount-text ${item.color}`}>
                  {formatCurrency(item.value, project.currency)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ledger table */}
      <Card className="shadow-card min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Investment Ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : investments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No investments recorded yet.</p>
              {canAdd && (
                <Button variant="ghost" className="mt-2 gap-2 text-primary" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4" /> Add your first investment
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Date', 'Type', 'Source / Investor', 'Description', 'Payment', 'Reference', 'Amount', 'Actions'].map(h => (
                      <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground ${h === 'Amount' ? 'text-right' : ''} ${h === 'Actions' ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investments.map(inv => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${TYPE_COLORS[inv.investment_type] ?? ''}`}>
                          {inv.investment_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{inv.source ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px]">
                        <span className="block truncate">{inv.description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{inv.payment_method}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.reference ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary amount-text text-right">
                        {formatCurrency(inv.amount, project.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewInv(inv)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                          {canAdd && <button onClick={() => setEditInv(inv)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>}
                          {canDel && <button onClick={() => setDeleteTarget(inv)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages} · {totalCount} records</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
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
            <AlertDialogTitle>Delete Investment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this investment of <strong>{deleteTarget ? formatCurrency(deleteTarget.amount, project.currency) : ''}</strong>?
              This will update all financial figures.
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
