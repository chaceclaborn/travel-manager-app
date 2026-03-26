'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Loader2, X, Plane, Building2, Car, Train, Bus, Package,
  ArrowRight, AlertCircle, RefreshCw, Shield, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';
import type { ParsedBooking } from '@/lib/travelmanager/email-parser';

interface EmailResult {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface ScoredEmail extends EmailResult {
  category: Category;
  score: number;
}

interface GmailImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (parsed: ParsedBooking) => void;
}

type Category = 'flights' | 'hotels' | 'car_rentals' | 'trains' | 'other';

interface AIClassification {
  category: string;
  confidence: number;
  reason: string;
}

// Tighter query: requires confirmation-like language, excludes promos/ads
// Also leverage Gmail's built-in category system to exclude promotions
const BOOKING_QUERY = [
  'category:updates OR category:primary',
  'subject:(confirmation OR "booking confirmed" OR "reservation confirmed" OR "itinerary" OR "boarding pass" OR "e-ticket" OR "check-in" OR "your trip" OR "your flight" OR "your reservation")',
  '-subject:(sale OR deal OR offer OR save OR promo OR "low fares" OR unsubscribe OR newsletter OR "limited time" OR rewards OR upgrade OR "earn points" OR survey)',
].join(' ');

// ── Sender domain → category mapping (highest confidence signal) ──

const SENDER_DOMAINS: Record<string, { category: Category; name: string }> = {
  // Airlines
  'delta.com': { category: 'flights', name: 'Delta' },
  'united.com': { category: 'flights', name: 'United' },
  'aa.com': { category: 'flights', name: 'American Airlines' },
  'southwest.com': { category: 'flights', name: 'Southwest' },
  'jetblue.com': { category: 'flights', name: 'JetBlue' },
  'spirit.com': { category: 'flights', name: 'Spirit' },
  'frontier.com': { category: 'flights', name: 'Frontier' },
  'alaskaair.com': { category: 'flights', name: 'Alaska Airlines' },
  'hawaiianairlines.com': { category: 'flights', name: 'Hawaiian Airlines' },
  'flyfrontier.com': { category: 'flights', name: 'Frontier' },
  'allegiantair.com': { category: 'flights', name: 'Allegiant' },
  'britishairways.com': { category: 'flights', name: 'British Airways' },
  'lufthansa.com': { category: 'flights', name: 'Lufthansa' },
  'emirates.com': { category: 'flights', name: 'Emirates' },
  'airfrance.fr': { category: 'flights', name: 'Air France' },
  'klm.com': { category: 'flights', name: 'KLM' },
  // Hotels
  'marriott.com': { category: 'hotels', name: 'Marriott' },
  'hilton.com': { category: 'hotels', name: 'Hilton' },
  'ihg.com': { category: 'hotels', name: 'IHG' },
  'hyatt.com': { category: 'hotels', name: 'Hyatt' },
  'wyndhamhotels.com': { category: 'hotels', name: 'Wyndham' },
  'choicehotels.com': { category: 'hotels', name: 'Choice Hotels' },
  'airbnb.com': { category: 'hotels', name: 'Airbnb' },
  'booking.com': { category: 'hotels', name: 'Booking.com' },
  'hotels.com': { category: 'hotels', name: 'Hotels.com' },
  'vrbo.com': { category: 'hotels', name: 'VRBO' },
  'bestwestern.com': { category: 'hotels', name: 'Best Western' },
  // Car rentals
  'hertz.com': { category: 'car_rentals', name: 'Hertz' },
  'enterprise.com': { category: 'car_rentals', name: 'Enterprise' },
  'avis.com': { category: 'car_rentals', name: 'Avis' },
  'budget.com': { category: 'car_rentals', name: 'Budget' },
  'nationalcar.com': { category: 'car_rentals', name: 'National' },
  'turo.com': { category: 'car_rentals', name: 'Turo' },
  'sixt.com': { category: 'car_rentals', name: 'Sixt' },
  // Trains/Buses
  'amtrak.com': { category: 'trains', name: 'Amtrak' },
  'greyhound.com': { category: 'trains', name: 'Greyhound' },
  'flixbus.com': { category: 'trains', name: 'FlixBus' },
};

