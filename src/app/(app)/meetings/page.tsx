'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  X,
  MapPin,
  Clock,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  Pencil,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDateTime } from '@/lib/date-utils';

interface MeetingTrip {
  id: string;
  title: string;
  destination: string | null;
}

interface MeetingClient {
  id: string;
  name: string;
  company: string | null;
}

interface Meeting {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  timezone: string | null;
  location: string | null;
  notes: string | null;
  tripId: string | null;
  clientId: string | null;
  trip: MeetingTrip | null;
  client: MeetingClient | null;
  createdAt: string;
}

interface TripOption {
  id: string;
  title: string;
  destination: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  company: string | null;
}

const defaultTimezone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

const emptyForm = {
  title: '',
  date: '',
  startTime: '',
  endDate: '',
  endTime: '',
  timezone: defaultTimezone,
  location: '',
  notes: '',
  tripId: '',
  clientId: '',
};

function combineDateTime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}:00`;
}

function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const [date, timeWithSeconds] = value.split('T');
  const time = timeWithSeconds ? timeWithSeconds.slice(0, 5) : '';
  return { date: date || '', time };
}

function getTzAbbreviation(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}

function csvEscape(value: string | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function MeetingCard({
  meeting,
  trips,
  clients,
  timezones,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  onSaved,
}: {
  meeting: Meeting;
  trips: TripOption[];
  clients: ClientOption[];
  timezones: string[];
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onSaved: () => void;
}) {
  const { showToast } = useTMToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildEditForm = useCallback(() => {
    const start = splitDateTime(meeting.startDateTime);
    const end = splitDateTime(meeting.endDateTime);
    return {
      title: meeting.title,
      date: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      timezone: meeting.timezone || defaultTimezone,
      location: meeting.location || '',
      notes: meeting.notes || '',
      tripId: meeting.tripId || '',
      clientId: meeting.clientId || '',
    };
  }, [meeting]);

  const [form, setForm] = useState(buildEditForm);

  const startEdit = () => {
    setForm(buildEditForm());
    setEditing(true);
  };

  const updateForm = (field: keyof ReturnType<typeof buildEditForm>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    if (!form.date) { showToast('Start date is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          startDateTime: combineDateTime(form.date, form.startTime),
          endDateTime: form.endDate ? combineDateTime(form.endDate, form.endTime) : null,
          timezone: form.timezone || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
          tripId: form.tripId || null,
          clientId: form.clientId || null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Meeting updated');
      setEditing(false);
      onSaved();
    } catch {
      showToast('Failed to update meeting', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      layout
      exit={{ opacity: 0, scale: 0.95 }}
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-[15px] border bg-white p-4 shadow-card transition-all duration-200 ${editing ? 'border-amber-300 ring-1 ring-amber-200' : selected ? 'border-amber-400 ring-2 ring-amber-300' : 'border-[#eef2f6] hover:-translate-y-[3px] motion-reduce:hover:translate-y-0 hover:shadow-card-hover'}`}
    >
      {selectMode && !editing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(meeting.id); }}
          className="absolute left-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-white/90 p-1.5 text-slate-500 ring-1 ring-slate-200 backdrop-blur transition-colors hover:bg-amber-50 hover:text-amber-600"
          aria-label={selected ? 'Deselect meeting' : 'Select meeting'}
          aria-pressed={selected}
        >
          {selected ? <CheckSquare className="size-4 text-amber-500" /> : <Square className="size-4" />}
        </button>
      )}
      <div className="mb-3 flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center rounded-lg bg-indigo-50 p-1.5 ring-1 ring-indigo-200">
              <Users className="size-4 text-indigo-500" />
            </span>
            <p className="text-sm font-medium text-slate-700">Edit Meeting</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="flex items-center justify-center shrink-0 size-[38px] rounded-[11px] bg-indigo-50">
              <Users className="size-[18px] text-indigo-600" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-[1.3] text-slate-800 truncate">{meeting.title}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          {!editing && (
            <>
              <button
                onClick={startEdit}
                className="inline-flex items-center justify-center cursor-pointer rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                title="Edit meeting"
                aria-label="Edit meeting"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => onDelete(meeting.id)}
                className="inline-flex items-center justify-center cursor-pointer rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                title="Delete meeting"
                aria-label="Delete meeting"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center justify-center cursor-pointer rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
              title="Cancel editing"
              aria-label="Cancel editing"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
      {editing ? (
        <motion.form
          key="edit"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          onSubmit={handleSave}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Start date *</Label>
              <div className="flex gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker date={form.date} onDateChange={(d) => updateForm('date', d)} />
                </div>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateForm('startTime', e.target.value)}
                  className="w-20 shrink-0 h-8 text-xs"
                  aria-label="Start time"
                />
              </div>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">End date</Label>
              <div className="flex gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    date={form.endDate}
                    onDateChange={(d) => updateForm('endDate', d)}
                    minDate={form.date}
                    defaultMonth={form.date}
                  />
                </div>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateForm('endTime', e.target.value)}
                  className="w-20 shrink-0 h-8 text-xs"
                  aria-label="End time"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => updateForm('timezone', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input
                value={form.location}
                onChange={(e) => updateForm('location', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Link to Trip</Label>
              <Select value={form.tripId || 'none'} onValueChange={(v) => updateForm('tripId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">None</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.title}{trip.destination ? ` - ${trip.destination}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Link to Client</Label>
              <Select value={form.clientId || 'none'} onValueChange={(v) => updateForm('clientId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}{client.company ? ` - ${client.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-7 text-xs bg-amber-500 hover:bg-amber-600">
              {saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.div
          key="view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {meeting.trip && (
              <Link
                href={detailHref('trips', meeting.trip.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-[3px] text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <MapPin className="size-3" />
                {meeting.trip.title}
              </Link>
            )}
            {meeting.client && (
              <Link
                href={detailHref('clients', meeting.client.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-[3px] text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Building2 className="size-3" />
                {meeting.client.name}
              </Link>
            )}
            {!meeting.trip && !meeting.client && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-[3px] text-[11px] font-semibold text-slate-500">
                Standalone
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-[13px]">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="size-3.5 shrink-0 text-indigo-400" />
              <span>
                {formatDateTime(meeting.startDateTime)}
                {meeting.endDateTime ? ` - ${formatDateTime(meeting.endDateTime)}` : ''}
                {meeting.timezone && (
                  <span className="ml-1 text-xs text-slate-400">({getTzAbbreviation(meeting.timezone)})</span>
                )}
              </span>
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2 text-slate-500">
                <MapPin className="size-3.5 shrink-0 text-indigo-400" />
                <span className="truncate">{meeting.location}</span>
              </div>
            )}
            {meeting.notes && (
              <p className="mt-2 text-xs text-slate-400 italic">{meeting.notes}</p>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MeetingsPage() {
  const { showToast } = useTMToast();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const timezones = useMemo<string[]>(() => {
    try {
      type IntlWithTz = typeof Intl & { supportedValuesOf?: (key: string) => string[] };
      const I = Intl as IntlWithTz;
      if (typeof I.supportedValuesOf === 'function') {
        return I.supportedValuesOf('timeZone');
      }
    } catch {}
    return [defaultTimezone, 'UTC'];
  }, []);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/meetings');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    fetch('/api/trips?fields=minimal')
      .then((res) => res.json())
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchMeetings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter((m) => {
      return (
        m.title.toLowerCase().includes(q) ||
        (m.location && m.location.toLowerCase().includes(q)) ||
        (m.trip && m.trip.title.toLowerCase().includes(q)) ||
        (m.client && m.client.name.toLowerCase().includes(q))
      );
    });
  }, [meetings, search]);

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (!form.date) {
      showToast('Start date is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          startDateTime: combineDateTime(form.date, form.startTime),
          endDateTime: form.endDate ? combineDateTime(form.endDate, form.endTime) : undefined,
          timezone: form.timezone || undefined,
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tripId: form.tripId || undefined,
          clientId: form.clientId || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Meeting created');
      setForm(emptyForm);
      setShowForm(false);
      fetchMeetings();
    } catch {
      showToast('Failed to create meeting', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Meeting deleted');
      setDeleteTarget(null);
      fetchMeetings();
    } catch {
      showToast('Failed to delete meeting', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/meetings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast(`Deleted ${data.deleted ?? ids.length} meeting${(data.deleted ?? ids.length) === 1 ? '' : 's'}`);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      fetchMeetings();
    } catch {
      showToast('Failed to delete meetings', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCsv = () => {
    const selected = meetings.filter((m) => selectedIds.has(m.id));
    if (selected.length === 0) {
      showToast('No meetings selected', 'error');
      return;
    }
    const headers = ['Title', 'Start', 'End', 'Timezone', 'Location', 'Trip', 'Client', 'Notes'];
    const rows = selected.map((m) => [
      m.title,
      m.startDateTime,
      m.endDateTime || '',
      m.timezone || '',
      m.location || '',
      m.trip?.title || '',
      m.client?.name || '',
      m.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `meetings-${ts}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} meeting${selected.length === 1 ? '' : 's'}`);
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading meetings">
        {/* Title row: heading + action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">Meetings</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-24 rounded-md bg-slate-200/60 animate-pulse" />
            <div className="h-9 w-36 rounded-md bg-slate-200/70 animate-pulse" />
          </div>
        </div>

        {/* Search bar */}
        <div className="h-9 w-full rounded-md bg-slate-200/70 animate-pulse" />

        {/* Result count line */}
        <div className="h-4 w-44 rounded bg-slate-200/50 animate-pulse" />

        {/* Meeting cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-[15px] border border-[#eef2f6] bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 shrink-0 rounded-xl bg-slate-200/70 animate-pulse" />
                  <div className="h-4 w-28 rounded bg-slate-200/80 animate-pulse" />
                </div>
                <div className="h-4 w-12 rounded bg-slate-200/50 animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-1/2 rounded bg-slate-200/50 animate-pulse" />
                <div className="h-3.5 w-1/3 rounded bg-slate-200/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading meetings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-6">
          <div className="size-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="size-10 text-red-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-red-100 flex items-center justify-center">
            <RefreshCw className="size-3.5 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Unable to load meetings</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button
          onClick={fetchMeetings}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
        >
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Meetings</h1>
        <div className="flex flex-wrap items-center gap-2">
          {meetings.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectMode}
              aria-pressed={selectMode}
              aria-label={selectMode ? 'Exit select mode' : 'Enter select mode'}
              className={selectMode ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}
            >
              <CheckSquare className="mr-2 size-4" />
              {selectMode ? 'Done' : 'Select'}
            </Button>
          )}
          <Button
            onClick={() => setShowForm(true)}
            className="h-10 rounded-[11px] bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_4px_14px_-4px_rgba(245,158,11,0.55)] transition-transform hover:from-amber-600 hover:to-amber-700 motion-safe:hover:-translate-y-px"
          >
            <Plus className="mr-2 size-4" />
            New Meeting
          </Button>
        </div>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-lg bg-indigo-50 p-1.5 ring-1 ring-indigo-200">
                <Users className="size-4 text-indigo-500" />
              </span>
              <p className="text-sm font-medium text-slate-700">New Meeting</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="meeting-title">Title *</Label>
              <Input
                id="meeting-title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g. Kickoff with Acme Corp"
              />
            </div>

            <div className="min-w-0">
              <Label>Start date *</Label>
              <div className="flex gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    date={form.date}
                    onDateChange={(d) => updateForm('date', d)}
                  />
                </div>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateForm('startTime', e.target.value)}
                  className="w-24 shrink-0"
                  aria-label="Start time"
                />
              </div>
            </div>

            <div className="min-w-0">
              <Label>End date</Label>
              <div className="flex gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    date={form.endDate}
                    onDateChange={(d) => updateForm('endDate', d)}
                    minDate={form.date}
                    defaultMonth={form.date}
                  />
                </div>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateForm('endTime', e.target.value)}
                  className="w-24 shrink-0"
                  aria-label="End time"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="meeting-timezone">Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
              >
                <SelectTrigger id="meeting-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="meeting-location">Location</Label>
              <Input
                id="meeting-location"
                value={form.location}
                onChange={(e) => updateForm('location', e.target.value)}
                placeholder="e.g. Acme HQ, Zoom, etc."
              />
            </div>

            <div>
              <Label htmlFor="meeting-trip">Link to Trip</Label>
              <Select value={form.tripId || 'none'} onValueChange={(v) => updateForm('tripId', v === 'none' ? '' : v)}>
                <SelectTrigger id="meeting-trip" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">None</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.title}{trip.destination ? ` - ${trip.destination}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="meeting-client">Link to Client</Label>
              <Select value={form.clientId || 'none'} onValueChange={(v) => updateForm('clientId', v === 'none' ? '' : v)}>
                <SelectTrigger id="meeting-client" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}{client.company ? ` - ${client.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="meeting-notes">Notes</Label>
              <Input
                id="meeting-notes"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Agenda, attendees, etc."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-amber-500 hover:bg-amber-600">
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create meeting'
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
            >
              Cancel
            </Button>
          </div>
        </motion.form>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by title, location, trip, or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search meetings"
          className="pl-9"
        />
      </div>

      {meetings.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {meetings.length} meetings
        </p>
      )}

      {filtered.length === 0 ? (
        <TMEmptyState
          title={meetings.length === 0 ? 'No meetings yet' : 'No matching meetings'}
          description={
            meetings.length === 0
              ? 'Schedule your first meeting to get started'
              : 'Try adjusting your search terms.'
          }
          icon={Users}
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                trips={trips}
                clients={clients}
                timezones={timezones}
                selectMode={selectMode}
                selected={selectedIds.has(meeting.id)}
                onToggleSelect={toggleSelected}
                onDelete={setDeleteTarget}
                onSaved={fetchMeetings}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting? This action cannot be undone."
        isDeleting={isDeleting}
      />

      <TMDeleteDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} meeting${selectedIds.size === 1 ? '' : 's'}`}
        description="Are you sure you want to delete the selected meetings? This action cannot be undone."
        isDeleting={bulkDeleting}
      />

      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-6"
          >
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckSquare className="size-4 text-amber-500" />
              <span className="font-medium">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearSelection}
                aria-label="Clear selection"
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                aria-label="Export selected meetings to CSV"
              >
                <Download className="mr-1.5 size-3.5" />
                Export CSV
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="bg-red-500 text-white hover:bg-red-600"
                aria-label="Delete selected meetings"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
