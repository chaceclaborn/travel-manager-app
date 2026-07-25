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
import { MapPin, Loader2, Plane, Car, X, Users, Briefcase, TreePalm } from 'lucide-react';
import { DateRangePicker } from '@/components/travelmanager/DateRangePicker';
import { AirportPicker } from '@/components/travelmanager/AirportPicker';
import { Badge } from '@/components/ui/badge';

interface SimpleClient {
  id: string;
  name: string;
  company?: string | null;
}

interface SimpleFriend {
  id: string;
  name: string;
}

interface TripFormInitialData {
  title?: string | null;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  tripType?: string | null;
  budget?: number | string | null;
  notes?: string | null;
  transportMode?: string | null;
  departureAirportCode?: string | null;
  departureAirportName?: string | null;
  departureAirportLat?: number | null;
  departureAirportLng?: number | null;
  arrivalAirportCode?: string | null;
  arrivalAirportName?: string | null;
  arrivalAirportLat?: number | null;
  arrivalAirportLng?: number | null;
  clientIds?: string[];
  friendIds?: string[];
}

interface TripFormProps {
  initialData?: TripFormInitialData;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
}

const TRIP_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal', icon: TreePalm },
  { value: 'WORK', label: 'Work', icon: Briefcase },
];

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

function formatDateForInput(date: string | null | undefined) {
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
  const [tripType, setTripType] = useState(initialData?.tripType || 'PERSONAL');
  const [budget, setBudget] = useState(initialData?.budget?.toString() || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [transportMode, setTransportMode] = useState(initialData?.transportMode || '');
  const [departureAirport, setDepartureAirport] = useState<{ code: string; name: string; lat: number; lng: number } | null>(
    initialData?.departureAirportCode ? {
      code: initialData.departureAirportCode,
      name: initialData.departureAirportName || '',
      lat: initialData.departureAirportLat || 0,
      lng: initialData.departureAirportLng || 0,
    } : null
  );
  const [arrivalAirport, setArrivalAirport] = useState<{ code: string; name: string; lat: number; lng: number } | null>(
    initialData?.arrivalAirportCode ? {
      code: initialData.arrivalAirportCode,
      name: initialData.arrivalAirportName || '',
      lat: initialData.arrivalAirportLat || 0,
      lng: initialData.arrivalAirportLng || 0,
    } : null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allClients, setAllClients] = useState<SimpleClient[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    initialData?.clientIds || []
  );
  const [clientSearch, setClientSearch] = useState('');
  const [allFriends, setAllFriends] = useState<SimpleFriend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(
    initialData?.friendIds || []
  );
  const [friendSearch, setFriendSearch] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllClients(data))
      .catch(() => {});
    fetch('/api/friends')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllFriends(data))
      .catch(() => {});
  }, []);

  // Sync to initialData when the parent passes a new reference (e.g. when an
  // edit page hydrates the trip). Inline guard pattern avoids cascading
  // renders from useEffect — see react.dev "you might not need an effect".
  const [prevInitial, setPrevInitial] = useState(initialData);
  if (initialData !== prevInitial) {
    setPrevInitial(initialData);
    if (initialData) {
      setTitle(initialData.title || '');
      setDestination(initialData.destination || '');
      setStartDate(formatDateForInput(initialData.startDate));
      setEndDate(formatDateForInput(initialData.endDate));
      setStatus(initialData.status || 'PLANNED');
      setTripType(initialData.tripType || 'PERSONAL');
      setBudget(initialData.budget?.toString() || '');
      setNotes(initialData.notes || '');
      setTransportMode(initialData.transportMode || '');
      setDepartureAirport(initialData.departureAirportCode ? {
        code: initialData.departureAirportCode,
        name: initialData.departureAirportName || '',
        lat: initialData.departureAirportLat || 0,
        lng: initialData.departureAirportLng || 0,
      } : null);
      setArrivalAirport(initialData.arrivalAirportCode ? {
        code: initialData.arrivalAirportCode,
        name: initialData.arrivalAirportName || '',
        lat: initialData.arrivalAirportLat || 0,
        lng: initialData.arrivalAirportLng || 0,
      } : null);
    }
  }

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

    if (!isDraft && transportMode === 'FLIGHT') {
      if (!departureAirport) newErrors.departureAirport = 'Departure airport is required for flight trips';
      if (!arrivalAirport) newErrors.arrivalAirport = 'Arrival airport is required for flight trips';
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
      tripType,
      budget: budget ? parseFloat(budget) : null,
      notes: notes.trim() || null,
      transportMode: transportMode || null,
      departureAirportCode: departureAirport?.code || null,
      departureAirportName: departureAirport?.name || null,
      departureAirportLat: departureAirport?.lat || null,
      departureAirportLng: departureAirport?.lng || null,
      arrivalAirportCode: arrivalAirport?.code || null,
      arrivalAirportName: arrivalAirport?.name || null,
      arrivalAirportLat: arrivalAirport?.lat || null,
      arrivalAirportLng: arrivalAirport?.lng || null,
      clientIds: selectedClientIds,
      friendIds: selectedFriendIds,
    });
  };

  const isDraft = status === 'DRAFT';
  const req = isDraft ? '' : ' *';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Trip type — personal vs work */}
      <div className="space-y-1.5">
        <Label>Trip Type</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:inline-grid sm:w-72" role="radiogroup" aria-label="Trip type">
          {TRIP_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = tripType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTripType(value)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 active:text-slate-700'
                }`}
              >
                <Icon className={`size-4 ${active ? (value === 'WORK' ? 'text-sky-600' : 'text-emerald-600') : ''}`} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

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
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) setErrors((prev) => ({ ...prev, title: '' }));
            }}
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
            onChange={(val) => {
              setDestination(val);
              if (val.trim()) setErrors((prev) => ({ ...prev, destination: '' }));
            }}
            error={errors.destination}
            required={!isDraft}
          />
          {errors.destination && <p id="destination-error" className="text-xs text-red-500">{errors.destination}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Travel Dates{req}</Label>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) => {
              setStartDate(date);
              if (date) setErrors((prev) => ({ ...prev, startDate: '' }));
            }}
            onEndDateChange={(date) => {
              setEndDate(date);
              if (date) setErrors((prev) => ({ ...prev, endDate: '' }));
            }}
            error={errors.startDate || errors.endDate}
            required={!isDraft}
          />
          {(errors.startDate || errors.endDate) && (
            <p className="text-xs text-red-500">{errors.startDate || errors.endDate}</p>
          )}
        </div>

        <div className="sm:col-span-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trip Details</p>
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
          <Label htmlFor="transportMode">Transport Mode</Label>
          <Select value={transportMode} onValueChange={setTransportMode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select transport mode..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FLIGHT">
                <span className="flex items-center gap-2"><Plane className="size-3.5" /> Flight</span>
              </SelectItem>
              <SelectItem value="CAR">
                <span className="flex items-center gap-2"><Car className="size-3.5" /> Car / Drive</span>
              </SelectItem>
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

      {transportMode === 'FLIGHT' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <AirportPicker
              value={departureAirport?.code || ''}
              displayValue={departureAirport ? `${departureAirport.code} — ${departureAirport.name}` : ''}
              onChange={setDepartureAirport}
              label={`Departure Airport${req}`}
              error={errors.departureAirport}
              required={!isDraft}
            />
            {errors.departureAirport && <p className="text-xs text-red-500">{errors.departureAirport}</p>}
          </div>
          <div className="space-y-1.5">
            <AirportPicker
              value={arrivalAirport?.code || ''}
              displayValue={arrivalAirport ? `${arrivalAirport.code} — ${arrivalAirport.name}` : ''}
              onChange={setArrivalAirport}
              label={`Arrival Airport${req}`}
              error={errors.arrivalAirport}
              required={!isDraft}
            />
            {errors.arrivalAirport && <p className="text-xs text-red-500">{errors.arrivalAirport}</p>}
          </div>
        </div>
      )}

      {allFriends.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Travel Companions</p>
          <Label>Friends</Label>
          {selectedFriendIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedFriendIds.map((fid) => {
                const friend = allFriends.find((f) => f.id === fid);
                if (!friend) return null;
                return (
                  <Badge key={fid} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                    {friend.name}
                    <button
                      type="button"
                      onClick={() => setSelectedFriendIds((prev) => prev.filter((id) => id !== fid))}
                      className="rounded-full p-0.5 hover:bg-emerald-200/50 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="relative">
            <Input
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder="Search friends to add..."
              className="pr-8"
            />
            <Users className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          </div>
          {friendSearch.length > 0 && (
            <div className="border border-slate-200 rounded-lg bg-white shadow-sm max-h-[150px] overflow-y-auto">
              {allFriends
                .filter(
                  (f) =>
                    !selectedFriendIds.includes(f.id) &&
                    f.name.toLowerCase().includes(friendSearch.toLowerCase())
                )
                .map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                    onClick={() => {
                      setSelectedFriendIds((prev) => [...prev, friend.id]);
                      setFriendSearch('');
                    }}
                  >
                    <span className="font-medium text-slate-700">{friend.name}</span>
                  </button>
                ))}
              {allFriends.filter(
                (f) =>
                  !selectedFriendIds.includes(f.id) &&
                  f.name.toLowerCase().includes(friendSearch.toLowerCase())
              ).length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">No matching friends</p>
              )}
            </div>
          )}
        </div>
      )}

      {tripType === 'WORK' && allClients.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Work Trip</p>
          <Label>Clients</Label>
          {selectedClientIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedClientIds.map((id) => {
                const client = allClients.find((c) => c.id === id);
                if (!client) return null;
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
                    {client.name}
                    <button
                      type="button"
                      onClick={() => setSelectedClientIds((prev) => prev.filter((cid) => cid !== id))}
                      className="rounded-full p-0.5 hover:bg-amber-200/50 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="relative">
            <Input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search clients to add..."
              className="pr-8"
            />
            <Users className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          </div>
          {clientSearch.length > 0 && (
            <div className="border border-slate-200 rounded-lg bg-white shadow-sm max-h-[150px] overflow-y-auto">
              {allClients
                .filter(
                  (c) =>
                    !selectedClientIds.includes(c.id) &&
                    (c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                      c.company?.toLowerCase().includes(clientSearch.toLowerCase()))
                )
                .map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                    onClick={() => {
                      setSelectedClientIds((prev) => [...prev, client.id]);
                      setClientSearch('');
                    }}
                  >
                    <span className="font-medium text-slate-700">{client.name}</span>
                    {client.company && (
                      <span className="text-slate-400 ml-1.5">({client.company})</span>
                    )}
                  </button>
                ))}
              {allClients.filter(
                (c) =>
                  !selectedClientIds.includes(c.id) &&
                  (c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    c.company?.toLowerCase().includes(clientSearch.toLowerCase()))
              ).length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">No matching clients</p>
              )}
            </div>
          )}
        </div>
      )}

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

      <Button type="submit" disabled={isLoading} className="tm-btn tm-btn-primary">
        {isLoading ? 'Saving...' : initialData ? 'Update Trip' : 'Create Trip'}
      </Button>
    </form>
  );
}
