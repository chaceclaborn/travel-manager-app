'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Building2, Pencil, X, Trash2, Users } from 'lucide-react';
import { ClientForm } from '@/components/travelmanager/ClientForm';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMEmptyState, TMErrorState, TMSkeleton } from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMBackRow, TMActionFooter } from '@/components/travelmanager/TMPageShell';
import { TMAvatar, TMChip, TMCard, TMCardHeader, TMCodeTile, TMFact } from '@/components/travelmanager/TMPrimitives';
import { tripCode } from '@/lib/travelmanager/design';
import { formatDate } from '@/lib/date-utils';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';

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

export default function ClientDetailContent({ id }: { id: string }) {
  const { showToast } = useTMToast();
  const { deleteOpen, setDeleteOpen, deleting, handleDelete } = useDeleteEntity(`/api/clients/${id}`, '/clients', 'Client');

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError(true);
        return;
      }
      setClient(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

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

  if (loading) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/clients" section="Clients" />
        <div className="pt-5 md:pt-6">
          <TMSkeleton className="h-[132px] w-full" style={{ borderRadius: 16 }} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.55fr]">
            <TMSkeleton className="h-[220px] w-full" style={{ borderRadius: 14 }} />
            <TMSkeleton className="h-[280px] w-full" style={{ borderRadius: 14 }} />
          </div>
        </div>
      </TMPageShell>
    );
  }

  if (notFound) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/clients" section="Clients" />
        <div className="tm-card mt-6">
          <TMEmptyState
            title="Client not found"
            description="This client may have been deleted. Head back to the list to pick another."
            actionLabel="Back to Clients"
            actionHref="/clients"
            icon={Users}
          />
        </div>
      </TMPageShell>
    );
  }

  if (error || !client) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/clients" section="Clients" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load this client"
            description="Something went wrong on our end. Your data is safe — nothing was lost."
            onRetry={fetchClient}
          />
        </div>
      </TMPageShell>
    );
  }

  const trips = client.trips.map((t) => t.trip);
  // "Upcoming" is what makes this record urgent, so it earns the accent pill
  // in the header — nothing else on the page uses accent.
  const nextTrip = trips
    .filter((t) => t.startDate && new Date(t.startDate) >= new Date() && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

  return (
    <TMPageShell width={1120}>
      <TMBackRow
        href="/clients"
        section="Clients"
        action={
          <button type="button" onClick={() => setEditing(!editing)} className="tm-btn-icon size-8" aria-label={editing ? 'Cancel editing' : 'Edit client'}>
            {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
          </button>
        }
      />

      {/* Header card */}
      <div className="tm-card mt-4 px-5 py-5 md:mt-6 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <TMAvatar name={client.name} email={client.email} size={52} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-tm-ink md:text-[24px]">
                  {client.name}
                </h1>
                {nextTrip && <TMChip tone="accent">Traveling {formatDate(nextTrip.startDate)}</TMChip>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-tm-muted">
                {client.company && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-tm-faint" aria-hidden="true" />
                    {client.company}
                  </span>
                )}
                <span>
                  {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button type="button" className="tm-btn tm-btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <Link href="/trips/new" className="tm-btn tm-btn-primary">
              New Trip
            </Link>
            <button type="button" className="tm-btn-icon" onClick={() => setDeleteOpen(true)} aria-label="Delete client">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="tm-card mt-5 p-6">
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
        </div>
      ) : (
        /* The narrow column sits on the LEFT for entity pages: the record's
           own facts are short and fixed, while its relationships are long. */
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.55fr]">
          <div className="flex flex-col gap-5">
            <TMCard>
              <TMCardHeader title="Contact" />
              <div className="mt-3.5 space-y-2.5">
                {client.email && (
                  <TMFact label="Email">
                    <a href={`mailto:${client.email}`} className="break-all text-tm-accent-text hover:text-tm-accent-text-hover">
                      {client.email}
                    </a>
                  </TMFact>
                )}
                {client.phone && (
                  <TMFact label="Phone">
                    <a href={`tel:${client.phone}`} className="font-mono text-[12px] text-tm-body hover:text-tm-ink">
                      {client.phone}
                    </a>
                  </TMFact>
                )}
                {client.company && <TMFact label="Company">{client.company}</TMFact>}
                {!client.email && !client.phone && !client.company && (
                  <p className="text-[13px] text-tm-faint">No contact details saved yet.</p>
                )}
              </div>
            </TMCard>

            {client.notes && (
              <TMCard>
                <TMCardHeader title="Notes" />
                <p className="tm-prose mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-tm-muted">
                  {client.notes}
                </p>
              </TMCard>
            )}
          </div>

          <TMCard>
            <TMCardHeader title={`Trips (${trips.length})`} />
            {trips.length === 0 ? (
              <p className="mt-3 text-[13px] text-tm-faint">No trips linked to this client yet.</p>
            ) : (
              <div className="mt-3">
                {trips.map((trip, i) => (
                  <div key={trip.id}>
                    {i > 0 && <div className="h-px bg-tm-divider" />}
                    <Link
                      href={detailHref('trips', trip.id)}
                      className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-[11px] hover:bg-tm-wash"
                    >
                      <TMCodeTile code={tripCode(trip.destination, trip.title)} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-tm-ink">{trip.title}</p>
                        <p className="mt-0.5 truncate text-[12px] text-tm-subtle tm-nums">
                          {trip.startDate && trip.endDate
                            ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`
                            : 'Dates not set'}
                        </p>
                      </div>
                      <TMStatusBadge status={trip.status} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TMCard>
        </div>
      )}

      {/* Mobile action footer — the tab bar is replaced on detail screens. */}
      <TMActionFooter>
        <button type="button" className="tm-btn tm-btn-secondary h-11 flex-1" onClick={() => setDeleteOpen(true)}>
          Delete
        </button>
        <Link href="/trips/new" className="tm-btn tm-btn-primary h-11 flex-[2]">
          New Trip
        </Link>
      </TMActionFooter>

      {/* Delete confirmation */}
      <TMDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        description={`Are you sure you want to delete "${client.name}"? This action cannot be undone.`}
        isDeleting={deleting}
      />
    </TMPageShell>
  );
}
