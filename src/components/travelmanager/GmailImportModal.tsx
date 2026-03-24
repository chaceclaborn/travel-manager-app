'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Search, Loader2, X, Plane, Building2, Car, Train, Bus, Package, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ParsedBooking } from '@/lib/travelmanager/email-parser';

interface EmailResult {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (parsed: ParsedBooking) => void;
}

const QUICK_FILTERS = [
  { label: 'Flight confirmations', query: 'subject:(flight confirmation OR boarding pass OR itinerary)' },
  { label: 'Hotel bookings', query: 'subject:(hotel reservation OR booking confirmation OR check-in)' },
  { label: 'Car rentals', query: 'subject:(car rental OR rental confirmation OR pickup)' },
  { label: 'All bookings', query: 'subject:(confirmation OR reservation OR booking) (flight OR hotel OR car OR train)' },
];

const typeIcons: Record<string, React.ReactNode> = {
  FLIGHT: <Plane className="size-4" />,
  HOTEL: <Building2 className="size-4" />,
  CAR_RENTAL: <Car className="size-4" />,
  TRAIN: <Train className="size-4" />,
  BUS: <Bus className="size-4" />,
  OTHER: <Package className="size-4" />,
};

const confidenceColors = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export function GmailImportModal({ open, onClose, onImport }: GmailImportModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ParsedBooking | null>(null);
  const [parsing, setParsing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    setParsedPreview(null);
    setSelectedId(null);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(q)}&maxResults=10`);
      if (!res.ok) {
        const data = await res.json();
        if (data.code === 'NOT_CONNECTED') {
          setError('Gmail not connected. Please connect in Settings first.');
          return;
        }
        throw new Error(data.error || 'Search failed');
      }
      const data: EmailResult[] = await res.json();
      setResults(data);
      if (data.length === 0) setError('No matching emails found. Try a different search.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleParse = async (messageId: string) => {
    setSelectedId(messageId);
    setParsing(true);
    setParsedPreview(null);
    try {
      const res = await fetch(`/api/gmail/search?messageId=${messageId}`);
      if (!res.ok) throw new Error('Failed to parse email');
      const data: ParsedBooking = await res.json();
      setParsedPreview(data);
    } catch {
      setError('Failed to parse email');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (parsedPreview) {
      onImport(parsedPreview);
      handleClose();
    }
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setParsedPreview(null);
    setSelectedId(null);
    setError('');
    setSearching(false);
    setParsing(false);
    onClose();
  };

  const formatEmailDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatFrom = (from: string) => {
    const match = from.match(/(?:"?([^"<]+)"?\s*)?<.*>/);
    return match?.[1]?.trim() || from.split('<')[0].trim() || from;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-red-500" />
            Import from Gmail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search your emails..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => handleSearch(query)}
              disabled={searching || !query.trim()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Quick filter chips */}
          {results.length === 0 && !searching && !error && (
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => { setQuery(f.query); handleSearch(f.query); }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && !parsedPreview && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <p className="text-xs text-slate-400">{results.length} emails found</p>
              <AnimatePresence>
                {results.map((email, i) => (
                  <motion.button
                    key={email.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleParse(email.id)}
                    disabled={parsing}
                    className={`w-full rounded-lg border p-3 text-left transition-all duration-200 hover:shadow-sm ${
                      selectedId === email.id
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{email.subject}</p>
                        <p className="text-xs text-slate-500">{formatFrom(email.from)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-slate-400">{formatEmailDate(email.date)}</span>
                        {parsing && selectedId === email.id && (
                          <Loader2 className="size-3.5 animate-spin text-amber-500" />
                        )}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{email.snippet}</p>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Parsed preview */}
          {parsedPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Extracted Booking Details</h3>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColors[parsedPreview.confidence]}`}>
                    {parsedPreview.confidence} confidence
                  </span>
                  <button
                    onClick={() => { setParsedPreview(null); setSelectedId(null); }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {parsedPreview.type && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-sm text-slate-600">
                        {typeIcons[parsedPreview.type] || typeIcons.OTHER}
                        <span className="font-medium">{parsedPreview.type.replace('_', ' ')}</span>
                      </span>
                    </div>
                  )}
                  {parsedPreview.provider && (
                    <div className="text-sm"><span className="text-slate-400">Provider:</span> <span className="font-medium text-slate-700">{parsedPreview.provider}</span></div>
                  )}
                  {parsedPreview.confirmationNum && (
                    <div className="text-sm"><span className="text-slate-400">Confirmation:</span> <span className="font-mono font-medium text-slate-700">{parsedPreview.confirmationNum}</span></div>
                  )}
                  {(parsedPreview.location || parsedPreview.endLocation) && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-slate-400">Route:</span>
                      <span className="font-medium text-slate-700">{parsedPreview.location || '...'}</span>
                      {parsedPreview.endLocation && (
                        <>
                          <ArrowRight className="size-3 text-slate-400" />
                          <span className="font-medium text-slate-700">{parsedPreview.endLocation}</span>
                        </>
                      )}
                    </div>
                  )}
                  {parsedPreview.startDateTime && (
                    <div className="text-sm"><span className="text-slate-400">Start:</span> <span className="font-medium text-slate-700">{parsedPreview.startDateTime}</span></div>
                  )}
                  {parsedPreview.endDateTime && (
                    <div className="text-sm"><span className="text-slate-400">End:</span> <span className="font-medium text-slate-700">{parsedPreview.endDateTime}</span></div>
                  )}
                  {parsedPreview.seat && (
                    <div className="text-sm"><span className="text-slate-400">Seat:</span> <span className="font-medium text-slate-700">{parsedPreview.seat}</span></div>
                  )}
                </div>

                {parsedPreview.confidence !== 'high' && (
                  <p className="text-xs text-amber-600">
                    Some fields may need manual correction. Review the form after importing.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleImport} className="bg-amber-500 hover:bg-amber-600">
                  Use this data
                </Button>
                <Button variant="outline" onClick={() => { setParsedPreview(null); setSelectedId(null); }}>
                  Back to results
                </Button>
              </div>
            </motion.div>
          )}

          {/* Searching state */}
          {searching && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="size-6 animate-spin text-amber-500" />
              <p className="mt-2 text-sm text-slate-400">Searching your emails...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
