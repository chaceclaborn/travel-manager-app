'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Building2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ClientForm } from '@/components/travelmanager/ClientForm';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ClientData {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  trips: { trip: Trip }[];
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useTMToast();

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => setClient(data))
      .catch(() => showToast('Failed to load client', 'error'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  async function handleUpdate(data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    notes: string;
  }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setClient(updated);
      setEditing(false);
      showToast('Client updated successfully');
    } catch {
      showToast('Failed to update client', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Client deleted');
      router.push('/clients');
    } catch {
      showToast('Failed to delete client', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Clients
        </Link>
        <p className="text-slate-500">Client not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Clients', href: '/clients' }, { label: client.name }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
          {client.company && (
            <p className="mt-0.5 text-slate-500">{client.company}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? <X className="mr-1.5 size-4" /> : <Pencil className="mr-1.5 size-4" />}
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Edit form or info display */}
      {editing ? (
        <Card className="bg-white p-6">
          <ClientForm
            initialData={{
              name: client.name,
              company: client.company ?? '',
              email: client.email ?? '',
              phone: client.phone ?? '',
              notes: client.notes ?? '',
            }}
            onSubmit={handleUpdate}
            isLoading={saving}
          />
        </Card>
      ) : (
        <Card className="bg-white p-6">
          <div className="space-y-3">
            {client.company && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="size-4 text-slate-400" />
                <span>{client.company}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="size-4 text-slate-400" />
                <a href={`mailto:${client.email}`} className="text-amber-600 hover:text-amber-700 transition-colors">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="size-4 text-slate-400" />
                <a href={`tel:${client.phone}`} className="text-amber-600 hover:text-amber-700 transition-colors">
                  {client.phone}
                </a>
              </div>
            )}
            {client.notes && (
              <>
                <Separator className="my-3" />
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.notes}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Associated Trips */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Associated Trips</h2>
        {client.trips.length === 0 ? (
          <p className="text-sm text-slate-400">No trips linked to this client yet.</p>
        ) : (
          <div className="space-y-2">
            {client.trips.map(({ trip }) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="bg-white p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{trip.title}</p>
                      <p className="text-sm text-slate-500">
                        {trip.destination} &middot;{' '}
                        {new Date(trip.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} &ndash;{' '}
                        {new Date(trip.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                      </p>
                    </div>
                    <TMStatusBadge status={trip.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <TMDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        description={`Are you sure you want to delete "${client.name}"? This action cannot be undone.`}
        isDeleting={deleting}
      />
    </div>
  );
}
