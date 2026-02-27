'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ClientForm } from '@/components/travelmanager/ClientForm';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
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
      router.push(`/clients/${client.id}`);
    } catch {
      showToast('Failed to create client', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Clients', href: '/clients' }, { label: 'New Client' }]} />

      <h1 className="text-2xl font-bold text-slate-800">New Client</h1>

      <div className="max-w-lg rounded-lg bg-white p-6 shadow-sm">
        <ClientForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
