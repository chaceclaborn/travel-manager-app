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
  minDate?: string;
  maxDate?: string;
}

export function DatePicker({
  date,
  onDateChange,
  error,
  required,
  placeholder = 'Select date',
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(() => parseLocalDate(date));

  useEffect(() => {
    setSelected(parseLocalDate(date));
  }, [date]);

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
          defaultMonth={selected || new Date()}
          disabled={disabled.length > 0 ? disabled : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