// ── Spam / promo signals that strongly indicate NOT a booking ──

const PROMO_PATTERNS = [
  /\$\d+\s*(low\s*fares?|off|deal|sale)/i,
  /\b(save\s+up\s+to|limited\s+time|act\s+now|book\s+now\s*[:\-!])/i,
  /\b(unsubscribe|opt[\s-]?out|email\s+preferences|manage\s+subscriptions)/i,
  /\b(earn\s+\d+\s*points|bonus\s+(miles|points)|double\s+points)/i,
  /\b(low\s+fares?\s+from|fares?\s+starting|prices?\s+from)\b/i,
  /\b(newsletter|weekly\s+deals?|flash\s+sale|last\s+chance)\b/i,
  /\b(survey|rate\s+your|how\s+was|feedback|review\s+your\s+experience)/i,
  /\b(upgrade\s+your|join\s+our|loyalty|membership|credit\s+card)\b/i,
];

// ── Confirmation signals that strongly indicate a real booking ──

const CONFIRMATION_PATTERNS = [
  /\b(confirmation\s*(#|number|code|:)\s*[A-Z0-9]{4,})/i,
  /\b(booking\s+id|reservation\s+id|record\s+locator|pnr)\s*[:\s#]*[A-Z0-9]{4,}/i,
  /\b(your\s+(flight|trip|reservation|booking)\s+(is\s+)?confirmed)/i,
  /\b(e-?ticket|boarding\s+pass|itinerary\s+receipt)/i,
  /\b(check[\s-]?in\s+(date|time|on|:))/i,
  /\b(depart(s|ing|ure)?:?\s+\d|arriv(es?|ing|al):?\s+\d)/i,
  /\b(passenger|traveler|guest)\s*name/i,
];

// ── Category keyword patterns (used when sender domain isn't recognized) ──

const CATEGORY_PATTERNS: Record<Exclude<Category, 'other'>, RegExp[]> = {
  flights: [
    /\b(flight\s+(#|confirmation|itinerary))/i,
    /\b(boarding\s+pass|e-?ticket)/i,
    /\b(depart(ure|s|ing)|arrival)\s+(gate|terminal|time|from|at|:)/i,
    /\b[A-Z]{2,3}\d{1,4}\b/,  // flight numbers like UA1234, DL456
    /\b[A-Z]{3}\s*(→|to|[-–])\s*[A-Z]{3}\b/,  // airport codes: LAX → JFK
  ],
  hotels: [
    /\b(hotel|resort|inn|suites?|lodge)\s+(confirmation|reservation|booking)/i,
    /\b(check[\s-]?in|check[\s-]?out)\s*(date|time|:|\d)/i,
    /\b(room\s+(type|number|#|confirmation))/i,
    /\b(night(s)?\s+at|stay\s+at|guest\s+name)/i,
    /\b(airbnb|vrbo)\s+(confirmation|reservation)/i,
  ],
  car_rentals: [
    /\b(rental\s+(car|vehicle|confirmation)|car\s+rental)/i,
    /\b(pick[\s-]?up\s+(date|time|location|:))/i,
    /\b(drop[\s-]?off\s+(date|time|location|:))/i,
    /\b(vehicle\s+(type|class)|rental\s+agreement)/i,
  ],
  trains: [
    /\b(train|rail)\s+(ticket|confirmation|reservation)/i,
    /\b(amtrak|greyhound|flixbus)\s+(confirmation|ticket)/i,
    /\b(seat\s+\d|coach\s+\d|car\s+\d)/i,
    /\b(bus\s+ticket|coach\s+confirmation)/i,
  ],
};

const CATEGORY_UI: Record<Category, { label: string; icon: React.ReactNode }> = {
  flights: { label: 'Flights', icon: <Plane className="size-4" /> },
  hotels: { label: 'Hotels', icon: <Building2 className="size-4" /> },
  car_rentals: { label: 'Car Rentals', icon: <Car className="size-4" /> },
  trains: { label: 'Trains & Buses', icon: <Train className="size-4" /> },
  other: { label: 'Other', icon: <Package className="size-4" /> },
};

const typeIcons: Record<string, React.ReactNode> = {
  FLIGHT: <Plane className="size-4" />,
  HOTEL: <Building2 className="size-4" />,
  CAR_RENTAL: <Car className="size-4" />,
  TRAIN: <Train className="size-4" />,
  BUS: <Bus className="size-4" />,
  OTHER: <Package className="size-4" />,
};

const confidenceColors = {
  high: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ── Smart scoring + categorization ──

function extractDomain(from: string): string {
  const match = from.match(/@([a-z0-9.-]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function scoreAndCategorize(email: EmailResult): ScoredEmail {
  const text = `${email.subject} ${email.snippet}`;
  const fromDomain = extractDomain(email.from);
  let score = 0;
  let category: Category = 'other';

  // 1. Check sender domain (strongest signal)
  for (const [domain, info] of Object.entries(SENDER_DOMAINS)) {
    if (fromDomain === domain || fromDomain.endsWith(`.${domain}`)) {
      category = info.category;
      score += 50;
      break;
    }
  }

  // 2. Check for promo/ad signals (strong negative)
  for (const pattern of PROMO_PATTERNS) {
    if (pattern.test(text)) {
      score -= 30;
    }
  }

  // 3. Check for confirmation signals (strong positive)
  for (const pattern of CONFIRMATION_PATTERNS) {
    if (pattern.test(text)) {
      score += 20;
    }
  }

  // 4. If sender wasn't recognized, try category patterns
  if (category === 'other') {
    let bestCat: Category = 'other';
    let bestMatches = 0;

    for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS) as [Exclude<Category, 'other'>, RegExp[]][]) {
      const matches = patterns.filter((p) => p.test(text)).length;
      if (matches > bestMatches) {
        bestMatches = matches;
        bestCat = cat;
      }
    }

    if (bestMatches >= 1) {
      category = bestCat;
      score += bestMatches * 10;
    }
  }

  return { ...email, category, score };
}

// Map AI category names to our frontend categories
const AI_CATEGORY_MAP: Record<string, Category> = {
  flight: 'flights',
  hotel: 'hotels',
  car_rental: 'car_rentals',
  train_bus: 'trains',
  other_booking: 'other',
};

function filterAndSort(
  emails: EmailResult[],
  aiClassifications: Record<string, AIClassification>
): ScoredEmail[] {
  return emails
    .map((email) => {
      const ai = aiClassifications[email.id];

      // If AI classified it as not_booking with high confidence, drop it
      if (ai && ai.category === 'not_booking' && ai.confidence >= 0.7) {
        return { ...email, category: 'other' as Category, score: -100 };
      }

      // If AI has a positive classification, use it (overrides local scoring)
      if (ai && ai.category !== 'not_booking' && ai.confidence >= 0.5) {
        const category = AI_CATEGORY_MAP[ai.category] || 'other';
        return { ...email, category, score: Math.round(ai.confidence * 100) };
      }

      // Fall back to local scoring when AI didn't classify or had low confidence
      return scoreAndCategorize(email);
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ── Component ──

export function GmailImportModal({ open, onClose, onImport }: GmailImportModalProps) {
  const [rawResults, setRawResults] = useState<EmailResult[]>([]);
  const [aiClassifications, setAiClassifications] = useState<Record<string, AIClassification>>({});
  const [searching, setSearching] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ParsedBooking | null>(null);
  const [parsing, setParsing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const results = useMemo(() => filterAndSort(rawResults, aiClassifications), [rawResults, aiClassifications]);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setError('');
    setRawResults([]);
    setAiClassifications({});
    setParsedPreview(null);
    setSelectedId(null);
    setHasSearched(true);
    setActiveCategory('all');

    try {
      const res = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(BOOKING_QUERY)}&maxResults=20`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'NOT_CONNECTED') {
          setError('Gmail is not connected. Go to Settings to connect your account.');
          return;
        }
        if (res.status === 429) {
          setError('Too many requests. Please wait a moment and try again.');
          return;
        }
        if (res.status >= 500) {
          setError('Something went wrong on our end. Please try again.');
          return;
        }
        throw new Error(data.error || 'Failed to search emails');
      }

      const data = await res.json();

      // Handle both new format { results, classifications } and legacy flat array
      const emails: EmailResult[] = Array.isArray(data) ? data : (data.results || []);
      const cls: Record<string, AIClassification> = Array.isArray(data) ? {} : (data.classifications || {});

      if (!Array.isArray(emails)) {
        setError('Received an unexpected response. Please try again.');
        return;
      }

      setRawResults(emails);
      setAiClassifications(cls);
      const scored = filterAndSort(emails, cls);
      if (emails.length > 0 && scored.length === 0) {
        setError('Found emails but none looked like booking confirmations. Promotional emails were filtered out.');
      } else if (emails.length === 0) {
        setError('No booking emails found. Make sure your booking confirmations are in your inbox.');
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Check your internet connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleParse = async (messageId: string) => {
    if (parsing) return;
    setSelectedId(messageId);
    setParsing(true);
    setParsedPreview(null);
    setError('');

    try {
      const res = await fetch(`/api/gmail/search?messageId=${encodeURIComponent(messageId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError('Too many requests. Please wait a moment.');
          return;
        }
        throw new Error(data.error || 'Failed to parse email');
      }
      const data: ParsedBooking = await res.json();

      if (!data || typeof data !== 'object') {
        setError('Could not extract booking details from this email.');
        return;
      }

      setParsedPreview(data);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to extract booking details.');
      }
      setSelectedId(null);
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
    setRawResults([]);
    setAiClassifications({});
    setParsedPreview(null);
    setSelectedId(null);
    setError('');
    setSearching(false);
    setParsing(false);
    setHasSearched(false);
    setActiveCategory('all');
    onClose();
  };

  const formatEmailDate = (dateStr: string) => formatDate(dateStr) ?? dateStr;

  const formatFrom = (from: string) => {
    const match = from.match(/(?:"?([^"<]+)"?\s*)?<.*>/);
    return match?.[1]?.trim() || from.split('<')[0].trim() || from;
  };

  // Group results by category
  const grouped = useMemo(() => {
    const g: Record<Category, ScoredEmail[]> = {
      flights: [], hotels: [], car_rentals: [], trains: [], other: [],
    };
    for (const email of results) {
      g[email.category].push(email);
    }
    return g;
  }, [results]);

  const filteredResults =
    activeCategory === 'all' ? results : grouped[activeCategory] || [];

  const categoryCountsExist = Object.values(grouped).some((arr) => arr.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-red-500" />
            Import from Gmail
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {/* Initial state — scan button */}
          {!hasSearched && !searching && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <div className="rounded-full bg-amber-50 p-4">
                <Inbox className="size-8 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  Scan your inbox for booking confirmations
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  We&apos;ll find flights, hotels, car rentals, and more
                </p>
              </div>
              <Button
                onClick={handleSearch}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Mail className="mr-2 size-4" />
                Scan Inbox
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Shield className="size-3" />
                Read-only access — we never modify your emails
              </div>
            </motion.div>
          )}

          {/* Searching state */}
          {searching && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="size-7 animate-spin text-amber-500" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Scanning your inbox...
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Finding confirmations, filtering out promotions
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <AlertCircle className="size-4 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                {hasSearched && (
                  <button
                    onClick={handleSearch}
                    className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <RefreshCw className="size-3" /> Try again
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Category tabs */}
          {results.length > 0 && !parsedPreview && categoryCountsExist && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({results.length})
              </button>
              {(Object.entries(CATEGORY_UI) as [Category, typeof CATEGORY_UI[Category]][]).map(
                ([key, config]) => {
                  const count = grouped[key].length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeCategory === key
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {config.icon}
                      {config.label} ({count})
                    </button>
                  );
                }
              )}
            </div>
          )}

          {/* Results list */}
          {filteredResults.length > 0 && !parsedPreview && (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              <AnimatePresence mode="popLayout">
                {filteredResults.map((email, i) => (
                  <motion.button
                    key={email.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleParse(email.id)}
                    disabled={parsing}
                    className={`w-full rounded-lg border p-3 text-left transition-all duration-150 ${
                      selectedId === email.id
                        ? 'border-amber-300 bg-amber-50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                    } ${parsing ? 'cursor-wait' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            {CATEGORY_UI[email.category]?.icon || typeIcons.OTHER}
                          </span>
                          <p className="truncate text-sm font-medium text-slate-800">
                            {email.subject}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 pl-6">
                          {formatFrom(email.from)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {formatEmailDate(email.date)}
                        </span>
                        {parsing && selectedId === email.id && (
                          <Loader2 className="size-3.5 animate-spin text-amber-500" />
                        )}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400 pl-6">
                      {email.snippet}
                    </p>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Footer with count + rescan */}
          {hasSearched && !searching && results.length > 0 && !parsedPreview && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <p className="text-xs text-slate-400">
                {results.length} confirmation{results.length !== 1 ? 's' : ''} found
                {rawResults.length > results.length && (
                  <span className="text-slate-300">
                    {' '}({rawResults.length - results.length} promo{rawResults.length - results.length !== 1 ? 's' : ''} filtered)
                  </span>
                )}
              </p>
              <button
                onClick={handleSearch}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors"
              >
                <RefreshCw className="size-3" /> Rescan
              </button>
            </div>
          )}

          {/* Parsed preview */}
          {parsedPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  Extracted Booking Details
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      confidenceColors[parsedPreview.confidence]
                    }`}
                  >
                    {parsedPreview.confidence} confidence
                  </span>
                  <button
                    onClick={() => {
                      setParsedPreview(null);
                      setSelectedId(null);
                      setError('');
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close preview"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {parsedPreview.type && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm text-slate-600">
                        {typeIcons[parsedPreview.type] || typeIcons.OTHER}
                        <span className="font-medium">
                          {parsedPreview.type.replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                  )}
                  {parsedPreview.provider && (
                    <div className="text-sm">
                      <span className="text-slate-400">Provider: </span>
                      <span className="font-medium text-slate-700">
                        {parsedPreview.provider}
                      </span>
                    </div>
                  )}
                  {parsedPreview.confirmationNum && (
                    <div className="text-sm">
                      <span className="text-slate-400">Confirmation: </span>
                      <span className="font-mono font-medium text-slate-700">
                        {parsedPreview.confirmationNum}
                      </span>
                    </div>
                  )}
                  {(parsedPreview.location || parsedPreview.endLocation) && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-slate-400">Route: </span>
                      <span className="font-medium text-slate-700">
                        {parsedPreview.location || '...'}
                      </span>
                      {parsedPreview.endLocation && (
                        <>
                          <ArrowRight className="size-3 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {parsedPreview.endLocation}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {parsedPreview.startDateTime && (
                    <div className="text-sm">
                      <span className="text-slate-400">Start: </span>
                      <span className="font-medium text-slate-700">
                        {parsedPreview.startDateTime}
                      </span>
                    </div>
                  )}
                  {parsedPreview.endDateTime && (
                    <div className="text-sm">
                      <span className="text-slate-400">End: </span>
                      <span className="font-medium text-slate-700">
                        {parsedPreview.endDateTime}
                      </span>
                    </div>
                  )}
                  {parsedPreview.seat && (
                    <div className="text-sm">
                      <span className="text-slate-400">Seat: </span>
                      <span className="font-medium text-slate-700">
                        {parsedPreview.seat}
                      </span>
                    </div>
                  )}
                </div>

                {parsedPreview.confidence !== 'high' && (
                  <p className="text-xs text-amber-600">
                    Some fields may need manual correction. Review the form after
                    importing.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  Use this data
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsedPreview(null);
                    setSelectedId(null);
                    setError('');
                  }}
                >
                  Back to results
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
