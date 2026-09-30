import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFinancialSummary, getExpensesByCategory, getSpendingOverTime,
  getInvestmentTimeline, getRecentExpenses
} from '@/services/api';
import type { FinancialSummary, CategorySummary, Expense } from '@/types/types';
import { formatCurrency, formatCurrencyShort, formatDate, getBudgetStatus, cn, displayName } from '@/lib/utils';
import { canAddData } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Gauge, Plus, ArrowRight, AlertTriangle, CheckCircle2,
  Receipt, PiggyBank, BarChart3,
} from 'lucide-react';
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddInvestmentModal from '@/components/modals/AddInvestmentModal';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';

type TimeRange = '7d' | '30d' | 'month' | 'custom';
type GroupBy = 'daily' | 'weekly' | 'monthly';

const TOP_CATEGORIES = 6;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

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
  const [chartLoading, setChartLoading] = useState(false);
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
    const [s, cats, inv, recent] = await Promise.all([
      getFinancialSummary(project.id),
      getExpensesByCategory(project.id),
      getInvestmentTimeline(project.id),
      getRecentExpenses(project.id, 8),
    ]);
    setSummary(s);
    setCategories(cats);
    setInvestmentTimeline(inv);
    setRecentExpenses(recent);
    setLoading(false);
  }, [project]);

  // The spending chart reloads on its own so changing its filters doesn't blank the whole page
  const loadChart = useCallback(async () => {
    if (!project) return;
    setChartLoading(true);
    const { from, to } = getDateRange();
    setSpendingData(await getSpendingOverTime(project.id, groupBy, from, to));
    setChartLoading(false);
  }, [project, groupBy, getDateRange]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadChart(); }, [loadChart]);

  const handleAdded = () => { loadData(); loadChart(); };

  if (!project || loading) return <DashboardSkeleton />;

  const pct = summary?.budgetUtilisedPct ?? 0;
  const budgetStatus = getBudgetStatus(pct);
  const balance = summary?.availableBalance ?? 0;
  const overBudget = balance < 0;
  const topCats = categories.slice(0, TOP_CATEGORIES);
  const maxCat = Math.max(...topCats.map(c => c.total), 1);
  const periodTotal = spendingData.reduce((s, d) => s + d.amount, 0);
  const name = displayName(profile?.email ?? user?.email, profile?.username);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${name}`}
        description={<>Here's where <span className="font-medium text-foreground">{project.name}</span> stands today.</>}
        actions={canAddData(profile?.role) && (
          <>
            <Button variant="outline" onClick={() => setAddInvestmentOpen(true)} className="gap-2">
              <TrendingUp className="h-4 w-4" /> Add investment
            </Button>
            <Button onClick={() => setAddExpenseOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </>
        )}
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total investment"
          icon={PiggyBank}
          tone="primary"
          value={formatCurrency(summary?.totalInvestment ?? 0, project.currency)}
          footer={
            <div className="space-y-1">
              <div className="flex justify-between gap-2"><span>Initial</span><span className="amount-text font-medium text-foreground">{formatCurrency(summary?.initialInvestment ?? 0, project.currency)}</span></div>
              <div className="flex justify-between gap-2"><span>Further</span><span className="amount-text font-medium text-foreground">{formatCurrency(summary?.furtherInvestments ?? 0, project.currency)}</span></div>
            </div>
          }
        />
        <StatCard
          label="Total spent"
          icon={TrendingDown}
          tone="destructive"
          value={formatCurrency(summary?.totalExpenses ?? 0, project.currency)}
          footer={<div className="flex justify-between gap-2"><span>Spent today</span><span className="amount-text font-medium text-foreground">{formatCurrency(summary?.todayExpenses ?? 0, project.currency)}</span></div>}
        />
        <StatCard
          label="Available balance"
          icon={Wallet}
          tone={overBudget ? 'destructive' : 'success'}
          valueClassName={overBudget ? 'text-destructive' : 'text-success'}
          value={formatCurrency(balance, project.currency)}
          footer={overBudget
            ? <span className="flex items-center gap-1.5 font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Over budget</span>
            : <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Within budget</span>}
        />
        <StatCard
          label="Budget utilised"
          icon={Gauge}
          tone="accent"
          valueClassName={budgetStatus.color}
          value={pct >= 100 ? 'Over budget' : `${pct.toFixed(1)}%`}
          footer={
            <div className="space-y-2">
              <Progress value={Math.min(pct, 100)} className="h-2" indicatorClassName={budgetStatus.barColor} />
              <p className={cn('font-medium', budgetStatus.color)}>{budgetStatus.label}</p>
            </div>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">Spending over time</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="amount-text font-semibold text-foreground">{formatCurrency(periodTotal, project.currency)}</span> in this period
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Group by">
                  {(['daily', 'weekly', 'monthly'] as GroupBy[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      aria-pressed={groupBy === g}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                        groupBy === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="custom">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading && spendingData.length === 0 ? (
              <Skeleton className="h-[300px] w-full" />
            ) : spendingData.length === 0 ? (
              <EmptyState icon={BarChart3} title="No expenses in this period" description="Try a longer time range." className="h-[300px] py-0" />
            ) : (
              <div className={cn('w-full min-w-0 overflow-hidden transition-opacity', chartLoading && 'opacity-50')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={spendingData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.7} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={v => formatCurrencyShort(v, '').trim()}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
                      formatter={(v: number) => [formatCurrency(v, project.currency), 'Spent']}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 2 }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-hover)' }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top categories — ranked bars read more precisely than a many-slice donut */}
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top categories</CardTitle>
              <span className="text-xs text-muted-foreground">of total spend</span>
            </div>
          </CardHeader>
          <CardContent>
            {topCats.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses yet" className="py-8" />
            ) : (
              <ul className="space-y-1">
                {topCats.map(cat => (
                  <li key={cat.categoryId}>
                    <button
                      onClick={() => navigate(`/expenses?category=${cat.categoryId}`)}
                      className="group w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                      title={`View ${cat.categoryName} expenses`}
                    >
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">{cat.categoryName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <span className="amount-text font-semibold text-foreground">{formatCurrencyShort(cat.total, '').trim()}</span> · {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(cat.total / maxCat) * 100}%` }} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {categories.length > TOP_CATEGORIES && (
              <p className="mt-3 px-2 text-xs text-muted-foreground">+ {categories.length - TOP_CATEGORIES} more categories in Reports</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent expenses + investments */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent expenses</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')} className="gap-1 text-primary">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          {recentExpenses.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses recorded yet" />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {recentExpenses.map(exp => (
                <li key={exp.id} className="flex items-center gap-3 px-6 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{exp.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(exp.date)}
                      {exp.categories && <> · {exp.categories.name}</>}
                      {exp.supplier && <> · {exp.supplier}</>}
                    </p>
                  </div>
                  <span className="amount-text shrink-0 text-sm font-semibold text-foreground">
                    {formatCurrency(exp.amount, project.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Investment history</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/investments')} className="gap-1 text-primary">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          {investmentTimeline.length === 0 ? (
            <EmptyState icon={PiggyBank} title="No investments recorded yet" />
          ) : (
            <ul className="max-h-[480px] divide-y divide-border overflow-y-auto border-t border-border">
              {investmentTimeline.map((inv, idx) => (
                <li key={idx} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{inv.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                  </div>
                  <span className="amount-text shrink-0 text-sm font-semibold text-primary">
                    +{formatCurrency(inv.amount, project.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
      <div className="flex items-end justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-48" /></div>
        <div className="flex gap-2"><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-32" /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
