'use client';

import { useState } from 'react';

import { Phone, Pencil, X, Trash2, Loader2 } from 'lucide-react';
import { TMAvatar } from '@/components/travelmanager/TMPrimitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

interface FriendCardProps {
  friend: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    trips: unknown[];
  };
  onSaved?: () => void;
  onDeleted?: () => void;
  /** Avatar gradients cycle by position so a row of cards never repeats a hue. */
  index?: number;
}

export function FriendCard({ friend, onSaved, onDeleted, index = 0 }: FriendCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: friend.name,
    email: friend.email || '',
    phone: friend.phone || '',
  });
  const { showToast } = useTMToast();

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ name: friend.name, email: friend.email || '', phone: friend.phone || '' });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/friends/${friend.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      showToast('Friend updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/friends/${friend.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Friend deleted');
      onDeleted?.();
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <div
        className="tm-card p-[18px]"
        style={{ borderColor: 'var(--color-tm-accent)', boxShadow: '0 0 0 3px rgba(245,158,11,0.12)' }}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-tm-body">Edit Friend</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="tm-btn tm-btn-primary h-9">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="tm-btn tm-btn-secondary h-9">Cancel</Button>
          </div>
        </form>
      </div>
    );
  }

  const tripCount = friend.trips.length;

  return (
    <>
      <div className="tm-card tm-card-interactive group p-[18px]">
        <div className="flex items-start gap-3">
          <TMAvatar name={friend.name} email={friend.email} index={index} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-tm-ink" title={friend.name}>
              {friend.name}
            </h3>
            {friend.email && <p className="mt-0.5 truncate text-[12px] text-tm-subtle">{friend.email}</p>}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              onClick={startEdit}
              className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
              title="Edit"
              aria-label="Edit friend"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
              className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
              title="Delete"
              aria-label="Delete friend"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        </div>

        {friend.phone && (
          <div className="mt-3.5 flex items-center gap-2 font-mono text-[11px] text-tm-muted">
            <Phone className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
            <span className="truncate">{friend.phone}</span>
          </div>
        )}

        <div className="mt-3.5 border-t border-tm-divider pt-3">
          <span className="text-[12px] text-tm-subtle">
            {tripCount} {tripCount === 1 ? 'trip' : 'trips'} together
          </span>
        </div>
      </div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Friend" description="Are you sure? This will also remove them from all trips." isDeleting={deleting} />
    </>
  );
}
