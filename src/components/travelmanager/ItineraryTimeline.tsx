'use client';

import { useState } from 'react';
import { MapPin, X, Plus, Clock, Pencil, Users, Building2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

interface ItineraryVendor {
  id: string;
  name: string;
  category?: string;
}

interface ItineraryClient {
  id: string;
  name: string;
  company?: string | null;
}

interface ItineraryItem {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  vendorId?: string | null;
  clientId?: string | null;
  vendor?: ItineraryVendor | null;
  client?: ItineraryClient | null;
}

interface ItineraryTimelineProps {
  items: ItineraryItem[];
  tripId: string;
  onRefresh: () => void;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  vendors?: Array<{ id: string; name: string; category?: string }>;
  clients?: Array<{ id: string; name: string; company?: string | null }>;
}

function formatDateHeading(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByDate(items: ItineraryItem[]) {
  const groups: Record<string, ItineraryItem[]> = {};
  for (const item of items) {
    const key = new Date(item.date).toISOString().split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDefaultDate(tripStartDate?: string | null, tripEndDate?: string | null): string {
  const today = getTodayStr();
  if (!tripStartDate) return today;
  const start = new Date(tripStartDate).toISOString().split('T')[0];
  const end = tripEndDate ? new Date(tripEndDate).toISOString().split('T')[0] : start;
  // If today falls within trip range, use today; otherwise use trip start
  if (today >= start && today <= end) return today;
  return start;
}

const emptyForm = {
  title: '',
  date: '',
  endDate: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
  vendorId: '',
  clientId: '',
};

export function ItineraryTimeline({ items, tripId, onRefresh, tripStartDate, tripEndDate, vendors = [], clients = [] }: ItineraryTimelineProps) {
  const { showToast } = useTMToast();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editTimeError, setEditTimeError] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const grouped = groupByDate(items);

  // When opening the add form, default the date
  const handleOpenForm = () => {
    if (!showForm) {
      setForm({ ...emptyForm, date: getDefaultDate(tripStartDate, tripEndDate) });
    }
    setShowForm(!showForm);
  };

  // Validate times — for multi-day events, endTime < startTime is fine
  function validateTimes(startTime: string, endTime: string, date: string, endDate: string): string | null {
    if (!startTime || !endTime) return null;
    // Same-day event: endTime must be after startTime
    if ((!endDate || endDate === date) && endTime <= startTime) {
      return 'End time must be after start time (same day)';
    }
    return null;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/itinerary/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Itinerary item deleted');
      setDeleteTarget(null);
      onRefresh();
    } catch {
      showToast('Failed to delete item', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const startEdit = (item: ItineraryItem) => {
    setEditingId(item.id);
    setEditTimeError('');
    setEditForm({
      title: item.title,
      date: new Date(item.date).toISOString().split('T')[0],
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      location: item.location || '',
      notes: item.notes || '',
      vendorId: item.vendorId || '',
      clientId: item.clientId || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.date || !editingId) return;

    const err = validateTimes(editForm.startTime, editForm.endTime, editForm.date, editForm.endDate);
    if (err) { setEditTimeError(err); return; }

    setIsEditSubmitting(true);
    setEditTimeError('');
    try {
      const res = await fetch(`/api/itinerary/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          date: editForm.date,
          endDate: editForm.endDate || null,
          startTime: editForm.startTime || null,
          endTime: editForm.endTime || null,
          location: editForm.location.trim() || null,
          notes: editForm.notes.trim() || null,
          vendorId: editForm.vendorId || null,
          clientId: editForm.clientId || null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Itinerary item updated');
      setEditingId(null);
      onRefresh();
    } catch {
      showToast('Failed to update item', 'error');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;

    const err = validateTimes(form.startTime, form.endTime, form.date, form.endDate);
    if (err) { setTimeError(err); return; }

    setTimeError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          date: form.date,
          endDate: form.endDate || null,
          startTime: form.startTime || null,
          endTime: form.endTime || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
          vendorId: form.vendorId || null,
          clientId: form.clientId || null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Itinerary item added');
      setForm({ ...emptyForm });
      setShowForm(false);
      onRefresh();
    } catch {
      showToast('Failed to add item', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared form fields renderer
  function renderFormFields(
    formData: typeof emptyForm,
    setFormData: (data: typeof emptyForm) => void,
    error: string,
    prefix: string
  ) {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-title`}>Title *</Label>
            <Input
              id={`${prefix}-title`}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Visit Eiffel Tower"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-date`}>Start Date *</Label>
            <Input
              id={`${prefix}-date`}
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-enddate`}>End Date <span className="text-xs text-slate-400">(for overnight/multi-day)</span></Label>
            <Input
              id={`${prefix}-enddate`}
              type="date"
              value={formData.endDate}
              min={formData.date}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-location`}>Location</Label>
            <Input
              id={`${prefix}-location`}
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Champ de Mars"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-start`}>Start Time</Label>
            <Input
              id={`${prefix}-start`}
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-end`}>End Time</Label>
            <Input
              id={`${prefix}-end`}
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            />
          </div>
          {vendors.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-vendor`}>Vendor</Label>
              <select
                id={`${prefix}-vendor`}
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">None</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
          {clients.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-client`}>Client</Label>
              <select
                id={`${prefix}-client`}
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">None</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-notes`}>Notes</Label>
          <Textarea
            id={`${prefix}-notes`}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="Additional notes..."
          />
        </div>
      </>
    );
  }

  // Render time + date span for display
  function renderTimeDisplay(item: ItineraryItem) {
    const hasTime = item.startTime || item.endTime;
    const isMultiDay = item.endDate && new Date(item.endDate).toISOString().split('T')[0] !== new Date(item.date).toISOString().split('T')[0];

    if (!hasTime && !isMultiDay) return null;

    return (
      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Clock className="size-3" />
        {item.startTime && <span>{item.startTime}</span>}
        {isMultiDay && (
          <>
            <ArrowRight className="size-3" />
            <span className="font-medium text-amber-600">{formatShortDate(item.endDate!)}</span>
          </>
        )}
        {item.endTime && (
          <>
            {!isMultiDay && <span>-</span>}
            {isMultiDay && <span>at</span>}
            <span>{item.endTime}</span>
          </>
        )}
        {isMultiDay && !item.endTime && !item.startTime && (
          <span className="text-amber-600">ends {formatShortDate(item.endDate!)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Itinerary</h3>
        <Button
          size="sm"
          onClick={handleOpenForm}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="mr-1 size-4" />
          Add Item
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="space-y-3 overflow-hidden rounded-lg border bg-slate-50 p-4"
          >
            {renderFormFields(form, setForm, timeError, 'itin')}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600">
                {isSubmitting ? 'Adding...' : 'Add'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-sm text-slate-400">No itinerary items yet</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleOpenForm}
          >
            <Plus className="mr-1 size-4" />
            Add Your First Item
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dateItems]) => (
            <div key={date}>
              <h4 className="mb-3 text-sm font-semibold text-slate-600">
                {formatDateHeading(date)}
              </h4>
              <div className="relative ml-3 border-l-2 border-amber-200 pl-6 space-y-4">
                {dateItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative rounded-lg bg-white p-3 shadow-sm"
                  >
                    <div className="absolute -left-[31px] top-4 size-2.5 rounded-full bg-amber-400" />

                    {editingId === item.id ? (
                      <form onSubmit={handleUpdate} className="space-y-3">
                        {renderFormFields(editForm, setEditForm, editTimeError, 'edit')}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={isEditSubmitting} className="bg-amber-500 hover:bg-amber-600">
                            {isEditSubmitting ? 'Saving...' : 'Save'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800">{item.title}</p>
                          {renderTimeDisplay(item)}
                          {item.location && (
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="size-3" />
                              {item.location}
                            </p>
                          )}
                          {item.vendor && (
                            <p className="flex items-center gap-1 text-xs text-blue-600">
                              <Building2 className="size-3" />
                              {item.vendor.name}
                            </p>
                          )}
                          {item.client && (
                            <p className="flex items-center gap-1 text-xs text-emerald-600">
                              <Users className="size-3" />
                              {item.client.name}
                              {item.client.company && <span className="text-slate-400">({item.client.company})</span>}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-slate-400">{item.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(item)}
                            className="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-500"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item.id)}
                            className="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Itinerary Item"
        description="Are you sure you want to delete this itinerary item? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  );
}
