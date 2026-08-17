// Core types matching database schema

export type UserRole = 'admin' | 'accounts' | 'viewer' | 'user';

export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin',    label: 'Admin',    description: 'Full access — manage users, all data, delete records' },
  { value: 'accounts', label: 'Accounts', description: 'Add expenses & investments; cannot delete data' },
  { value: 'viewer',   label: 'Viewer',   description: 'Read-only access to dashboard, expenses & investments' },
];

export function canAddData(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'accounts';
}
export function canDeleteData(role: UserRole | undefined): boolean {
  return role === 'admin';
}
export function canManageUsers(role: UserRole | undefined): boolean {
  return role === 'admin';
}
export type ProjectStatus = 'Planning' | 'Construction' | 'Fit-Out' | 'Pre-Opening' | 'Completed' | 'On Hold';
export type InvestmentType = 'Initial Investment' | 'Additional Investment' | 'Owner Injection' | 'Partner Investment' | 'Loan / Borrowed Funds' | 'Other Funding';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Debit Card' | 'Cheque' | 'Other';
export type InvestmentPaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  status: ProjectStatus;
  notes: string | null;
  is_default: boolean;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  project_id: string;
  date: string;
  investment_type: InvestmentType;
  source: string | null;
  description: string | null;
  amount: number;
  payment_method: InvestmentPaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  project_id: string;
  date: string;
  description: string;
  category_id: string | null;
  supplier: string | null;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  categories?: Category | null;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  record_type: string;
  record_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

// Dashboard computed data
export interface FinancialSummary {
  initialInvestment: number;
  furtherInvestments: number;
  totalInvestment: number;
  totalExpenses: number;
  availableBalance: number;
  budgetUtilisedPct: number;
  todayExpenses: number;
}

// Report types
export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  count: number;
  total: number;
  percentage: number;
}

export interface MonthlyRow {
  month: string; // 'YYYY-MM'
  monthLabel: string;
  investmentAdded: number;
  expenses: number;
  netMovement: number;
  closingBalance: number;
}

export interface ExpenseFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  supplier?: string;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const PROJECT_STATUSES: ProjectStatus[] = ['Planning', 'Construction', 'Fit-Out', 'Pre-Opening', 'Completed', 'On Hold'];
export const INVESTMENT_TYPES: InvestmentType[] = ['Initial Investment', 'Additional Investment', 'Owner Injection', 'Partner Investment', 'Loan / Borrowed Funds', 'Other Funding'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Cheque', 'Other'];
export const INVESTMENT_PAYMENT_METHODS: InvestmentPaymentMethod[] = ['Cash', 'Bank Transfer', 'Cheque', 'Other'];
