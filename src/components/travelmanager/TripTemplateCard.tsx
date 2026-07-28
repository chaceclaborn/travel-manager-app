'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { useTMToast } from '@/components/travelmanager/TMToast';
import type { TripTemplate } from '@/lib/travelmanager/templates';
import { toLocalDateString } from '@/lib/date-utils';

interface TripTemplateCardProps {
  template: TripTemplate;
}

export function TripTemplateCard({ template }: TripTemplateCardProps) {
  const router = useRouter();
  const { showToast } = useTMToast();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => toLocalDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!startDate) {
      showToast('Please pick a start date', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/trips/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, startDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }
      const data = (await res.json()) as { id: string };
      showToast(`${template.name} created`, 'success');
      setOpen(false);
      router.push(detailHref('trips', data.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create trip', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* The whole card is the button, so the label inside it is a plain
          span styled as a secondary control — a filled primary button here
          would put three competing calls-to-action in one row. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tm-card tm-card-interactive group flex flex-col items-center justify-between p-5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40 focus-visible:ring-offset-2"
        aria-label={`Start with ${template.name} template`}
      >
        <span className="flex flex-col items-center gap-1.5">
          <span className="text-[32px] leading-none" aria-hidden="true">
            {template.emoji}
          </span>
          <span className="mt-1 text-[14px] font-semibold tracking-[-0.01em] text-tm-ink">{template.name}</span>
          <span className="tm-prose text-[12px] leading-[1.5] text-tm-subtle">{template.description}</span>
          <span className="mt-1 inline-flex items-center rounded-full bg-tm-fill px-2.5 py-[3px] text-[11px] font-medium text-tm-label">
            {template.durationDays} days
          </span>
        </span>
        <span className="mt-4 w-full">
          <span className="tm-btn tm-btn-secondary w-full group-hover:border-tm-control-hover group-hover:bg-tm-wash">
            Use this template
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="mr-2" aria-hidden="true">
                {template.emoji}
              </span>
              {template.name}
            </DialogTitle>
            <DialogDescription>
              Pick a start date. We&apos;ll build a {template.durationDays}-day trip with{' '}
              {template.itinerary.length} itinerary items and {template.checklist.length} checklist items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="template-start-date" className="text-[13px] font-medium text-tm-label">
              Start date
            </label>
            <div id="template-start-date">
              <DatePicker date={startDate} onDateChange={setStartDate} required />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting} className="tm-btn tm-btn-secondary">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !startDate} className="tm-btn tm-btn-primary">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create trip'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
