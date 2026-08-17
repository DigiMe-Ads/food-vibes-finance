import { supabase } from '@/db/supabase';
import type {
  Project, Category, Investment, Expense, ActivityLog,
  ExpenseFilters, FinancialSummary, CategorySummary, MonthlyRow
} from '@/types/types';

const PAGE_SIZE = 20;

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getDefaultProject(): Promise<Project | null> {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('is_default', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getAllProjects(): Promise<Project[]> {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  return Array.isArray(data) ? data : [];
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  await supabase.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(onlyActive = false): Promise<Category[]> {
  let query = supabase.from('categories').select('*').order('sort_order', { ascending: true }).limit(100);
  if (onlyActive) query = query.eq('is_active', true);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function addCategory(name: string, description?: string): Promise<void> {
  await supabase.from('categories').insert({ name, description: description || null, is_active: true });
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  await supabase.from('categories').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function disableCategory(id: string): Promise<void> {
  await supabase.from('categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function getCategoryExpenseCount(id: string): Promise<number> {
  const { count } = await supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('category_id', id);
  return count ?? 0;
}

// ─── Investments ─────────────────────────────────────────────────────────────

export async function getInvestments(projectId: string, page = 0): Promise<{ data: Investment[]; count: number }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await supabase
    .from('investments')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

export async function addInvestment(investment: Omit<Investment, 'id' | 'created_at' | 'updated_at'>): Promise<Investment | null> {
  const { data } = await supabase
    .from('investments')
    .insert(investment)
    .select()
    .maybeSingle();
  return data;
}

export async function updateInvestment(id: string, updates: Partial<Investment>): Promise<void> {
  await supabase.from('investments').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteInvestment(id: string): Promise<void> {
  await supabase.from('investments').delete().eq('id', id);
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const { data } = await supabase.from('investments').select('*').eq('id', id).maybeSingle();
  return data;
}

// ─── Expenses ─────────────────────────────────────────────────────────────

export async function getExpenses(
  projectId: string,
  filters: ExpenseFilters = {},
  page = 0,
  sortCol = 'date',
  sortDir: 'asc' | 'desc' = 'desc'
): Promise<{ data: Expense[]; count: number }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('expenses')
    .select('*, categories!category_id(id, name, is_active)', { count: 'exact' })
    .eq('project_id', projectId);

  if (filters.search) {
    query = query.or(`description.ilike.%${filters.search}%,supplier.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`);
  }
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.supplier) query = query.ilike('supplier', `%${filters.supplier}%`);
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
  if (filters.minAmount !== undefined) query = query.gte('amount', filters.minAmount);
  if (filters.maxAmount !== undefined) query = query.lte('amount', filters.maxAmount);

  query = query.order(sortCol, { ascending: sortDir === 'asc' }).range(from, to);

  const { data, count } = await query;
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

export async function getRecentExpenses(projectId: string, limit = 10): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select('*, categories!category_id(id, name, is_active)')
    .eq('project_id', projectId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  return Array.isArray(data) ? data : [];
}

export async function getAllExpensesForReport(
  projectId: string,
  filters: ExpenseFilters = {}
): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*, categories!category_id(id, name, is_active)')
    .eq('project_id', projectId);

  if (filters.search) {
    query = query.or(`description.ilike.%${filters.search}%,supplier.ilike.%${filters.search}%`);
  }
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.supplier) query = query.ilike('supplier', `%${filters.supplier}%`);
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
  if (filters.minAmount !== undefined) query = query.gte('amount', filters.minAmount);
  if (filters.maxAmount !== undefined) query = query.lte('amount', filters.maxAmount);

  query = query.order('date', { ascending: false }).limit(5000);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function addExpense(expense: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'categories'>): Promise<Expense | null> {
  const { data } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .maybeSingle();
  return data;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
  const { categories: _c, ...rest } = updates as Partial<Expense>;
  await supabase.from('expenses').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteExpense(id: string): Promise<void> {
  await supabase.from('expenses').delete().eq('id', id);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const { data } = await supabase
    .from('expenses')
    .select('*, categories!category_id(id, name, is_active)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

// ─── Financial Summary ────────────────────────────────────────────────────

export async function getFinancialSummary(projectId: string): Promise<FinancialSummary> {
  const today = new Date().toISOString().split('T')[0];

  const [invResult, expResult, todayResult] = await Promise.all([
    supabase.from('investments').select('investment_type, amount').eq('project_id', projectId).limit(5000),
    supabase.from('expenses').select('amount').eq('project_id', projectId).limit(5000),
    supabase.from('expenses').select('amount').eq('project_id', projectId).eq('date', today).limit(5000),
  ]);

  const investments = Array.isArray(invResult.data) ? invResult.data : [];
  const expenses = Array.isArray(expResult.data) ? expResult.data : [];
  const todayExp = Array.isArray(todayResult.data) ? todayResult.data : [];

  const initialInvestment = investments
    .filter(i => i.investment_type === 'Initial Investment')
    .reduce((s, i) => s + Number(i.amount), 0);

  const totalInvestment = investments.reduce((s, i) => s + Number(i.amount), 0);
  const furtherInvestments = totalInvestment - initialInvestment;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const availableBalance = totalInvestment - totalExpenses;
  const budgetUtilisedPct = totalInvestment > 0 ? (totalExpenses / totalInvestment) * 100 : 0;
  const todayExpenses = todayExp.reduce((s, e) => s + Number(e.amount), 0);

  return { initialInvestment, furtherInvestments, totalInvestment, totalExpenses, availableBalance, budgetUtilisedPct, todayExpenses };
}

// ─── Chart Data ───────────────────────────────────────────────────────────

export async function getExpensesByCategory(projectId: string): Promise<CategorySummary[]> {
  const { data } = await supabase
    .from('expenses')
    .select('amount, categories!category_id(id, name)')
    .eq('project_id', projectId)
    .limit(5000);

  if (!Array.isArray(data)) return [];

  const map = new Map<string, { name: string; total: number; count: number }>();
  let grandTotal = 0;

  for (const row of data) {
    const cat = (row.categories as unknown) as { id: string; name: string } | null;
    const catId = cat?.id ?? 'uncategorized';
    const catName = cat?.name ?? 'Uncategorized';
    const amt = Number(row.amount);
    grandTotal += amt;
    const existing = map.get(catId);
    if (existing) {
      existing.total += amt;
      existing.count += 1;
    } else {
      map.set(catId, { name: catName, total: amt, count: 1 });
    }
  }

  return Array.from(map.entries())
    .map(([catId, v]) => ({
      categoryId: catId,
      categoryName: v.name,
      count: v.count,
      total: v.total,
      percentage: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getSpendingOverTime(
  projectId: string,
  groupBy: 'daily' | 'weekly' | 'monthly',
  dateFrom?: string,
  dateTo?: string
): Promise<{ label: string; amount: number }[]> {
  let query = supabase
    .from('expenses')
    .select('date, amount')
    .eq('project_id', projectId)
    .limit(5000);

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  query = query.order('date', { ascending: true });

  const { data } = await query;
  if (!Array.isArray(data)) return [];

  const map = new Map<string, number>();

  for (const row of data) {
    const d = new Date(row.date + 'T00:00:00');
    let key: string;
    if (groupBy === 'daily') {
      key = row.date;
    } else if (groupBy === 'weekly') {
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = mon.toISOString().split('T')[0];
    } else {
      key = row.date.substring(0, 7);
    }
    map.set(key, (map.get(key) ?? 0) + Number(row.amount));
  }

  return Array.from(map.entries()).map(([label, amount]) => ({ label, amount }));
}

export async function getInvestmentTimeline(projectId: string): Promise<{ date: string; amount: number; type: string }[]> {
  const { data } = await supabase
    .from('investments')
    .select('date, amount, investment_type')
    .eq('project_id', projectId)
    .order('date', { ascending: true })
    .limit(100);
  return Array.isArray(data) ? data.map(r => ({ date: r.date, amount: Number(r.amount), type: r.investment_type })) : [];
}

// ─── Monthly Summary ──────────────────────────────────────────────────────

export async function getMonthlySummary(projectId: string): Promise<MonthlyRow[]> {
  const [invData, expData] = await Promise.all([
    supabase.from('investments').select('date, amount').eq('project_id', projectId).order('date').limit(5000),
    supabase.from('expenses').select('date, amount').eq('project_id', projectId).order('date').limit(5000),
  ]);

  const investments = Array.isArray(invData.data) ? invData.data : [];
  const expenses = Array.isArray(expData.data) ? expData.data : [];

  const monthSet = new Set<string>();
  [...investments, ...expenses].forEach(r => monthSet.add(r.date.substring(0, 7)));
  const months = Array.from(monthSet).sort();

  let runningBalance = 0;
  return months.map(ym => {
    const investmentAdded = investments.filter(r => r.date.startsWith(ym)).reduce((s, r) => s + Number(r.amount), 0);
    const exp = expenses.filter(r => r.date.startsWith(ym)).reduce((s, r) => s + Number(r.amount), 0);
    const netMovement = investmentAdded - exp;
    runningBalance += netMovement;
    const [year, month] = ym.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      month: ym,
      monthLabel: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      investmentAdded,
      expenses: exp,
      netMovement,
      closingBalance: runningBalance,
    };
  });
}

// ─── Activity Logs ────────────────────────────────────────────────────────

export async function logActivity(
  userId: string | null,
  action: string,
  recordType: string,
  recordId: string | null,
  previousValue?: object | null,
  newValue?: object | null
): Promise<void> {
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action,
    record_type: recordType,
    record_id: recordId,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
  });
}

// ─── Storage ──────────────────────────────────────────────────────────────

export async function uploadReceiptFile(file: File, expenseId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `receipts/${expenseId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export const PAGE_SIZE_EXPORT = PAGE_SIZE;
