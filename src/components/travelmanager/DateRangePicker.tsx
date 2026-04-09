'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toLocalDateString, parseLocalDate, formatDateDisplay } from '@/lib/date-utils';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  error?: string;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  error,
  required,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // Lazy initializer reads matchMedia during the first client render so we
  // never need a synchronous setState in an effect just to seed the value.
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });
  const [viewMonth, setViewMonth] = useState<Date>(() => parseLocalDate(startDate) || new Date());

  // `range` is derived from the controlled props — no local state needed.
  // This used to be `useState` + a sync effect, which tripped
  // react-hooks/set-state-in-effect. Deriving in render is the React 19 fix.
  const range = useMemo<DateRange | undefined>(() => {
    const from = parseLocalDate(startDate);
    const to = parseLocalDate(endDate);
    if (from || to) return { from, to };
    return undefined;
  }, [startDate, endDate]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleOpenChange = (next: boolean) => {
    // Block close while a partial range is in progress (start picked, no end).
    if (!next && range?.from && (!range?.to || range.to.getTime() === range.from.getTime())) return;
    // Snap the calendar to the relevant month when opening — handled in the
    // event handler instead of an effect to avoid set-state-in-effect.
    if (next) {
      const target = parseLocalDate(startDate) || parseLocalDate(endDate);
      if (target) setViewMonth(target);
    }
    setOpen(next);
  };

  const handleSelect = (selected: DateRange | undefined) => {
    if (selected?.from) {
      onStartDateChange(toLocalDateString(selected.from));
    } else {
      onStartDateChange('');
    }
    if (selected?.to) {
      onEndDateChange(toLocalDateString(selected.to));
      if (selected.from && selected.to.getTime() !== selected.from.getTime()) {
        setOpen(false);
      }
    } else {
      onEndDateChange('');
    }
  };

  const disabled: ({ before: Date } | { after: Date })[] = [];
  if (minDate) {
    const min = parseLocalDate(minDate);
    if (min) disabled.push({ before: min });
  }
  if (maxDate) {
    const max = parseLocalDate(maxDate);
    if (max) disabled.push({ after: max });
  }

  const label = startDate && endDate
    ? `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`
    : startDate
      ? `${formatDateDisplay(startDate)} – ...`
      : 'Select dates';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${!startDate && !endDate ? 'text-muted-foreground' : ''} ${error ? 'border-red-500' : ''}`}
          aria-required={required}
        >
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={isMobile ? 1 : 2}
          month={viewMonth}
          onMonthChange={setViewMonth}
          disabled={disabled.length > 0 ? disabled : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
