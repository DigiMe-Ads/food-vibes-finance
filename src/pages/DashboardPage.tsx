import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFinancialSummary, getExpensesByCategory, getSpendingOverTime,
  getInvestmentTimeline, getRecentExpenses
} from '@/services/api';
import type { FinancialSummary, CategorySummary, Expense } from '@/types/types';
import { formatCurrency, formatCurrencyShort, formatDate, getBudgetStatus } from '@/lib/utils';
import { canAddData } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, PieChart as PieIcon,
  Plus, ArrowRight, Calendar, AlertTriangle, CheckCircle2
} from 'lucide-react';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddInvestmentModal from '@/components/modals/AddInvestmentModal';

const CHART_COLORS = [
  '#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#dc2626',
  '#7c3aed', '#0d9488', '#d97706', '#9333ea', '#be123c', '#1d4ed8', '#065f46'
];

type TimeRange = '7d' | '30d' | 'month' | 'custom';
type GroupBy = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
  const { project } = useProject();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [spendingData, setSpendingData] = useState<{ label: string; amount: number }[]>([]);
  const [investmentTimeline, setInvestmentTimeline] = useState<{ date: string; amount: number; type: string }[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [groupBy, setGroupBy] = useState<GroupBy>('daily');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addInvestmentOpen, setAddInvestmentOpen] = useState(false);

  const getDateRange = useCallback((): { from?: string; to?: string } => {
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    if (timeRange === '7d') {
      const from = new Date(today); from.setDate(today.getDate() - 7);
      return { from: from.toISOString().split('T')[0], to: toStr };
    }
    if (timeRange === '30d') {
      const from = new Date(today); from.setDate(today.getDate() - 30);
      return { from: from.toISOString().split('T')[0], to: toStr };
    }
    if (timeRange === 'month') {
      return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: toStr };
    }
    return {};
  }, [timeRange]);

  const loadData = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const { from, to } = getDateRange();
    const [s, cats, spend, inv, recent] = await Promise.all([
      getFinancialSummary(project.id),
      getExpensesByCategory(project.id),
      getSpendingOverTime(project.id, groupBy, from, to),
      getInvestmentTimeline(project.id),
      getRecentExpenses(project.id, 10),
    ]);
    setSummary(s);
    setCategories(cats);
    setSpendingData(spend);
    setInvestmentTimeline(inv);
    setRecentExpenses(recent);
    setLoading(false);
  }, [project, groupBy, getDateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdded = () => { loadData(); };

  if (!project || loading) return <DashboardSkeleton />;

  const budgetStatus = getBudgetStatus(summary?.budgetUtilisedPct ?? 0);

  return (
    <div className="space-y-6">
      {/* Page header + quick actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Financial Overview</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canAddData(profile?.role) && (
            <>
              <Button onClick={() => setAddExpenseOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
              <Button variant="secondary" onClick={() => setAddInvestmentOpen(true)} className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Add Investment
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Investment */}
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Total Investment</p>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground amount-text">
              {formatCurrency(summary?.totalInvestment ?? 0, project.currency)}
            </p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">Initial: {formatCurrency(summary?.initialInvestment ?? 0, project.currency)}</p>
              <p className="text-xs text-muted-foreground">Further: {formatCurrency(summary?.furtherInvestments ?? 0, project.currency)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground amount-text">
              {formatCurrency(summary?.totalExpenses ?? 0, project.currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Today: {formatCurrency(summary?.todayExpenses ?? 0, project.currency)}
            </p>
          </CardContent>
        </Card>

        {/* Available Balance */}
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${(summary?.availableBalance ?? 0) < 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <Wallet className={`w-4 h-4 ${(summary?.availableBalance ?? 0) < 0 ? 'text-destructive' : 'text-success'}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold amount-text ${(summary?.availableBalance ?? 0) < 0 ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(summary?.availableBalance ?? 0, project.currency)}
            </p>
            {(summary?.availableBalance ?? 0) < 0 && (
              <div className="mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <p className="text-xs text-destructive font-medium">OVER BUDGET</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Utilised */}
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Budget Utilised</p>
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <PieIcon className="w-4 h-4 text-accent" />
              </div>
            </div>
            <p className={`text-2xl font-bold amount-text ${budgetStatus.color}`}>
              {(summary?.budgetUtilisedPct ?? 0) >= 100
                ? 'OVER BUDGET'
                : `${(summary?.budgetUtilisedPct ?? 0).toFixed(1)}%`}
            </p>
            <div className="mt-3 space-y-1.5">
              <Progress
                value={Math.min(summary?.budgetUtilisedPct ?? 0, 100)}
                className="h-2"
                indicatorClassName={budgetStatus.barColor}
              />
              <p className={`text-xs font-medium ${budgetStatus.color}`}>{budgetStatus.label}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Initial Investment', value: summary?.initialInvestment ?? 0, color: 'text-primary' },
              { label: 'Further Investments', value: summary?.furtherInvestments ?? 0, color: 'text-accent' },
              { label: 'Total Investment', value: summary?.totalInvestment ?? 0, color: 'text-foreground', bold: true },
              { label: 'Total Expenses', value: summary?.totalExpenses ?? 0, color: 'text-destructive' },
              {
                label: 'Available Balance',
                value: summary?.availableBalance ?? 0,
                color: (summary?.availableBalance ?? 0) < 0 ? 'text-destructive' : 'text-success',
                bold: true
              },
            ].map(item => (
              <div key={item.label} className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-sm font-semibold amount-text ${item.color} ${item.bold ? 'text-base' : ''}`}>
                  {formatCurrency(item.value, project.currency)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending over time */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">Spending Over Time</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="custom">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {spendingData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No expense data for this period.
              </div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spendingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => formatCurrencyShort(v, '')}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v, project.currency), 'Expenses']}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by category */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No expenses yet.</div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={categories.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="total"
                      nameKey="categoryName"
                    >
                      {categories.slice(0, 8).map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n, p) => [
                        `${formatCurrency(v, project.currency)} (${p.payload.percentage.toFixed(1)}%)`,
                        p.payload.categoryName
                      ]}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {categories.slice(0, 5).map((cat, idx) => (
                    <button
                      key={cat.categoryId}
                      onClick={() => navigate(`/expenses?category=${cat.categoryId}`)}
                      className="w-full flex items-center gap-2 text-left hover:bg-muted/50 rounded-md px-1.5 py-1 transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <span className="text-xs text-foreground flex-1 min-w-0 truncate">{cat.categoryName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{cat.percentage.toFixed(1)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Investment timeline */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Investment History</CardTitle>
        </CardHeader>
        <CardContent>
          {investmentTimeline.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">No investments recorded yet.</div>
          ) : (
            <div className="space-y-0">
              {investmentTimeline.map((inv, idx) => (
                <div key={idx} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground w-24">{formatDate(inv.date)}</span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{inv.type}</Badge>
                  <span className="text-sm font-semibold text-primary amount-text ml-auto shrink-0">
                    {formatCurrency(inv.amount, project.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Expenses</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')} className="gap-1 text-xs">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentExpenses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No expenses recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Date', 'Description', 'Category', 'Supplier', 'Amount'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map(exp => (
                    <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(exp.date)}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs">
                        <span className="block truncate">{exp.description}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {exp.categories && (
                          <Badge variant="secondary" className="text-xs">{exp.categories.name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{exp.supplier ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground amount-text whitespace-nowrap text-right">
                        {formatCurrency(exp.amount, project.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddExpenseModal
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        projectId={project.id}
        userId={user?.id ?? null}
        onSaved={handleAdded}
      />
      <AddInvestmentModal
        open={addInvestmentOpen}
        onOpenChange={setAddInvestmentOpen}
        projectId={project.id}
        userId={user?.id ?? null}
        onSaved={handleAdded}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
        <div className="flex gap-3"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-36" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
