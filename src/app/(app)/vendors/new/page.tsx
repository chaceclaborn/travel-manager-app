'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';
import { TMPageShell, TMBackRow } from '@/components/travelmanager/TMPageShell';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorForm } from '@/components/travelmanager/VendorForm';
import { useTMToast } from '@/components/travelmanager/TMToast';

export default function NewVendorPage() {
  const router = useRouter();
  const { showToast } = useTMToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: Record<string, unknown>) => {
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
      router.push(detailHref('vendors', vendor.id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create vendor', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TMPageShell width={760}>
      <TMBackRow href="/vendors" section="Vendors" />
      <div className="space-y-5 pt-4 md:pt-6">

      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-tm-ink">New Vendor</h1>

      <div className="tm-card p-6">
        <VendorForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
      </div>
    </TMPageShell>
  );
}
