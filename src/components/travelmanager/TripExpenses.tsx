'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Hotel,
  Bus,
  Utensils,
  Compass,
  Shield,
  Stamp,
  ShoppingBag,
  Receipt,
  Trash2,
  Plus,
  Upload,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  receiptPath: string | null;
  createdAt: string;
}

interface TripExpensesProps {
  tripId: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}

const categoryIcons: Record<string, React.ReactNode> = {
  FLIGHT: <Plane className="size-4" />,
  HOTEL: <Hotel className="size-4" />,
  TRANSPORT: <Bus className="size-4" />,
  FOOD: <Utensils className="size-4" />,
  ACTIVITIES: <Compass className="size-4" />,
  INSURANCE: <Shield className="size-4" />,
  VISA: <Stamp className="size-4" />,
  SHOPPING: <ShoppingBag className="size-4" />,
  OTHER: <Receipt className="size-4" />,
};

const categoryLabels: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  TRANSPORT: 'Transport',
  FOOD: 'Food',
  ACTIVITIES: 'Activities',
  INSURANCE: 'Insurance',
  VISA: 'Visa',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
};

const categoryColors: Record<string, { badge: string; icon: string }> = {
  FLIGHT: { badge: 'bg-blue-100 text-blue-700', icon: 'bg-blue-100 text-blue-600 ring-blue-200' },
  HOTEL: { badge: 'bg-purple-100 text-purple-700', icon: 'bg-purple-100 text-purple-600 ring-purple-200' },
  TRANSPORT: { badge: 'bg-green-100 text-green-700', icon: 'bg-green-100 text-green-600 ring-green-200' },
  FOOD: { badge: 'bg-orange-100 text-orange-700', icon: 'bg-orange-100 text-orange-600 ring-orange-200' },
  ACTIVITIES: { badge: 'bg-cyan-100 text-cyan-700', icon: 'bg-cyan-100 text-cyan-600 ring-cyan-200' },
  INSURANCE: { badge: 'bg-rose-100 text-rose-700', icon: 'bg-rose-100 text-rose-600 ring-rose-200' },
  VISA: { badge: 'bg-indigo-100 text-indigo-700', icon: 'bg-indigo-100 text-indigo-600 ring-indigo-200' },
  SHOPPING: { badge: 'bg-pink-100 text-pink-700', icon: 'bg-pink-100 text-pink-600 ring-pink-200' },
  OTHER: { badge: 'bg-slate-100 text-slate-700', icon: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export function TripExpenses({ tripId, tripStartDate, tripEndDate }: TripExpensesProps) {
  const { showToast } = useTMToast();
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [budgetAnimated, setBudgetAnimated] = useState(false);

  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('OTHER');
  const [formDate, setFormDate] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    if (!tripStartDate) return today;
    const start = new Date(tripStartDate).toISOString().split('T')[0];
    const end = tripEndDate ? new Date(tripEndDate).toISOString().split('T')[0] : start;
    if (today >= start && today <= end) return today;
    return start;
  });
  const [formDescription, setFormDescription] = useState('');

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent fail on initial load
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setBudget(data.budget ?? null);
      }
    } catch {}
  }, [tripId]);

  useEffect(() => {
    fetchExpenses();
    fetchTrip();
  }, [fetchExpenses, fetchTrip]);

  useEffect(() => {
    if (!loading && budget != null) {
      const timer = setTimeout(() => setBudgetAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, budget]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          category: formCategory,
          date: formDate,
          description: formDescription || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Expense added');
      setFormAmount('');
      setFormCategory('OTHER');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormDescription('');
      setShowForm(false);
      fetchExpenses();
    } catch {
      showToast('Failed to add expense', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Expense deleted');
      setDeleteTarget(null);
      fetchExpenses();
    } catch {
      showToast('Failed to delete expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReceiptUpload = async (expenseId: string, file: File) => {
    setUploadingReceipt(expenseId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      showToast('Receipt uploaded');
      fetchExpenses();
    } catch {
      showToast('Failed to upload receipt', 'error');
    } finally {
      setUploadingReceipt(null);
    }
  };

  const budgetPercent = budget && budget > 0 ? Math.min((total / budget) * 100, 100) : null;
  const overBudget = budget != null && total > budget;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Expenses</h3>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="mr-1 size-3.5" />
          Add Expense
        </Button>
      </div>

      {/* Total + Budget Bar */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 ring-2 ring-amber-200/60">
              <DollarSign className="size-4 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">Total Spent</span>
          </div>
          <span className={`text-xl font-bold ${overBudget ? 'text-red-600' : 'text-slate-800'}`}>
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {budget != null && budget > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Budget: ${budget.toLocaleString()}</span>
              <span>{budgetPercent?.toFixed(0)}% used</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className={`h-full rounded-full ${
                  overBudget ? 'bg-red-500' : budgetPercent! > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: budgetAnimated ? `${budgetPercent}%` : '0%' }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            onSubmit={handleAdd}
            className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/50 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Date *</label>
                <DatePicker
                  date={formDate}
                  onDateChange={setFormDate}
                  minDate={tripStartDate || undefined}
                  maxDate={tripEndDate || undefined}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Uber to airport"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" size="sm" disabled={adding} className="bg-amber-500 hover:bg-amber-600">
                {adding ? 'Adding...' : 'Add'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Expense List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Receipt className="mb-2 size-8 text-slate-300" />
          <p className="text-sm text-slate-400">No expenses yet</p>
          <p className="mt-1 text-xs text-slate-400">Track your spending by adding expenses</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense, i) => {
            const colors = categoryColors[expense.category] || categoryColors.OTHER;
            return (
              <motion.div
                key={expense.id}
                custom={i}
                variants={listItemVariants}
                initial="hidden"
                animate="visible"
                className="group flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-2 ${colors.icon}`}>
                  {categoryIcons[expense.category] || categoryIcons.OTHER}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {expense.description || categoryLabels[expense.category] || expense.category}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(expense.date)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
                  {categoryLabels[expense.category] || expense.category}
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-800">
                  ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setUploadingReceipt(expense.id);
                      receiptInputRef.current?.click();
                    }}
                    disabled={uploadingReceipt === expense.id}
                    className={`cursor-pointer rounded-md p-1.5 transition-all duration-200 ${
                      expense.receiptPath
                        ? 'text-amber-500 hover:bg-amber-100 hover:text-amber-600'
                        : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500 group-hover:text-slate-400'
                    }`}
                    title={expense.receiptPath ? 'Replace receipt' : 'Upload receipt'}
                  >
                    <Upload className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(expense.id)}
                    className="cursor-pointer rounded-md p-1.5 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500 group-hover:text-slate-400"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <input
        ref={receiptInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingReceipt) {
            handleReceiptUpload(uploadingReceipt, file);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
