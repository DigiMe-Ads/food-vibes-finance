import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Investment, InvestmentType, InvestmentPaymentMethod } from '@/types/types';
import { INVESTMENT_TYPES, INVESTMENT_PAYMENT_METHODS } from '@/types/types';
import { addInvestment, updateInvestment, logActivity } from '@/services/api';
import { todayStr } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string | null;
  editData?: Investment | null;
  onSaved: () => void;
}

const INITIAL_FORM = {
  date: todayStr(),
  investment_type: 'Initial Investment' as InvestmentType,
  source: '',
  description: '',
  amount: '',
  payment_method: 'Bank Transfer' as InvestmentPaymentMethod,
  reference: '',
  notes: '',
};

export default function AddInvestmentModal({ open, onOpenChange, projectId, userId, editData, onSaved }: Props) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          date: editData.date,
          investment_type: editData.investment_type,
          source: editData.source ?? '',
          description: editData.description ?? '',
          amount: String(editData.amount),
          payment_method: editData.payment_method,
          reference: editData.reference ?? '',
          notes: editData.notes ?? '',
        });
      } else {
        setForm({ ...INITIAL_FORM, date: todayStr() });
      }
    }
  }, [open, editData]);

  const validate = () => {
    if (!form.date) { toast.error('Date is required.'); return false; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { toast.error('Valid amount is required.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        date: form.date,
        investment_type: form.investment_type,
        source: form.source.trim() || null,
        description: form.description.trim() || null,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        created_by: userId,
      };

      if (isEdit) {
        await updateInvestment(editData!.id, payload);
        await logActivity(userId, 'Investment Updated', 'investment', editData!.id, editData, payload);
        toast.success('Investment updated.');
      } else {
        const saved = await addInvestment(payload);
        await logActivity(userId, 'Investment Created', 'investment', saved?.id ?? null, null, payload);
        toast.success('Investment saved.');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save investment.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Investment' : 'Add Investment'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Investment Type <span className="text-destructive">*</span></Label>
            <Select value={form.investment_type} onValueChange={v => setForm(f => ({ ...f, investment_type: v as InvestmentType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Investor / Source</Label>
            <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Investor or source name" />
          </div>

          <div className="space-y-1.5">
            <Label>Amount (LKR) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v as InvestmentPaymentMethod }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTMENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Cheque no., transfer ref…" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Save Investment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
