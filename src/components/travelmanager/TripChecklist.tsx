'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Square, X, Plus, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  sortOrder: number;
}

interface TripChecklistProps {
  tripId: string;
}

const QUICK_ADD_ITEMS = [
  'Pack passport',
  'Book transport',
  'Travel insurance',
  'Hotel confirmation',
  'Print documents',
  'Currency exchange',
  'Notify bank',
  'Check-in online',
];

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.25, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, x: 8, transition: { duration: 0.2 } },
};

export function TripChecklist({ tripId }: TripChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/checklists`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [tripId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (label: string) => {
    if (!label.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), sortOrder: items.length }),
      });
      if (res.ok) {
        const item = await res.json();
        setItems((prev) => [...prev, item]);
        setNewLabel('');
      }
    } catch {}
    finally { setAdding(false); }
  };

  const toggleItem = async (item: ChecklistItem) => {
    const newChecked = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i))
    );
    try {
      await fetch(`/api/checklists/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: newChecked }),
      });
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, checked: !newChecked } : i))
      );
    }
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/checklists/${id}`, { method: 'DELETE' });
    } catch {
      fetchItems();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const checked = items.filter((i) => i.checked);
  const unchecked = items.filter((i) => !i.checked);
  const sorted = [...unchecked, ...checked];
  const total = items.length;
  const doneCount = checked.length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  const existingLabels = new Set(items.map((i) => i.label.toLowerCase()));
  const availableQuickAdd = QUICK_ADD_ITEMS.filter(
    (label) => !existingLabels.has(label.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">Checklist</h3>

      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {doneCount}/{total} done
            </span>
            <span className={`font-medium ${progress === 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Check className="mb-2 size-8 text-slate-300" />
          <p className="text-sm text-slate-400">No items yet. Add your first checklist item below.</p>
        </div>
      ) : (
        <ul className="space-y-1">
          <AnimatePresence mode="popLayout">
            {sorted.map((item, i) => (
              <motion.li
                key={item.id}
                custom={i}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ${
                  item.checked ? 'bg-slate-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  onClick={() => toggleItem(item)}
                  className="flex-shrink-0 transition-transform duration-200 active:scale-90"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {item.checked ? (
                      <motion.div
                        key="checked"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="unchecked"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        <Square className="size-5 text-slate-300 transition-colors group-hover:text-amber-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                <motion.span
                  animate={{
                    color: item.checked ? 'rgb(148 163 184)' : 'rgb(51 65 85)',
                  }}
                  transition={{ duration: 0.25 }}
                  className={`flex-1 text-sm ${item.checked ? 'line-through decoration-slate-300' : ''}`}
                >
                  {item.label}
                </motion.span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="flex-shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newLabel.trim()) addItem(newLabel);
          }}
          placeholder="Add an item..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-colors duration-200 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          disabled={adding}
        />
        <Button
          size="sm"
          onClick={() => addItem(newLabel)}
          disabled={adding || !newLabel.trim()}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {availableQuickAdd.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-600"
          >
            Quick add common items
            <motion.span
              animate={{ rotate: quickAddOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="size-3" />
            </motion.span>
          </button>
          <AnimatePresence>
            {quickAddOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-1">
                  {availableQuickAdd.map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        addItem(label);
                        setQuickAddOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-150 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Plus className="size-3 text-slate-400" />
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
