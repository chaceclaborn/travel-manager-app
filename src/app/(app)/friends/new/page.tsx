'use client';

import { useState } from 'react';
import { TMPageShell, TMBackRow } from '@/components/travelmanager/TMPageShell';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';

export default function NewFriendPage() {
  const router = useRouter();
  const { showToast } = useTMToast();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [nameError, setNameError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add friend');
      }
      showToast('Friend added');
      router.push('/friends');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add friend', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TMPageShell width={760}>
      <TMBackRow href="/friends" section="Friends" />
      <div className="space-y-5 pt-4 md:pt-6">

      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-tm-ink">New Friend</h1>

      <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (e.target.value.trim()) setNameError('');
              }}
              placeholder="e.g. Sam Rivera"
              aria-invalid={!!nameError}
              className={nameError ? 'border-red-500' : ''}
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="sam@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Dietary preferences, seat preferences, anything useful..."
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="bg-amber-500 hover:bg-amber-600">
              {isLoading ? 'Adding...' : 'Add Friend'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/friends')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
      </div>
    </TMPageShell>
  );
}
