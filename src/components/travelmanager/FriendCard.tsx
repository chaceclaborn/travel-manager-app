'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Phone, Pencil, X, Trash2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
}

export function FriendCard({ friend, onSaved, onDeleted }: FriendCardProps) {
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
  const reducedMotion = useReducedMotion();

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
      <Card className="p-5 bg-white border border-amber-300 ring-1 ring-amber-200 rounded-xl">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Edit Friend</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-7 text-xs bg-amber-500 hover:bg-amber-600">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={{ duration: 0.2 }}>
        <Card className="bg-white p-5 border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all rounded-xl group">
          <div className="flex items-start justify-between">
            <h3 className="min-w-0 flex-1 font-semibold text-lg text-slate-800" title={friend.name}>{friend.name}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startEdit} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Edit" aria-label="Edit friend"><Pencil className="size-4" /></button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Delete" aria-label="Delete friend"><Trash2 className="size-4" /></button>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {friend.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="size-3.5 text-slate-400" />
                <span className="truncate">{friend.email}</span>
              </div>
            )}
            {friend.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="size-3.5 text-slate-400" />
                <span>{friend.phone}</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">{friend.trips.length} {friend.trips.length === 1 ? 'trip' : 'trips'}</p>
        </Card>
      </motion.div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Friend" description="Are you sure? This will also remove them from all trips." isDeleting={deleting} />
    </>
  );
}
