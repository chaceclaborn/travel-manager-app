'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  Shield,
  HeartPulse,
  Car,
  Pencil,
  Trash2,
  X,
  BookOpen,
  FileCheck2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TravelDocument, DocumentType } from '@/lib/travelmanager/types';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VISA', label: 'Visa' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'VACCINATION', label: 'Vaccination' },
  { value: 'OTHER', label: 'Other' },
];

function getDocIcon(type: DocumentType) {
  switch (type) {
    case 'PASSPORT':
      return BookOpen;
    case 'VISA':
      return FileCheck2;
    case 'INSURANCE':
      return Shield;
    case 'DRIVERS_LICENSE':
      return Car;
    case 'VACCINATION':
      return HeartPulse;
    default:
      return FileText;
  }
}

function getDocIconColor(type: DocumentType) {
  switch (type) {
    case 'PASSPORT':
      return 'bg-blue-50 text-blue-600';
    case 'VISA':
      return 'bg-violet-50 text-violet-600';
    case 'INSURANCE':
      return 'bg-emerald-50 text-emerald-600';
    case 'DRIVERS_LICENSE':
      return 'bg-amber-50 text-amber-600';
    case 'VACCINATION':
      return 'bg-rose-50 text-rose-600';
    default:
      return 'bg-slate-50 text-slate-600';
  }
}

