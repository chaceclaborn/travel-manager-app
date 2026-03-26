'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Mail, Phone, Pencil, X, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';

const categoryColors: Record<string, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-700',
  HOTEL: 'bg-purple-100 text-purple-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  RESTAURANT: 'bg-green-100 text-green-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

interface VendorCardProps {
  vendor: {
    id: string;
    name: string;
    category: string;
    city?: string | null;
    state?: string | null;
    email?: string | null;
    phone?: string | null;
    trips?: any[];
  };
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function VendorCard({ vendor, onSaved, onDeleted }: VendorCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: vendor.name,
    contactName: (vendor as any).contactName || '',
    category: vendor.category,
    email: vendor.email || '',
    phone: vendor.phone || '',
    city: vendor.city || '',
    state: vendor.state || '',
  });
  const { showToast } = useTMToast();

  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const tripCount = vendor.trips?.length || 0;
  const colorClass = categoryColors[vendor.category] || categoryColors.OTHER;
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ name: vendor.name, contactName: (vendor as any).contactName || '', category: vendor.category, email: vendor.email || '', phone: vendor.phone || '', city: vendor.city || '', state: vendor.state || '' });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), contactName: form.contactName.trim() || undefined, category: form.category, email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, city: form.city.trim() || undefined, state: form.state.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      showToast('Vendor updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Vendor deleted');
      onDeleted?.();
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <Card className="p-5 bg-white border border-amber-300 ring-1 ring-amber-200 rounded-xl">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Edit Vendor</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} className="h-8 text-xs" placeholder="Contact person" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="HOTEL">Hotel</SelectItem>
                  <SelectItem value="TRANSPORT">Transport</SelectItem>
                  <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">State</Label><Input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} className="h-8 text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-7 text-xs bg-amber-500 hover:bg-amber-600">{saving ? 'Saving...' : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <Card className="p-5 bg-white border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all rounded-xl group">
          <div className="flex items-start justify-between mb-3">
            <Link href={`/vendors/${vendor.id}`} className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg text-slate-800 line-clamp-1 hover:text-amber-600 transition-colors" title={vendor.name}>{vendor.name}</h3>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startEdit} className="rounded-md p-2 text-slate-400 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500" title="Edit" aria-label="Edit vendor"><Pencil className="size-4" /></button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }} className="rounded-md p-2 text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500" title="Delete" aria-label="Delete vendor"><Trash2 className="size-4" /></button>
              <Badge className={`${colorClass} border-0 ml-1`}>{categoryLabel}</Badge>
            </div>
          </div>

          <Link href={`/vendors/${vendor.id}`}>
            {location && <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2"><MapPin className="size-3.5" /><span>{location}</span></div>}
            {vendor.email && <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1"><Mail className="size-3.5" /><span className="truncate">{vendor.email}</span></div>}
            {vendor.phone && <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1"><Phone className="size-3.5" /><span>{vendor.phone}</span></div>}
            <p className="text-xs text-slate-400 mt-3">{tripCount} {tripCount === 1 ? 'trip' : 'trips'}</p>
          </Link>
        </Card>
      </motion.div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Vendor" description="Are you sure? This will also unlink the vendor from all trips." isDeleting={deleting} />
    </>
  );
}
