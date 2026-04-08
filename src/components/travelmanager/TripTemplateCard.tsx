'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
      router.push(`/trips/${data.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create trip', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="group flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-colors hover:border-amber-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        aria-label={`Start with ${template.name} template`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl leading-none" aria-hidden="true">
            {template.emoji}
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-800">{template.name}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>
          <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {template.durationDays} days
          </span>
        </div>
        <div className="mt-4 w-full">
          <span className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors group-hover:bg-amber-600">
            Start with this template
          </span>
        </div>
      </motion.button>

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
            <label htmlFor="template-start-date" className="text-sm font-medium text-slate-700">
              Start date
            </label>
            <div id="template-start-date">
              <DatePicker date={startDate} onDateChange={setStartDate} required />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !startDate}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
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
