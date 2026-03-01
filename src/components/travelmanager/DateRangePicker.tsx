'use client';

import { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseLocalDate(startDate);
    const to = parseLocalDate(endDate);
    if (from || to) return { from, to };
    return undefined;
  });

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const from = parseLocalDate(startDate);
    const to = parseLocalDate(endDate);
    if (from || to) {
      setRange({ from, to });
    } else {
      setRange(undefined);
    }
  }, [startDate, endDate]);

  const handleSelect = (selected: DateRange | undefined) => {
    setRange(selected);
    if (selected?.from) {
      onStartDateChange(toLocalDateString(selected.from));
    } else {
      onStartDateChange('');
    }
    if (selected?.to) {
      onEndDateChange(toLocalDateString(selected.to));
      setOpen(false);
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
    <Popover open={open} onOpenChange={(next) => {
      if (!next && range?.from && !range?.to) return;
      setOpen(next);
    }}>
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
          defaultMonth={range?.from || new Date()}
          disabled={disabled.length > 0 ? disabled : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
