import { useState, useCallback, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import {
  getFinancialSummary, getAllExpensesForReport, getExpensesByCategory, getMonthlySummary
} from '@/services/api';
import type { FinancialSummary, Expense, CategorySummary, MonthlyRow } from '@/types/types';
import { PAYMENT_METHODS } from '@/types/types';
import { formatCurrency, formatDate, exportToCSV } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Printer, TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import { getCategories } from '@/services/api';
import type { Category } from '@/types/types';
import { getBudgetStatus } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/PageHeader';

export default function ReportsPage() {
  const { project } = useProject();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: 'all',
    paymentMethod: 'all',
    specificDate: new Date().toISOString().split('T')[0],
  });

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [catSummaries, setCatSummaries] = useState<CategorySummary[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    getCategories(false).then(setCategories);
  }, []);

  const buildFilters = useCallback(() => ({
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
    paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
  }), [filters]);

  const loadAll = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const f = buildFilters();
    const [s, exps, cats, monthly, daily] = await Promise.all([
      getFinancialSummary(project.id),
      getAllExpensesForReport(project.id, f),
      getExpensesByCategory(project.id),
      getMonthlySummary(project.id),
      getAllExpensesForReport(project.id, { dateFrom: filters.specificDate, dateTo: filters.specificDate }),
    ]);
    setSummary(s);
    setExpenses(exps);
    setCatSummaries(cats);
    setMonthlyRows(monthly);
    setDailyExpenses(daily);
    setLoading(false);
  }, [project, buildFilters, filters.specificDate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePrint = () => window.print();

  const handleExportExpenses = () => {
    exportToCSV('expense-report.csv',
      ['Date', 'Description', 'Category', 'Supplier', 'Payment Method', 'Reference', 'Amount'],
      expenses.map(e => [formatDate(e.date), e.description, e.categories?.name ?? '', e.supplier ?? '', e.payment_method, e.reference ?? '', e.amount])
    );
  };

  const handleExportCategory = () => {
    exportToCSV('category-report.csv',
      ['Category', 'Transactions', 'Total Spent', '% of Total'],
      catSummaries.map(c => [c.categoryName, c.count, c.total, c.percentage.toFixed(2) + '%'])
    );
  };

  const handleExportMonthly = () => {
    exportToCSV('monthly-summary.csv',
      ['Month', 'Investment Added', 'Expenses', 'Net Movement', 'Closing Balance'],
      monthlyRows.map(r => [r.monthLabel, r.investmentAdded, r.expenses, r.netMovement, r.closingBalance])
    );
  };

  const handleExportDaily = () => {
    exportToCSV(`daily-expenses-${filters.specificDate}.csv`,
      ['Date', 'Description', 'Category', 'Supplier', 'Payment Method', 'Reference', 'Amount'],
      dailyExpenses.map(e => [formatDate(e.date), e.description, e.categories?.name ?? '', e.supplier ?? '', e.payment_method, e.reference ?? '', e.amount])
    );
  };

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const dailyTotal = dailyExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const budgetStatus = summary ? getBudgetStatus(summary.budgetUtilisedPct) : null;
  const currency = project?.currency ?? 'LKR';

  if (!project) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        className="no-print"
        title="Reports"
        description="Financial analysis and data export."
        actions={
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print page
          </Button>
        }
      />

      {/* Global Filters */}
      <Card className="no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From Date</label>
              <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To Date</label>
              <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={filters.categoryId} onValueChange={v => setFilters(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
              <Select value={filters.paymentMethod} onValueChange={v => setFilters(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue placeholder="All Methods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs defaultValue="summary">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 no-print md:mx-0 md:px-0">
        <TabsList className="h-10 w-max">
          <TabsTrigger value="summary" className="text-xs">Financial Summary</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs">Expense Report</TabsTrigger>
          <TabsTrigger value="category" className="text-xs">By Category</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
        </TabsList>
        </div>

        {/* ── Financial Summary ── */}
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Financial Summary Report</CardTitle>
              <p className="text-xs text-muted-foreground">{project.name}</p>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48" /> : summary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: TrendingUp, label: 'Initial Investment', value: summary.initialInvestment, color: 'text-primary', bg: 'bg-primary/10' },
                      { icon: TrendingUp, label: 'Further Investments', value: summary.furtherInvestments, color: 'text-accent', bg: 'bg-accent/10' },
                      { icon: TrendingUp, label: 'Total Investment', value: summary.totalInvestment, color: 'text-foreground', bg: 'bg-muted', bold: true },
                      { icon: TrendingDown, label: 'Total Expenses', value: summary.totalExpenses, color: 'text-destructive', bg: 'bg-destructive/10' },
                      { icon: Wallet, label: 'Available Balance', value: summary.availableBalance, color: summary.availableBalance < 0 ? 'text-destructive' : 'text-success', bg: summary.availableBalance < 0 ? 'bg-destructive/10' : 'bg-success/10', bold: true },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-4 rounded-xl border border-border p-4">
                        <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                          <item.icon className={`w-5 h-5 ${item.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground">{item.label}</p>
                          <p className={`text-lg font-bold amount-text ${item.color}`}>{formatCurrency(item.value, currency)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                      <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0`}>
                        <BarChart3 className={`w-5 h-5 ${budgetStatus?.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm text-muted-foreground">Budget Utilised</p>
                        <p className={`text-lg font-bold amount-text ${budgetStatus?.color}`}>
                          {summary.budgetUtilisedPct >= 100 ? 'OVER BUDGET' : `${summary.budgetUtilisedPct.toFixed(2)}%`}
                        </p>
                        <Progress value={Math.min(summary.budgetUtilisedPct, 100)} className="h-1.5" indicatorClassName={budgetStatus?.barColor} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Expense Report ── */}
        <TabsContent value="expenses" className="mt-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Expense Report</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportExpenses} className="gap-2 no-print">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><Skeleton className="h-48" /></div> : (
                <>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full min-w-max whitespace-nowrap">
                      <thead>
                        <tr>
                          {['Date', 'Description', 'Category', 'Supplier', 'Payment', 'Reference', 'Amount'].map(h => (
                            <th key={h} className={`text-left px-4 py-3  ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map(exp => (
                          <tr key={exp.id}>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(exp.date)}</td>
                            <td className="px-4 py-2.5 text-sm text-foreground max-w-[180px]"><span className="block truncate">{exp.description}</span></td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.categories?.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.supplier ?? '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.payment_method}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{exp.reference ?? '—'}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-right amount-text">{formatCurrency(exp.amount, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border">
                          <td colSpan={6} className="px-4 py-3 text-sm font-semibold">Total ({expenses.length} expenses)</td>
                          <td className="px-4 py-3 text-sm font-bold text-right amount-text text-destructive">{formatCurrency(expenseTotal, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {expenses.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No expenses for this period.</p>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Category Report ── */}
        <TabsContent value="category" className="mt-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Category Report</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCategory} className="gap-2 no-print">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><Skeleton className="h-48" /></div> : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full min-w-max whitespace-nowrap">
                    <thead>
                      <tr>
                        <th className="text-left px-4 py-3 ">Category</th>
                        <th className="text-right px-4 py-3 ">Transactions</th>
                        <th className="text-right px-4 py-3 ">Total Spent</th>
                        <th className="text-right px-4 py-3 ">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catSummaries.map(cat => (
                        <tr key={cat.categoryId}>
                          <td className="px-4 py-2.5 text-sm font-medium text-foreground">{cat.categoryName}</td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">{cat.count}</td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-right amount-text">{formatCurrency(cat.total, currency)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(cat.percentage, 100)}%` }} />
                              </div>
                              <span className="text-sm text-muted-foreground w-10 text-right">{cat.percentage.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {catSummaries.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No category data.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Daily Report ── */}
        <TabsContent value="daily" className="mt-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Daily Expense Report</CardTitle>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={filters.specificDate}
                  onChange={e => setFilters(f => ({ ...f, specificDate: e.target.value }))}
                  className="h-8 text-sm w-40"
                />
                <Button variant="outline" size="sm" onClick={handleExportDaily} className="gap-2 no-print">
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><Skeleton className="h-32" /></div> : (
                <>
                  <div className="overflow-x-auto">
                    <table className="data-table w-full min-w-max whitespace-nowrap">
                      <thead>
                        <tr>
                          {['Description', 'Category', 'Supplier', 'Payment', 'Reference', 'Amount'].map(h => (
                            <th key={h} className={`text-left px-4 py-3  ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dailyExpenses.map(exp => (
                          <tr key={exp.id}>
                            <td className="px-4 py-2.5 text-sm">{exp.description}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.categories?.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.supplier ?? '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{exp.payment_method}</td>
                            <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{exp.reference ?? '—'}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-right amount-text">{formatCurrency(exp.amount, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border">
                          <td colSpan={5} className="px-4 py-3 text-sm font-semibold">Total Daily Expenses</td>
                          <td className="px-4 py-3 text-sm font-bold text-right amount-text text-destructive">{formatCurrency(dailyTotal, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {dailyExpenses.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No expenses on {formatDate(filters.specificDate)}.</p>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monthly Summary ── */}
        <TabsContent value="monthly" className="mt-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Monthly Financial Summary</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportMonthly} className="gap-2 no-print">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><Skeleton className="h-48" /></div> : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full min-w-max whitespace-nowrap">
                    <thead>
                      <tr>
                        <th className="text-left px-4 py-3 ">Month</th>
                        <th className="text-right px-4 py-3 ">Investment Added</th>
                        <th className="text-right px-4 py-3 ">Expenses</th>
                        <th className="text-right px-4 py-3 ">Net Movement</th>
                        <th className="text-right px-4 py-3 ">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map(row => (
                        <tr key={row.month}>
                          <td className="px-4 py-2.5 text-sm font-medium">{row.monthLabel}</td>
                          <td className="px-4 py-2.5 text-sm text-right amount-text text-primary">{row.investmentAdded > 0 ? formatCurrency(row.investmentAdded, currency) : '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-right amount-text text-destructive">{row.expenses > 0 ? formatCurrency(row.expenses, currency) : '—'}</td>
                          <td className={`px-4 py-2.5 text-sm font-semibold text-right amount-text ${row.netMovement >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {row.netMovement >= 0 ? '+' : ''}{formatCurrency(row.netMovement, currency)}
                          </td>
                          <td className={`px-4 py-2.5 text-sm font-semibold text-right amount-text ${row.closingBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                            {formatCurrency(row.closingBalance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {monthlyRows.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No data available.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
