'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { VendorForm } from '@/components/travelmanager/VendorForm';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';

const categoryColors: Record<string, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-700',
  HOTEL: 'bg-purple-100 text-purple-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  RESTAURANT: 'bg-green-100 text-green-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useTMToast();

  const [vendor, setVendor] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(setVendor)
      .catch(() => showToast('Failed to load vendor', 'error'))
      .finally(() => setIsLoading(false));
  }, [id, showToast]);

  const handleUpdate = async (data: any) => {
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      showToast('Vendor deleted');
      router.push('/vendors');
    } catch {
      showToast('Failed to delete vendor', 'error');
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
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

  if (!vendor) {
    return (
      <TMEmptyState
        title="Vendor not found"
        description="This vendor may have been deleted."
        actionLabel="Back to Vendors"
        actionHref="/vendors"
      />
    );
  }

  const location = [vendor.address, vendor.city, vendor.state].filter(Boolean).join(', ');
  const colorClass = categoryColors[vendor.category] || categoryColors.OTHER;
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();
  const associatedTrips = vendor.trips?.map((tv: any) => tv.trip) || [];

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
              {!vendor.email && !vendor.phone && !location && !vendor.website && !vendor.notes && (
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
                {associatedTrips.map((trip: any) => (
                  <Link key={trip.id} href={`/trips/${trip.id}`}>
                    <Card className="bg-white p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-slate-800">{trip.title}</h3>
                          <p className="text-sm text-slate-500">{trip.destination}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(trip.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} &mdash;{' '}
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
