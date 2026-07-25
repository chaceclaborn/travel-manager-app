'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';
import { TMPageShell, TMBackRow } from '@/components/travelmanager/TMPageShell';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientForm } from '@/components/travelmanager/ClientForm';
import { useTMToast } from '@/components/travelmanager/TMToast';

export default function NewClientPage() {
  const router = useRouter();
  const { showToast } = useTMToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    notes: string;
  }) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create client');
      const client = await res.json();
      showToast('Client created successfully');
      router.push(detailHref('clients', client.id));
    } catch {
      showToast('Failed to create client', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TMPageShell width={760}>
      <TMBackRow href="/clients" section="Clients" />
      <div className="space-y-5 pt-4 md:pt-6">

      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-tm-ink">New Client</h1>

      <div className="tm-card p-6">
        <ClientForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
      </div>
    </TMPageShell>
  );
}
