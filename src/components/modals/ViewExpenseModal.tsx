import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Expense } from '@/types/types';
import { formatCurrency, formatDate, formatExpenseId } from '@/lib/utils';
import { Paperclip, Pencil, ExternalLink } from 'lucide-react';

interface Props {
  expense: Expense;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}

export default function ViewExpenseModal({ expense, currency, onClose, onEdit }: Props) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Expense ID', value: <span className="font-mono text-sm">{formatExpenseId(expense.id)}</span> },
    { label: 'Date', value: formatDate(expense.date) },
    { label: 'Description', value: expense.description },
    { label: 'Category', value: expense.categories ? <Badge variant="secondary">{expense.categories.name}</Badge> : '—' },
    { label: 'Supplier / Paid To', value: expense.supplier ?? '—' },
    { label: 'Amount', value: <span className="font-bold text-foreground amount-text">{formatCurrency(expense.amount, currency)}</span> },
    { label: 'Payment Method', value: expense.payment_method },
    { label: 'Reference / Invoice', value: expense.reference ? <span className="font-mono">{expense.reference}</span> : '—' },
    { label: 'Notes', value: expense.notes ?? '—' },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Expense Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-0 divide-y divide-border">
          {fields.map(f => (
            <div key={f.label} className="flex gap-4 py-2.5">
              <dt className="text-sm text-muted-foreground w-36 shrink-0">{f.label}</dt>
              <dd className="text-sm text-foreground flex-1 min-w-0">{f.value}</dd>
            </div>
          ))}
        </div>

        {expense.attachment_url && (
          <div className="mt-2 p-3 border border-border rounded-lg flex items-center gap-3">
            <Paperclip className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm flex-1 min-w-0 truncate">{expense.attachment_name ?? 'Receipt/Invoice'}</span>
            <a
              href={expense.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit} className="gap-2"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
