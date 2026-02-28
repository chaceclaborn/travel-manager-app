'use client';

import { useState, useEffect } from 'react';
import { BarChart2, Loader2 } from 'lucide-react';

interface FeatureClick {
  label: string;
  count: number;
}

interface EventsData {
  featureClicks: FeatureClick[];
  frustrationCount: number;
}

export function UsageInsights() {
  const [data, setData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/events', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load usage insights:', err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const top5 = data?.featureClicks.slice(0, 5) ?? [];
  const maxCount = top5.length > 0 ? Math.max(...top5.map((f) => f.count)) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 ring-1 ring-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="size-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-800">Usage Insights</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      ) : !data || top5.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">
          Tracking active &mdash; interact with the app to see data
        </p>
      ) : (
        <div className="space-y-3">
          {top5.map((feature) => (
            <div key={feature.label} className="flex items-center gap-3">
              <span className="text-sm text-slate-700 w-32 truncate shrink-0">
                {feature.label}
              </span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${(feature.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500 w-8 text-right">
                {feature.count}
              </span>
            </div>
          ))}

          {data.frustrationCount > 0 && (
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              {data.frustrationCount} whitespace click{data.frustrationCount !== 1 ? 's' : ''} this month
            </p>
          )}
        </div>
      )}
    </div>
  );
}
