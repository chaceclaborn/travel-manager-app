'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Phone, Pencil, X, Trash2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    trips: unknown[];
  };
  onSaved?: () => void;
  onDeleted?: () => void;
}

// Six-gradient palette (amber/blue/green/violet/pink/sky) cycled deterministically
// by client id so each client keeps a stable avatar color across sorts/re-fetches.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#059669,#34d399)',
  'linear-gradient(135deg,#8b5cf6,#c084fc)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#0ea5e9,#38bdf8)',
];

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function gradientIndex(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return sum;
}

export function ClientCard({ client, onSaved, onDeleted }: ClientCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    company: client.company || '',
    email: client.email || '',
    phone: client.phone || '',
    notes: '',
  });
  const { showToast } = useTMToast();
  const reducedMotion = useReducedMotion();

  const initials = clientInitials(client.name);
  const avatarBg = AVATAR_GRADIENTS[gradientIndex(client.id)];

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ name: client.name, company: client.company || '', email: client.email || '', phone: client.phone || '', notes: '' });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), company: form.company.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      showToast('Client updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Client deleted');
      onDeleted?.();
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <Card className="p-5 bg-white border border-amber-300 ring-1 ring-amber-200 rounded-xl">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Edit Client</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-10 text-sm sm:h-7 sm:text-xs bg-amber-500 hover:bg-amber-600">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-10 text-sm sm:h-7 sm:text-xs">Cancel</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      <motion.div whileHover={reducedMotion ? undefined : { y: -3 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={{ duration: 0.2 }}>
        <Card className="bg-white p-[18px] border border-[#eef2f6] shadow-card hover:shadow-card-hover transition-all rounded-[15px] group">
          <div className="flex items-center justify-between gap-3">
            <Link href={detailHref('clients', client.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <div aria-hidden="true" className="flex size-[46px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: avatarBg }}>{initials}</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-[15px] text-slate-800 truncate hover:text-amber-600 transition-colors" title={client.name}>{client.name}</h3>
                {client.company && <p className="text-[13px] text-slate-400 mt-0.5 truncate">{client.company}</p>}
              </div>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startEdit} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Edit" aria-label="Edit client"><Pencil className="size-4" /></button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Delete" aria-label="Delete client"><Trash2 className="size-4" /></button>
            </div>
          </div>

          <Link href={detailHref('clients', client.id)}>
            <div className="mt-3.5 space-y-1.5">
              {client.email && (
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <Mail className="size-3.5 text-slate-400" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <Phone className="size-3.5 text-slate-400" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
            <p className="mt-3.5 text-xs text-slate-400">{client.trips.length} {client.trips.length === 1 ? 'trip' : 'trips'}</p>
          </Link>
        </Card>
      </motion.div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Client" description="Are you sure? This will also unlink the client from all trips." isDeleting={deleting} />
    </>
  );
}
