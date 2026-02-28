'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  error?: string;
  required?: boolean;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  error,
  required,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseLocalDate(startDate);
    const to = parseLocalDate(endDate);
    if (from || to) return { from, to };
    return undefined;
  });

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

  const label = startDate && endDate
    ? `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`
    : startDate
      ? `${formatDisplay(startDate)} – ...`
      : 'Select dates';

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          defaultMonth={range?.from || new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}
