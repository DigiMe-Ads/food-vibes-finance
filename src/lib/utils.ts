import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency: LKR 1,250,000.00
export function formatCurrency(amount: number, currency = 'LKR'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format short currency (no decimals for large amounts in charts)
export function formatCurrencyShort(amount: number, currency = 'LKR'): string {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount, currency);
}

// Format date: 15 Aug 2026
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Format date: YYYY-MM-DD (for inputs)
export function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  return dateStr.split('T')[0];
}

// Get today YYYY-MM-DD
export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Budget status
export function getBudgetStatus(pct: number): { label: string; color: string; barColor: string } {
  if (pct >= 100) return { label: 'Over Budget', color: 'text-destructive', barColor: 'bg-destructive' };
  if (pct >= 85) return { label: 'Warning', color: 'text-destructive', barColor: 'bg-destructive' };
  if (pct >= 70) return { label: 'Attention', color: 'text-warning', barColor: 'bg-warning' };
  return { label: 'Normal', color: 'text-success', barColor: 'bg-success' };
}

// Truncate text
export function truncate(str: string, n: number): string {
  return str.length > n ? str.substring(0, n) + '…' : str;
}

// Generate expense ID display
export function formatExpenseId(id: string): string {
  return 'EXP-' + id.substring(0, 6).toUpperCase();
}

// Export to CSV
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Month label from YYYY-MM
export function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
