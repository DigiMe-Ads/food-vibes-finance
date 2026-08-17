import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Investment } from '@/types/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Pencil } from 'lucide-react';

interface Props {
  investment: Investment;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}

export default function ViewInvestmentModal({ investment, currency, onClose, onEdit }: Props) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Date', value: formatDate(investment.date) },
    { label: 'Investment Type', value: <Badge variant="outline">{investment.investment_type}</Badge> },
    { label: 'Investor / Source', value: investment.source ?? '—' },
    { label: 'Description', value: investment.description ?? '—' },
    { label: 'Amount', value: <span className="font-bold text-primary amount-text">{formatCurrency(investment.amount, currency)}</span> },
    { label: 'Payment Method', value: investment.payment_method },
    { label: 'Reference', value: investment.reference ? <span className="font-mono">{investment.reference}</span> : '—' },
    { label: 'Notes', value: investment.notes ?? '—' },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Investment Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-0 divide-y divide-border">
          {fields.map(f => (
            <div key={f.label} className="flex gap-4 py-2.5">
              <dt className="text-sm text-muted-foreground w-36 shrink-0">{f.label}</dt>
              <dd className="text-sm text-foreground flex-1 min-w-0">{f.value}</dd>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit} className="gap-2"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
