'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Loader2 } from 'lucide-react';

interface TripFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: Record<string, string>;
}

function formatLocationName(result: GeoResult): string {
  const addr = result.address;
  const city = addr.city || addr.town || addr.village || addr.hamlet || '';
  const state = addr.state || '';
  const country = addr.country || '';
  const parts = [city, state, country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : result.display_name;
}

interface DestinationInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

function DestinationInput({ value, onChange, error, required }: DestinationInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastFetchRef.current;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }

    setIsSearching(true);
    try {
      lastFetchRef.current = Date.now();
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      // Silently fail — user can still type freely
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 400);
  };

  const handleSelect = (result: GeoResult) => {
    const formatted = formatLocationName(result);
    setQuery(formatted);
    onChange(formatted);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id="destination"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search for a city or place..."
          aria-invalid={!!error}
          aria-describedby={error ? 'destination-error' : undefined}
          className={`pr-8 ${error ? 'border-red-500' : ''}`}
          autoComplete="off"
          required={required}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MapPin className="size-4" />
          )}
        </div>
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.lat}-${result.lon}-${idx}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2"
              onClick={() => handleSelect(result)}
            >
              <MapPin className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-slate-800 truncate">
                  {formatLocationName(result)}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {result.display_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateForInput(date: string | undefined) {
  if (!date) return '';
  // Extract YYYY-MM-DD directly to avoid timezone shift
  const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // Fallback: use local date to avoid UTC offset shifting the day
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function TripForm({ initialData, onSubmit, isLoading }: TripFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [destination, setDestination] = useState(initialData?.destination || '');
  const [startDate, setStartDate] = useState(formatDateForInput(initialData?.startDate));
  const [endDate, setEndDate] = useState(formatDateForInput(initialData?.endDate));
  const [status, setStatus] = useState(initialData?.status || 'DRAFT');
  const [budget, setBudget] = useState(initialData?.budget?.toString() || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDestination(initialData.destination || '');
      setStartDate(formatDateForInput(initialData.startDate));
      setEndDate(formatDateForInput(initialData.endDate));
      setStatus(initialData.status || 'PLANNED');
      setBudget(initialData.budget?.toString() || '');
      setNotes(initialData.notes || '');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    const isDraft = status === 'DRAFT';
    if (!isDraft && !destination.trim()) newErrors.destination = 'Destination is required';
    if (!isDraft && !startDate) newErrors.startDate = 'Start date is required';
    if (!isDraft && !endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({
      title: title.trim(),
      destination: destination.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      status,
      budget: budget ? parseFloat(budget) : null,
      notes: notes.trim() || null,
    });
  };

  const isDraft = status === 'DRAFT';
  const req = isDraft ? '' : ' *';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isDraft && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          Draft trips only require a title. Add destination and dates when you&apos;re ready.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer Europe Trip"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
            className={errors.title ? 'border-red-500' : ''}
          />
          {errors.title && <p id="title-error" className="text-xs text-red-500">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="destination">Destination{req}</Label>
          <DestinationInput
            value={destination}
            onChange={setDestination}
            error={errors.destination}
            required={!isDraft}
          />
          {errors.destination && <p id="destination-error" className="text-xs text-red-500">{errors.destination}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date{req}</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max="9999-12-31"
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? 'startDate-error' : undefined}
            className={errors.startDate ? 'border-red-500' : ''}
          />
          {errors.startDate && <p id="startDate-error" className="text-xs text-red-500">{errors.startDate}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date{req}</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            max="9999-12-31"
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? 'endDate-error' : undefined}
            className={errors.endDate ? 'border-red-500' : ''}
          />
          {errors.endDate && <p id="endDate-error" className="text-xs text-red-500">{errors.endDate}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="budget">Budget</Label>
          <Input
            id="budget"
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          maxLength={5000}
        />
        <p className="text-xs text-slate-400">{notes.length}/5000</p>
      </div>

      <Button type="submit" disabled={isLoading} className="bg-amber-500 hover:bg-amber-600">
        {isLoading ? 'Saving...' : initialData ? 'Update Trip' : 'Create Trip'}
      </Button>
    </form>
  );
}
