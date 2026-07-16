'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ArrowLeftRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COMMON_CURRENCIES,
  fetchRates,
  convert,
  formatCurrency,
  guessLocalCurrency,
} from '@/lib/currency';

export function CurrencyConverter() {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState<string>(() => guessLocalCurrency());
  const [to, setTo] = useState<string>('EUR');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Nudge the default "To" off of "From" on first mount so the swap makes
  // sense when the user's local currency happens to be EUR.
  useEffect(() => {
    if (from === to) setTo(from === 'USD' ? 'EUR' : 'USD');
    // Intentionally only on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchRates(from);
      setRates(result.rates);
      setRateDate(result.date);
    } catch {
      setError(true);
      setRates(null);
    } finally {
      setLoading(false);
    }
  }, [from]);

  useEffect(() => {
    load();
  }, [load]);

  const converted = useMemo(() => {
    if (!rates) return null;
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    const result = convert(n, from, to, rates);
    return Number.isFinite(result) ? result : null;
  }, [amount, from, to, rates]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="rounded-2xl border border-[#eef2f6] bg-white p-[22px] shadow-card">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Currency Converter</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Quick conversion for international trip planning. Rates via ECB (Frankfurter).
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin text-amber-500" />
          Loading latest rates...
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>Rates service unavailable</span>
          <button
            type="button"
            onClick={load}
            className="ml-auto inline-flex items-center gap-1 text-xs underline hover:text-red-900"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] sm:items-end">
            <div>
              <Label className="mb-1 text-xs text-slate-600">Amount</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount to convert"
              />
            </div>
            <div>
              <Label className="mb-1 text-xs text-slate-600">From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger aria-label="From currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {COMMON_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-center pb-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={swap}
                aria-label="Swap currencies"
                title="Swap currencies"
              >
                <ArrowLeftRight className="size-4" />
              </Button>
            </div>
            <div>
              <Label className="mb-1 text-xs text-slate-600">To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger aria-label="To currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {COMMON_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-right">
              <Label className="mb-1 block text-xs text-slate-600">Converted</Label>
              <div className="text-xl font-semibold text-slate-800 tabular-nums">
                {converted !== null ? formatCurrency(converted, to) : '—'}
              </div>
            </div>
          </div>
          {rateDate && (
            <p className="mt-3 text-xs text-slate-400">Rates as of {rateDate}</p>
          )}
        </>
      )}
    </div>
  );
}