function maskNumber(num: string) {
  if (num.length <= 4) return num;
  return '\u2022'.repeat(num.length - 4) + ' ' + num.slice(-4);
}

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(expiryDate: string | null) {
  if (!expiryDate) {
    return {
      label: 'No expiry',
      dotColor: 'bg-slate-300',
      textColor: 'text-slate-500',
      bgColor: 'bg-slate-50',
      pulse: false,
    };
  }
  const days = getDaysUntilExpiry(expiryDate)!;
  if (days <= 0) {
    return {
      label: 'Expired',
      dotColor: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      pulse: false,
    };
  }
  if (days < 30) {
    return {
      label: `${days}d left`,
      dotColor: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      pulse: true,
    };
  }
  if (days <= 90) {
    return {
      label: `${days}d left`,
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      pulse: false,
    };
  }
  return {
    label: `${days}d left`,
    dotColor: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    pulse: false,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const emptyForm = {
  type: 'PASSPORT' as DocumentType,
  label: '',
  number: '',
  issueDate: '',
  expiryDate: '',
  country: '',
  notes: '',
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const formVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<TravelDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    let expiringSoon = 0;
    let expired = 0;
    for (const doc of documents) {
      const days = getDaysUntilExpiry(doc.expiryDate as unknown as string | null);
      if (days !== null) {
        if (days <= 0) expired++;
        else if (days <= 30) expiringSoon++;
      }
    }
    return { total: documents.length, expiringSoon, expired };
  }, [documents]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(doc: TravelDocument) {
    setEditingId(doc.id);
    setForm({
      type: doc.type,
      label: doc.label,
      number: doc.number || '',
      issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString().split('T')[0] : '',
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
      country: doc.country || '',
      notes: doc.notes || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setSaving(true);

    try {
      const payload = {
        type: form.type,
        label: form.label.trim(),
        number: form.number.trim() || undefined,
        issueDate: form.issueDate || undefined,
        expiryDate: form.expiryDate || undefined,
        country: form.country.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingId) {
        const res = await fetch(`/api/documents/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setDocuments((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        }
      } else {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setDocuments((prev) => [...prev, created]);
        }
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Travel Documents</h1>
        </div>
        {/* Summary bar skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white border border-slate-100 p-4">
              <div className="h-3 w-16 rounded bg-slate-200 mb-2" />
              <div className="h-6 w-10 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        {/* Card skeletons */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-slate-100" />
                  <div>
                    <div className="h-4 w-28 rounded bg-slate-200 mb-1.5" />
                    <div className="h-3 w-16 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-3 w-32 rounded bg-slate-100 mb-2" />
              <div className="h-3 w-24 rounded bg-slate-100 mb-3" />
              <div className="flex gap-4 mb-3">
                <div className="h-3 w-20 rounded bg-slate-50" />
                <div className="h-3 w-20 rounded bg-slate-50" />
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <div className="h-7 w-14 rounded bg-slate-50" />
                <div className="h-7 w-16 rounded bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Travel Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Keep your travel documents organized and track expiration dates.
          </p>
        </div>
        <Button onClick={openAddForm} className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
          <Plus className="mr-2 size-4" />
          Add Document
        </Button>
      </div>

      {/* Summary Bar */}
      {documents.length > 0 && (
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="rounded-xl bg-white border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
              <FileText className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="size-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expiring Soon</p>
              <p className={`text-xl font-bold ${summary.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {summary.expiringSoon}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="size-4 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expired</p>
              <p className={`text-xl font-bold ${summary.expired > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {summary.expired}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Add / Edit Form */}
      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key="document-form"
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingId ? 'Edit Document' : 'New Document'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingId ? 'Update the details below.' : 'Fill in the details to add a new document.'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Section: Document Info */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Document Info</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as DocumentType }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Label</Label>
                    <Input
                      placeholder="e.g., US Passport"
                      value={form.label}
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Document Number</Label>
                    <Input
                      placeholder="e.g., 123456789"
                      value={form.number}
                      onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Issuing Country</Label>
                    <Input
                      placeholder="e.g., United States"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Dates */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Validity</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Issue Date</Label>
                    <Input
                      type="date"
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Expiry Date</Label>
                    <Input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Additional */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional</p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Notes</Label>
                  <Textarea
                    placeholder="Optional notes about this document..."
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white min-w-[120px]">
                  {saving ? (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      Saving...
                    </motion.span>
                  ) : editingId ? 'Update Document' : 'Add Document'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Cards */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className="relative mx-auto size-20 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center border border-amber-100/50">
              <BookOpen className="size-9 text-amber-400" />
              <div className="absolute -top-1 -right-1 size-5 rounded-full bg-amber-100 flex items-center justify-center">
                <Plus className="size-3 text-amber-500" />
              </div>
            </div>
          </motion.div>
          <h3 className="text-lg font-semibold text-slate-800">No travel documents yet</h3>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
            Add your passports, visas, insurance policies, and other important travel documents to keep them organized in one place.
          </p>
          <Button onClick={openAddForm} className="mt-5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
            <Plus className="mr-2 size-4" />
            Add Your First Document
          </Button>
        </div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {documents.map((doc) => {
            const Icon = getDocIcon(doc.type);
            const iconColor = getDocIconColor(doc.type);
            const badge = getExpiryBadge(doc.expiryDate as unknown as string | null);
            const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.type)?.label || doc.type;

            return (
              <motion.div
                key={doc.id}
                variants={cardVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="group rounded-xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-default"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-lg ${iconColor}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
                      <p className="text-xs text-slate-500">{typeLabel}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                    <span className={`size-1.5 rounded-full ${badge.dotColor} ${badge.pulse ? 'animate-pulse' : ''}`} />
                    {badge.label}
                  </span>
                </div>

                {doc.number && (
                  <p className="text-sm text-slate-600 mb-1.5 font-mono tracking-wide">
                    {maskNumber(doc.number)}
                  </p>
                )}

                {doc.country && (
                  <p className="text-xs text-slate-500 mb-1.5">{doc.country}</p>
                )}

                <div className="flex gap-4 text-xs text-slate-400 mb-3">
                  {doc.issueDate && <span>Issued: {formatDate(doc.issueDate as unknown as string)}</span>}
                  {doc.expiryDate && <span>Expires: {formatDate(doc.expiryDate as unknown as string)}</span>}
                </div>

                {doc.notes && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{doc.notes}</p>
                )}

                <div className="flex gap-1 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditForm(doc)}
                    className="text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
