'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sun,
  Cloud,
  Cloudy,
  CloudRain,
  CloudSnow,
  CloudLightning,
  MapPinOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TripWeatherWidgetProps {
  latitude: number | null;
  longitude: number | null;
  destination?: string | null;
}

interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
  timezone?: string;
}

/**
 * Map WMO weather_code (0-99) to a lucide icon component.
 * See: https://open-meteo.com/en/docs#weathervariables
 */
function iconForCode(code: number) {
  if (code <= 1) return Sun;
  if (code <= 3) return Cloud;
  if (code >= 45 && code <= 48) return Cloudy;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return CloudSnow;
  if (code >= 95 && code <= 99) return CloudLightning;
  return Cloud;
}

function labelForCode(code: number): string {
  if (code <= 1) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function formatWeekday(isoDate: string): string {
  // Parse as local date (no TZ shift) by appending midnight.
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function TripWeatherWidget({
  latitude,
  longitude,
  destination,
}: TripWeatherWidgetProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCoords = latitude != null && longitude != null;

  const fetchWeather = useCallback(async () => {
    if (!hasCoords) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/weather?lat=${latitude}&lng=${longitude}`
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as WeatherData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, [hasCoords, latitude, longitude]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Empty state — no coordinates.
  if (!hasCoords) {
    return (
      <div className="h-full rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Weather
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <MapPinOff className="size-8 text-sky-300" />
          <p className="text-sm text-slate-500">
            No location set
          </p>
          <p className="text-xs text-slate-400">
            Add coordinates to see the forecast
          </p>
        </div>
      </div>
    );
  }

  // Loading state.
  if (loading && !data) {
    return (
      <div className="h-full rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Weather
          </h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-14 animate-pulse rounded-full bg-sky-100" />
            <div className="flex-1 space-y-2">
              <div className="h-8 w-24 animate-pulse rounded bg-sky-100" />
              <div className="h-3 w-32 animate-pulse rounded bg-sky-100" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-20 animate-pulse rounded-lg bg-sky-100/70"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state.
  if (error && !data) {
    return (
      <div className="h-full rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
            Weather
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <AlertCircle className="size-6 text-red-400" />
          <p className="text-sm text-slate-600">Couldn&apos;t load forecast</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWeather}
            className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-100"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const CurrentIcon = iconForCode(data.current.weather_code);
  const currentLabel = labelForCode(data.current.weather_code);

  // Take the next 5 days from the daily forecast.
  const days = data.daily.time.slice(0, 5).map((date, i) => ({
    date,
    code: data.daily.weather_code[i],
    high: data.daily.temperature_2m_max[i],
    low: data.daily.temperature_2m_min[i],
  }));

  return (
    <div className="h-full rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
          Weather
        </h3>
        {destination && (
          <span className="truncate text-xs text-slate-500" title={destination}>
            {destination}
          </span>
        )}
      </div>

      {/* Current conditions */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex size-11 items-center justify-center rounded-full bg-white/70 shadow-sm md:size-14">
          <CurrentIcon className="size-6 text-sky-600 md:size-8" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-3xl font-bold text-slate-900">
            {Math.round(data.current.temperature_2m)}
            <span className="text-lg font-medium text-slate-500">&deg;F</span>
          </div>
          <div className="text-xs text-slate-500">{currentLabel}</div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="mt-3.5 grid grid-cols-5 gap-1.5 md:mt-5">
        {days.map((day) => {
          const Icon = iconForCode(day.code);
          return (
            <div
              key={day.date}
              className="flex flex-col items-center gap-0.5 rounded-lg bg-white/60 px-1 py-1.5 text-center md:gap-1 md:py-2"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {formatWeekday(day.date)}
              </span>
              <Icon
                className="size-5 text-sky-600"
                strokeWidth={1.75}
                aria-label={labelForCode(day.code)}
              />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold text-slate-800">
                  {Math.round(day.high)}&deg;
                </span>
                <span className="ml-1 text-slate-400">
                  {Math.round(day.low)}&deg;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
