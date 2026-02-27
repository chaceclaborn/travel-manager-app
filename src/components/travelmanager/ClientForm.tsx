'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ClientFormProps {
  initialData?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
  onSubmit: (data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    notes: string;
  }) => void;
  isLoading?: boolean;
}

export function ClientForm({ initialData, onSubmit, isLoading }: ClientFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [company, setCompany] = useState(initialData?.company ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [phone, setPhone] = useState(initialData?.phone ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? '');
      setCompany(initialData.company ?? '');
      setEmail(initialData.email ?? '');
      setPhone(initialData.phone ?? '');
      setNotes(initialData.notes ?? '');
    }
  }, [initialData]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({ name: name.trim(), company, email, phone, notes });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="client-name">Name *</Label>
        <Input
          id="client-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => { const { name: _, ...rest } = prev; return rest; });
          }}
          placeholder="Client name"
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'client-name-error' : undefined}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && <p id="client-name-error" className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-company">Company</Label>
        <Input
          id="client-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-email">Email</Label>
        <Input
          id="client-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'client-email-error' : undefined}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && <p id="client-email-error" className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-phone">Phone</Label>
        <Input
          id="client-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client-notes">Notes</Label>
        <Textarea
          id="client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={4}
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="bg-amber-500 hover:bg-amber-600 text-white"
      >
        {isLoading ? 'Saving...' : initialData ? 'Update Client' : 'Create Client'}
      </Button>
    </form>
  );
}
