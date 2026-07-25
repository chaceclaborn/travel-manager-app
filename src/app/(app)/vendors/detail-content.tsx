'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Mail, MapPin, Building2 } from 'lucide-react';
import { VendorForm } from '@/components/travelmanager/VendorForm';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMEmptyState, TMErrorState, TMSkeleton } from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMBackRow, TMActionFooter } from '@/components/travelmanager/TMPageShell';
import { TMLetterTile, TMCard, TMCardHeader, TMCodeTile, TMFact } from '@/components/travelmanager/TMPrimitives';
import { tripCode, vendorCategoryPalette } from '@/lib/travelmanager/design';
import { formatDate } from '@/lib/date-utils';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';

interface VendorTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

interface VendorData {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  notes: string | null;
  trips?: { trip: VendorTrip }[];
}

export default function VendorDetailContent({ id }: { id: string }) {
  const { showToast } = useTMToast();
  const { deleteOpen: showDelete, setDeleteOpen: setShowDelete, deleting: isDeleting, handleDelete } = useDeleteEntity(`/api/vendors/${id}`, '/vendors', 'Vendor');

  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchVendor = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const res = await fetch(`/api/vendors/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setVendor(await res.json());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVendor();
  }, [fetchVendor]);

  const handleUpdate = async (data: Partial<VendorData>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to update');

      const updated = await res.json();
      setVendor(updated);
      setIsEditing(false);
      showToast('Vendor updated successfully');
    } catch {
      showToast('Failed to update vendor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/vendors" section="Vendors" />
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
        <TMBackRow href="/vendors" section="Vendors" />
        <div className="tm-card mt-6">
          <TMEmptyState
            title="Vendor not found"
            description="This vendor may have been deleted. Head back to the list to pick another."
            actionLabel="Back to Vendors"
            actionHref="/vendors"
            icon={Building2}
          />
        </div>
      </TMPageShell>
    );
  }

  if (loadError || !vendor) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/vendors" section="Vendors" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load this vendor"
            description="Something went wrong on our end. Your data is safe \u2014 nothing was lost."
            onRetry={fetchVendor}
          />
        </div>
      </TMPageShell>
    );
  }

  const location = [vendor.address, vendor.city, vendor.state].filter(Boolean).join(', ');
  const palette = vendorCategoryPalette(vendor.category);
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();
  const associatedTrips = vendor.trips?.map((tv) => tv.trip) || [];

  if (isEditing) {
    return (
      <TMPageShell width={860}>
        <TMBackRow href="/vendors" section="Vendors" />
        <div className="flex items-center justify-between pt-5 md:pt-8">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-tm-ink">Edit vendor</h1>
          <button type="button" className="tm-btn tm-btn-secondary" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
        <div className="tm-card mt-5 p-6">
          <VendorForm initialData={vendor} onSubmit={handleUpdate} isLoading={isSaving} />
        </div>
      </TMPageShell>
    );
  }

  return (
    <TMPageShell width={1120}>
      <TMBackRow
        href="/vendors"
        section="Vendors"
        action={
          <button type="button" onClick={() => setIsEditing(true)} className="tm-btn-icon size-8" aria-label="Edit vendor">
            <Pencil className="size-4" />
          </button>
        }
      />

      {/* Header card */}
      <div className="tm-card mt-4 px-5 py-5 md:mt-6 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <TMLetterTile label={vendor.name} size={52} bg={palette.bg} fg={palette.fg} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-tm-ink md:text-[24px]">
                  {vendor.name}
                </h1>
                <span
                  className="shrink-0 rounded-full px-[9px] py-[3px] text-[11px] font-medium"
                  style={{ background: palette.bg, color: palette.fg }}
                >
                  {categoryLabel}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-tm-muted">
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-tm-faint" aria-hidden="true" />
                    {location}
                  </span>
                )}
                {vendor.contactName && <span>{vendor.contactName}</span>}
                <span>
                  {associatedTrips.length} {associatedTrips.length === 1 ? 'trip' : 'trips'} together
                </span>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button type="button" className="tm-btn tm-btn-secondary" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="tm-btn tm-btn-primary">
                <Mail className="size-3.5" aria-hidden="true" />
                Contact
              </a>
            )}
            <button type="button" className="tm-btn-icon" onClick={() => setShowDelete(true)} aria-label="Delete vendor">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.55fr]">
        <div className="flex flex-col gap-5">
          <TMCard>
            <TMCardHeader title="Contact" />
            <div className="mt-3.5 space-y-2.5">
              {vendor.contactName && <TMFact label="Contact">{vendor.contactName}</TMFact>}
              {vendor.email && (
                <TMFact label="Email">
                  <a href={`mailto:${vendor.email}`} className="break-all text-tm-accent-text hover:text-tm-accent-text-hover">
                    {vendor.email}
                  </a>
                </TMFact>
              )}
              {vendor.phone && (
                <TMFact label="Phone">
                  <a href={`tel:${vendor.phone}`} className="font-mono text-[12px] text-tm-body hover:text-tm-ink">
                    {vendor.phone}
                  </a>
                </TMFact>
              )}
              {location && <TMFact label="City">{location}</TMFact>}
              {vendor.website && (
                <TMFact label="Website">
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-tm-accent-text hover:text-tm-accent-text-hover"
                  >
                    {vendor.website}
                  </a>
                </TMFact>
              )}
              <TMFact label="Category">{categoryLabel}</TMFact>
            </div>
          </TMCard>

          {vendor.notes && (
            <TMCard>
              <TMCardHeader title="Notes" />
              <p className="tm-prose mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-tm-muted">
                {vendor.notes}
              </p>
            </TMCard>
          )}
        </div>

        <TMCard>
          <TMCardHeader title={`Linked trips (${associatedTrips.length})`} />
          {associatedTrips.length === 0 ? (
            <p className="mt-3 text-[13px] text-tm-faint">No trips linked to this vendor yet.</p>
          ) : (
            <div className="mt-3">
              {associatedTrips.map((trip, i) => (
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
                          ? `${formatDate(trip.startDate)} \u2013 ${formatDate(trip.endDate)}`
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

      <TMActionFooter>
        <button type="button" className="tm-btn tm-btn-secondary h-11 flex-1" onClick={() => setShowDelete(true)}>
          Delete
        </button>
        {vendor.email ? (
          <a href={`mailto:${vendor.email}`} className="tm-btn tm-btn-primary h-11 flex-[2]">
            <Mail className="size-4" aria-hidden="true" />
            Contact
          </a>
        ) : (
          <button type="button" className="tm-btn tm-btn-primary h-11 flex-[2]" onClick={() => setIsEditing(true)}>
            Edit vendor
          </button>
        )}
      </TMActionFooter>

      <TMDeleteDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </TMPageShell>
  );
}
