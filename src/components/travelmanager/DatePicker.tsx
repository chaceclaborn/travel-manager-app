'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toLocalDateString, parseLocalDate, formatDateDisplay } from '@/lib/date-utils';

interface DatePickerProps {
  date: string;
  onDateChange: (date: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  /** Disable dates before this date (YYYY-MM-DD or ISO string). */
  minDate?: string;
  /** Disable dates after this date (YYYY-MM-DD or ISO string). */
  maxDate?: string;
  /** Navigate calendar to this month when opened (YYYY-MM-DD or ISO string).
   *  Updates live — if the linked date changes while closed, the next open
   *  will show the new month. Selected date takes priority if present. */
  defaultMonth?: string;
}

export function DatePicker({
  date,
  onDateChange,
  error,
  required,
  placeholder = 'Select date',
  minDate,
  maxDate,
  defaultMonth: defaultMonthStr,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(() => parseLocalDate(date));
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    return parseLocalDate(date) || parseLocalDate(defaultMonthStr ?? '') || new Date();
  });

  useEffect(() => {
    setSelected(parseLocalDate(date));
  }, [date]);

  // When the popover opens, snap to the right month:
  // selected date's month if we have one, otherwise the defaultMonth prop
  useEffect(() => {
    if (open) {
      const target = parseLocalDate(date) || parseLocalDate(defaultMonthStr ?? '');
      if (target) setViewMonth(target);
    }
  }, [open, date, defaultMonthStr]);

  const handleSelect = (day: Date | undefined) => {
    setSelected(day);
    if (day) {
      onDateChange(toLocalDateString(day));
      setOpen(false);
    } else {
      onDateChange('');
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

  const label = date ? formatDateDisplay(date) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${!date ? 'text-muted-foreground' : ''} ${error ? 'border-red-500' : ''}`}
          aria-required={required}
        >
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          month={viewMonth}
          onMonthChange={setViewMonth}
          disabled={disabled.length > 0 ? disabled : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
