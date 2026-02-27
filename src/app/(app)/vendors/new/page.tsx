'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorForm } from '@/components/travelmanager/VendorForm';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';

export default function NewVendorPage() {
  const router = useRouter();
  const { showToast } = useTMToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create vendor');
      }

      const vendor = await res.json();
      showToast('Vendor created successfully');
      router.push(`/vendors/${vendor.id}`);
    } catch (error: any) {
      showToast(error.message || 'Failed to create vendor', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Vendors', href: '/vendors' }, { label: 'New Vendor' }]} />

      <h1 className="text-2xl font-bold text-slate-800">New Vendor</h1>

      <div className="max-w-2xl rounded-lg bg-white p-6 shadow-sm">
        <VendorForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
