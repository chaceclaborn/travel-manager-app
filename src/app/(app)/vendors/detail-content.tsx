'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  User,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { VendorForm } from '@/components/travelmanager/VendorForm';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';

const categoryColors: Record<string, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-700',
  HOTEL: 'bg-purple-100 text-purple-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  RESTAURANT: 'bg-green-100 text-green-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

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
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (notFound) {
    return (
      <TMEmptyState
        title="Vendor not found"
        description="This vendor may have been deleted."
        actionLabel="Back to Vendors"
        actionHref="/vendors"
      />
    );
  }

  if (loadError || !vendor) {
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
        <h2 className="text-xl font-semibold text-slate-900">Couldn&apos;t load vendor</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button
          onClick={fetchVendor}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
        >
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  const location = [vendor.address, vendor.city, vendor.state].filter(Boolean).join(', ');
  const colorClass = categoryColors[vendor.category] || categoryColors.OTHER;
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();
  const associatedTrips = vendor.trips?.map((tv) => tv.trip) || [];

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Vendors', href: '/vendors' }, { label: vendor.name }]} />

      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">Edit Vendor</h1>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
          <div className="max-w-2xl rounded-lg bg-white p-6 shadow-sm">
            <VendorForm
              initialData={vendor}
              onSubmit={handleUpdate}
              isLoading={isSaving}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800">{vendor.name}</h1>
                <Badge className={`${colorClass} border-0`}>{categoryLabel}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1 size-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-700"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="mr-1 size-4" />
                Delete
              </Button>
            </div>
          </div>

          <Card className="bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Contact Details</h2>
            <div className="space-y-3">
              {vendor.contactName && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="size-4 text-slate-400" />
                  <span>{vendor.contactName}</span>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="size-4 text-slate-400" />
                  <a href={`mailto:${vendor.email}`} className="text-amber-600 hover:text-amber-700 transition-colors">
                    {vendor.email}
                  </a>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="size-4 text-slate-400" />
                  <a href={`tel:${vendor.phone}`} className="text-amber-600 hover:text-amber-700 transition-colors">
                    {vendor.phone}
                  </a>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="size-4 text-slate-400" />
                  <span>{location}</span>
                </div>
              )}
              {vendor.website && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Globe className="size-4 text-slate-400" />
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    {vendor.website}
                  </a>
                </div>
              )}
              {vendor.notes && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <FileText className="mt-0.5 size-4 text-slate-400" />
                  <span>{vendor.notes}</span>
                </div>
              )}
              {!vendor.contactName && !vendor.email && !vendor.phone && !location && !vendor.website && !vendor.notes && (
                <p className="text-sm text-slate-400">No contact details added yet.</p>
              )}
            </div>
          </Card>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Associated Trips</h2>
            {associatedTrips.length === 0 ? (
              <p className="text-sm text-slate-400">No trips associated with this vendor.</p>
            ) : (
              <div className="space-y-3">
                {associatedTrips.map((trip) => (
                  <Link key={trip.id} href={detailHref('trips', trip.id)}>
                    <Card className="bg-white p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-slate-800">{trip.title}</h3>
                          {trip.destination && (
                            <p className="text-sm text-slate-500">{trip.destination}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {trip.startDate && trip.endDate
                              ? `${new Date(trip.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} — ${new Date(trip.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}`
                              : 'Dates not set'}
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
        </>
      )}

      <TMDeleteDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
