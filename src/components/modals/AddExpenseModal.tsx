import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Expense, PaymentMethod } from '@/types/types';
import { PAYMENT_METHODS } from '@/types/types';
import { addExpense, updateExpense, getCategories, uploadReceiptFile, logActivity } from '@/services/api';
import type { Category } from '@/types/types';
import { todayStr } from '@/lib/utils';
import { toast } from 'sonner';
import { Paperclip, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string | null;
  editData?: Expense | null;
  onSaved: () => void;
}

const INITIAL_FORM = {
  date: todayStr(),
  description: '',
  category_id: '',
  supplier: '',
  amount: '',
  payment_method: 'Cash' as PaymentMethod,
  reference: '',
  notes: '',
};

export default function AddExpenseModal({ open, onOpenChange, projectId, userId, editData, onSaved }: Props) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAndAdd, setSaveAndAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      getCategories(true).then(setCategories);
      if (editData) {
        setForm({
          date: editData.date,
          description: editData.description,
          category_id: editData.category_id ?? '',
          supplier: editData.supplier ?? '',
          amount: String(editData.amount),
          payment_method: editData.payment_method,
          reference: editData.reference ?? '',
          notes: editData.notes ?? '',
        });
      } else {
        setForm({ ...INITIAL_FORM, date: todayStr() });
        setFile(null);
      }
    }
  }, [open, editData]);

  const validate = () => {
    if (!form.date) { toast.error('Date is required.'); return false; }
    if (!form.description.trim()) { toast.error('Description is required.'); return false; }
    if (!form.category_id) { toast.error('Category is required.'); return false; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) { toast.error('Valid amount is required.'); return false; }
    return true;
  };

  const handleSave = async (addAnother = false) => {
    if (!validate()) return;
    setSaving(true);
    setSaveAndAdd(addAnother);

    try {
      const amount = parseFloat(form.amount);
      const payload = {
        project_id: projectId,
        date: form.date,
        description: form.description.trim(),
        category_id: form.category_id || null,
        supplier: form.supplier.trim() || null,
        amount,
        payment_method: form.payment_method,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        attachment_url: editData?.attachment_url ?? null,
        attachment_name: editData?.attachment_name ?? null,
        created_by: userId,
      };

      let savedId = editData?.id ?? null;

      if (isEdit) {
        await updateExpense(editData!.id, payload);
        await logActivity(userId, 'Expense Updated', 'expense', editData!.id, editData, payload);
        toast.success('Expense updated.');
      } else {
        const saved = await addExpense(payload);
        savedId = saved?.id ?? null;
        await logActivity(userId, 'Expense Created', 'expense', savedId, null, payload);
        toast.success('Expense saved.');
      }

      // Upload receipt if provided
      if (file && savedId) {
        const url = await uploadReceiptFile(file, savedId);
        if (url) {
          await updateExpense(savedId, { attachment_url: url, attachment_name: file.name });
        }
      }

      onSaved();
      if (addAnother) {
        setForm({ ...INITIAL_FORM, date: form.date });
        setFile(null);
      } else {
        onOpenChange(false);
      }
    } catch {
      toast.error('Failed to save expense.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Category <span className="text-destructive">*</span></Label>
            <Select value={form.category_id || 'none'} onValueChange={v => setForm(f => ({ ...f, category_id: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
              <SelectContent>
                {categories.length === 0 && <SelectItem value="none" disabled>No active categories</SelectItem>}
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Description / Expense Item <span className="text-destructive">*</span></Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Floor tiles for dining area" />
          </div>

          <div className="space-y-1.5">
            <Label>Supplier / Paid To</Label>
            <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Supplier name" />
          </div>

          <div className="space-y-1.5">
            <Label>Amount ({'\u0028LKR\u0029'} <span className="text-destructive">*</span></Label>
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
            <Label>Payment Method <span className="text-destructive">*</span></Label>
            <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v as PaymentMethod }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reference / Invoice No.</Label>
            <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="INV-2026-001" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Receipt / Invoice</Label>
            {editData?.attachment_url && !file && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <Paperclip className="w-3.5 h-3.5" />
                <a href={editData.attachment_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {editData.attachment_name ?? 'View Receipt'}
                </a>
              </div>
            )}
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="w-3.5 h-3.5 text-accent" />
                <span className="flex-1 min-w-0 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              >
                <p className="text-sm text-muted-foreground">Click to upload PDF, JPG, JPEG, or PNG</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isEdit && (
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
              {saving && saveAndAdd ? 'Saving…' : 'Save & Add Another'}
            </Button>
          )}
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving && !saveAndAdd ? 'Saving…' : isEdit ? 'Update' : 'Save Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
