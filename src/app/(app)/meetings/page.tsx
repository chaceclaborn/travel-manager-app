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
  Trash2,
  Loader2,
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
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMListSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TMIconTile, TMDateTile, TMChip } from '@/components/travelmanager/TMPrimitives';
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
  const start = new Date(meeting.startDateTime);
  const isPast = start.getTime() < Date.now();
  // "Imminent" is within the next seven days — the window in which a meeting
  // stops being a plan and starts being a commitment.
  const isImminent = !isPast && start.getTime() - Date.now() < 7 * 86_400_000;
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
      className={`group relative px-4 py-3.5 md:px-5 ${
        editing
          ? 'bg-tm-accent-bg/40'
          : selected
            ? 'bg-tm-wash ring-2 ring-inset ring-tm-accent'
            : `hover:bg-tm-wash ${isPast ? 'opacity-75 hover:opacity-100' : ''}`
      }`}
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
      <div className={`flex items-start justify-between gap-3 ${editing ? 'mb-3' : ''}`}>
        {editing ? (
          <div className="flex items-center gap-2.5">
            <TMIconTile icon={Users} size={38} bg="#EFF4FB" fg="#2563EB" />
            <p className="text-[13px] font-medium text-tm-body">Edit meeting</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {/* Meetings this week invert to dark — that's the difference
                between "look at this" and "it's on the books". */}
            <TMDateTile date={start} size={44} imminent={isImminent} />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[14px] font-semibold tracking-[-0.01em] ${isPast ? 'text-tm-body' : 'text-tm-ink'}`}>
                {meeting.title}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-tm-subtle tm-nums">
                {formatDateTime(meeting.startDateTime)}
                {meeting.endDateTime ? ` \u2013 ${formatDateTime(meeting.endDateTime)}` : ''}
                {meeting.timezone ? ` (${getTzAbbreviation(meeting.timezone)})` : ''}
                {meeting.location ? ` \u00B7 ${meeting.location}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {meeting.trip && (
                  <Link href={detailHref('trips', meeting.trip.id)}>
                    <TMChip tone={isPast ? 'neutral' : 'accent'} icon={MapPin}>
                      {meeting.trip.title}
                    </TMChip>
                  </Link>
                )}
                {meeting.client && (
                  <Link href={detailHref('clients', meeting.client.id)}>
                    <TMChip tone={isPast ? 'neutral' : 'info'} icon={Building2}>
                      {meeting.client.name}
                    </TMChip>
                  </Link>
                )}
              </div>
              {meeting.notes && (
                <p className="tm-prose mt-2 text-[12px] leading-[1.5] text-tm-subtle">{meeting.notes}</p>
              )}
            </div>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {!editing && (
            <>
              <button
                onClick={startEdit}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
                title="Edit meeting"
                aria-label="Edit meeting"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => onDelete(meeting.id)}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
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
                className="h-11 text-base sm:h-8 sm:text-xs"
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
                  className="w-24 shrink-0 h-11 text-base sm:h-8 sm:text-xs"
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
                  className="w-24 shrink-0 h-11 text-base sm:h-8 sm:text-xs"
                  aria-label="End time"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => updateForm('timezone', v)}>
                <SelectTrigger className="h-11 text-base sm:h-8 sm:text-xs"><SelectValue /></SelectTrigger>
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
                className="h-11 text-base sm:h-8 sm:text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Link to Trip</Label>
              <Select value={form.tripId || 'none'} onValueChange={(v) => updateForm('tripId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-11 text-base sm:h-8 sm:text-xs"><SelectValue placeholder="None" /></SelectTrigger>
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
                <SelectTrigger className="h-11 text-base sm:h-8 sm:text-xs"><SelectValue placeholder="None" /></SelectTrigger>
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
                className="h-11 text-base sm:h-8 sm:text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-11 sm:h-7 text-xs bg-amber-500 hover:bg-amber-600">
              {saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-11 sm:h-7 text-xs">
              Cancel
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.div key="view" className="hidden" aria-hidden="true" />
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
      <TMPageShell width={860}>
        <TMScreenHeader title="Meetings" />
        <div className="pt-5 md:pt-7" role="status" aria-label="Loading meetings">
          <TMListSkeleton rows={5} />
        </div>
      </TMPageShell>
    );
  }

  if (error) {
    return (
      <TMPageShell width={860}>
        <TMScreenHeader title="Meetings" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load your meetings"
            description="Something went wrong on our end. Your data is safe \u2014 nothing was lost."
            onRetry={fetchMeetings}
          />
        </div>
      </TMPageShell>
    );
  }

  // Split by time: what's coming is the working list; what's past is a record.
  const now = Date.now();
  const upcoming = filtered.filter((m) => new Date(m.startDateTime).getTime() >= now);
  const past = filtered
    .filter((m) => new Date(m.startDateTime).getTime() < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  return (
    <TMPageShell width={860}>
      <TMScreenHeader
        title="Meetings"
        subtitle={
          meetings.length > 0
            ? `${upcoming.length} upcoming \u00B7 ${past.length} past`
            : undefined
        }
        actions={
          <>
            {meetings.length > 0 && (
              <button
                type="button"
                className="tm-btn tm-btn-secondary"
                onClick={toggleSelectMode}
                aria-pressed={selectMode}
              >
                {selectMode ? 'Done' : 'Select'}
              </button>
            )}
            <button type="button" className="tm-btn tm-btn-primary" onClick={() => setShowForm(true)}>
              New Meeting
            </button>
          </>
        }
        mobileAction={
          <button type="button" className="tm-btn tm-btn-primary h-[34px] px-[13px]" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </button>
        }
      />

      <div className="pt-5 md:pt-7" />

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

      <div className="relative w-full sm:max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
        <input
          placeholder="Search meetings"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search meetings"
          className="tm-input pl-[34px]"
        />
      </div>

      <div className="pt-5">
        {filtered.length === 0 ? (
          <div className="tm-card">
            {meetings.length === 0 ? (
              <TMEmptyState
                title="No meetings yet"
                description="Schedule a meeting and link it to the trip or client it belongs to."
                actionLabel="New Meeting"
                onAction={() => setShowForm(true)}
                icon={Users}
              />
            ) : (
              <TMFilteredEmpty noun="meetings" query={search} onClear={() => setSearch('')} />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {[
              { label: 'Upcoming', rows: upcoming },
              { label: 'Past', rows: past },
            ]
              .filter((section) => section.rows.length > 0)
              .map((section) => (
                <section key={section.label}>
                  <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-tm-subtle">
                    {section.label}
                  </h2>
                  <div className="tm-card divide-y divide-tm-divider overflow-hidden">
                    {section.rows.map((meeting) => (
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
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>

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
                className="tm-btn tm-btn-danger"
                aria-label="Delete selected meetings"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TMPageShell>
  );
}
