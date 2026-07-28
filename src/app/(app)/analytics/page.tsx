'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TMStatStrip, type TMStat } from '@/components/travelmanager/TMStatsCard';
import { TMErrorState, TMStatStripSkeleton, TMSkeleton } from '@/components/travelmanager/TMEmptyState';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

/* ───────────────────────── Color Palette ───────────────────────── */

const PIE_COLORS = [
  '#0F172A', '#F59E0B', '#94A3B8', '#CBD5E1', '#E4E8EE',
  // Retained tail for datasets with more categories than the design's five.
  '#3b82f6', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6b7280',
];

const PERIODS = [
  { value: '3months', label: '3M' },
  { value: '6months', label: '6M' },
  { value: '1year', label: '1Y' },
  { value: 'all', label: 'All' },
];

/* ───────────────────────── Types ───────────────────────── */

interface AnalyticsData {
  commissionsByMonth: { month: string; paid: number; pending: number }[];
  commissionTotal: number;
  commissionPending: number;
  spendingByCategory: { category: string; total: number }[];
  tripsByMonth: { month: string; count: number }[];
  topDestinations: { destination: string; count: number }[];
  travelDaysByQuarter: { quarter: string; days: number }[];
  totalSpent: number;
  totalTrips: number;
  averageTripCost: number;
  mostVisited: string | null;
}

/* ───────────────────────── Helpers ───────────────────────── */

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCategory(cat: string) {
  return cat.charAt(0) + cat.slice(1).toLowerCase().replace('_', ' ');
}

/* ───────────────────────── Custom Tooltip ───────────────────────── */

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(String(label ?? '')) : label;

  return (
    <div className="rounded-lg bg-slate-900 px-3.5 py-2.5 shadow-xl shadow-black/20 border border-slate-700/50">
      {displayLabel && (
        <p className="text-xs font-medium text-slate-300 mb-1.5">{displayLabel}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color || '#f59e0b' }}
          />
          <span className="text-white font-semibold">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Custom Legend ───────────────────────── */

function CustomLegend({
  payload,
  labelFormatter,
}: {
  payload?: Array<{ value: string; color: string }>;
  labelFormatter?: (value: string) => string;
}) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3 px-2">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{labelFormatter ? labelFormatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Shimmer Skeleton ───────────────────────── */



/* ───────────────────────── Chart Card Wrapper ───────────────────────── */

function ChartCard({
  title,
  children,
  index = 0,
}: {
  title: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 + index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="tm-card px-6 py-[22px]"
    >
      <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">{title}</h2>
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState('all');
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport for responsive donut sizing
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch analytics whenever the period changes. The fetch is inlined in
  // the effect (rather than a useCallback called from the effect) so the
  // synchronous setLoading/setError happen off the effect body via the
  // async function — keeps React 19's set-state-in-effect rule happy.
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        if (!res.ok) throw new Error('Request failed');
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) {
          setData(null);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActivePieIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActivePieIndex(undefined);
  }, []);

  if (loading) {
    return (
      <TMPageShell width={1120}>
        <TMScreenHeader title="Analytics" />
        <div className="pt-5 md:pt-7">
          <TMStatStripSkeleton cells={4} />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <TMSkeleton key={i} className="h-[300px] w-full" style={{ borderRadius: 14 }} />
            ))}
          </div>
        </div>
      </TMPageShell>
    );
  }

  if (error || !data) {
    return (
      <TMPageShell width={1120}>
        <TMScreenHeader title="Analytics" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load your analytics"
            description="Something went wrong on our end. Your data is safe — nothing was lost."
            onRetry={refetch}
          />
        </div>
      </TMPageShell>
    );
  }

  // One divided strip instead of four gradient tiles: these are four readings
  // of the same instrument, not four unrelated facts.
  const stats: TMStat[] = [
    { label: 'Total spent', value: formatCurrency(data.totalSpent) },
    { label: 'Trips taken', value: data.totalTrips.toString() },
    { label: 'Avg trip cost', value: formatCurrency(data.averageTripCost) },
    { label: 'Most visited', value: data.mostVisited || '—' },
  ];

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title="Analytics"
        subtitle={`${data.totalTrips} ${data.totalTrips === 1 ? 'trip' : 'trips'} · ${formatCurrency(data.totalSpent)} tracked`}
        actions={
          <div className="tm-seg" role="radiogroup" aria-label="Time period">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={period === p.value}
                data-selected={period === p.value}
                onClick={() => setPeriod(p.value)}
                className="tm-seg-item"
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* On a phone the segmented control moves below the title — it's too
          wide to share a row with a 24px heading at 402px. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-4 md:hidden">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            data-selected={period === p.value}
            onClick={() => setPeriod(p.value)}
            className="tm-pill"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="pt-4 md:pt-7">
        <TMStatStrip stats={stats} />
      </div>

      {/* Charts Grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* ── Spending by Category - Donut ── */}
        <ChartCard title="Spending by Category" index={0}>
          {data.spendingByCategory.length > 0 ? (
            <div role="img" aria-label="Expenses by category donut chart" className="[&_svg]:focus:outline-none [&_.recharts-wrapper_svg]:outline-none">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <defs>
                  {PIE_COLORS.map((color, i) => (
                    <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={data.spendingByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 40 : 55}
                  outerRadius={isMobile ? 70 : 100}
                  paddingAngle={2}
                  animationBegin={100}
                  animationDuration={900}
                  animationEasing="ease-out"
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  label={
                    isMobile
                      ? false
                      : ({ name, percent, cx: labelCx, cy: labelCy, midAngle, outerRadius: or }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = (or as number) + 20;
                          const angle = (midAngle as number) ?? 0;
                          const x = (labelCx as number) + radius * Math.cos(-angle * RADIAN);
                          const y = (labelCy as number) + radius * Math.sin(-angle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#64748b"
                              textAnchor={x > (labelCx as number) ? 'start' : 'end'}
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={500}
                            >
                              {`${formatCategory(String(name ?? ''))} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            </text>
                          );
                        }
                  }
                >
                  {data.spendingByCategory.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`url(#pie-grad-${i % PIE_COLORS.length})`}
                      stroke="white"
                      strokeWidth={2}
                      style={{
                        filter: activePieIndex === i ? 'brightness(1.1)' : undefined,
                        transform: activePieIndex === i ? 'scale(1.03)' : undefined,
                        transformOrigin: 'center',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => formatCategory(String(label))}
                    />
                  }
                />
                <Legend
                  content={
                    <CustomLegend labelFormatter={(v) => formatCategory(String(v))} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No expense data yet
            </div>
          )}
        </ChartCard>

        {/* ── Monthly Trip Count - Bar ── */}
        <ChartCard title="Monthly Trip Count" index={1}>
          {data.tripsByMonth.length > 0 ? (
            <div role="img" aria-label="Trips per month bar chart" className="[&_svg]:focus:outline-none [&_.recharts-wrapper_svg]:outline-none">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.tripsByMonth} barCategoryGap="20%">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#A6AEBC' }}
                  axisLine={{ stroke: '#E9EDF2' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#A6AEBC' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(value) => `${value} trip${value !== 1 ? 's' : ''}`}
                    />
                  }
                  cursor={{ fill: 'rgba(245, 158, 11, 0.06)' }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  animationBegin={200}
                  animationDuration={800}
                  animationEasing="ease-out"
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No trip data yet
            </div>
          )}
        </ChartCard>

        {/* ── Top Destinations - Horizontal Bar ── */}
        <ChartCard title="Top Destinations" index={2}>
          {data.topDestinations.length > 0 ? (
            <div role="img" aria-label="Top destinations horizontal bar chart" className="[&_svg]:focus:outline-none [&_.recharts-wrapper_svg]:outline-none">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.topDestinations} layout="vertical" barCategoryGap="25%">
                <defs>
                  <linearGradient id="hBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#A6AEBC' }}
                  axisLine={{ stroke: '#E9EDF2' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="destination"
                  width={120}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(value) => `${value} visit${value !== 1 ? 's' : ''}`}
                    />
                  }
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#hBarGradient)"
                  radius={[0, 6, 6, 0]}
                  animationBegin={300}
                  animationDuration={800}
                  animationEasing="ease-out"
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No destination data yet
            </div>
          )}
        </ChartCard>

        {/* ── Travel Days by Quarter - Area ── */}
        <ChartCard title="Travel Days by Quarter" index={3}>
          {data.travelDaysByQuarter.length > 0 ? (
            <div role="img" aria-label="Travel days per quarter area chart" className="[&_svg]:focus:outline-none [&_.recharts-wrapper_svg]:outline-none">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.travelDaysByQuarter}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 11, fill: '#A6AEBC' }}
                  axisLine={{ stroke: '#E9EDF2' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#A6AEBC' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(value) => `${value} day${value !== 1 ? 's' : ''}`}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="days"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#areaGradient)"
                  dot={{
                    r: 4,
                    fill: '#ffffff',
                    stroke: '#f59e0b',
                    strokeWidth: 2.5,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#f59e0b',
                    stroke: '#ffffff',
                    strokeWidth: 2.5,
                    style: { filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.4))' },
                  }}
                  animationBegin={400}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No travel day data yet
            </div>
          )}
        </ChartCard>

        {/* ── Commissions by Month - Stacked Bar ── */}
        <ChartCard title="Commissions" index={4}>
          {data.commissionsByMonth.length > 0 ? (
            <>
              <div className="mb-4 flex gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Earned</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(data.commissionTotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending payout</p>
                  <p className="text-[20px] font-semibold text-tm-accent-text">{formatCurrency(data.commissionPending)}</p>
                </div>
              </div>
              <div role="img" aria-label="Commissions per month stacked bar chart" className="[&_svg]:focus:outline-none [&_.recharts-wrapper_svg]:outline-none">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.commissionsByMonth} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="commissionPaidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <linearGradient id="commissionPendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D1FAE5" />
                      <stop offset="100%" stopColor="#A7F3D0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#A6AEBC' }}
                    axisLine={{ stroke: '#E9EDF2' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#A6AEBC' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatCurrency(v)}
                  />
                  <RechartsTooltip
                    content={
                      <CustomTooltip
                        formatter={(value, name) =>
                          `${formatCurrency(value)} ${name === 'paid' ? 'paid' : 'pending'}`
                        }
                      />
                    }
                    cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }}
                  />
                  <Legend
                    content={<CustomLegend labelFormatter={(v) => (v === 'paid' ? 'Paid' : 'Pending')} />}
                  />
                  <Bar
                    dataKey="paid"
                    stackId="commission"
                    fill="url(#commissionPaidGradient)"
                    animationBegin={200}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="pending"
                    stackId="commission"
                    fill="url(#commissionPendingGradient)"
                    radius={[6, 6, 0, 0]}
                    animationBegin={200}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex h-[280px] flex-col items-center justify-center gap-1 text-center text-sm text-slate-400">
              <p>No commission data yet</p>
              <p className="text-xs">Add a commission amount to a booking to start tracking payouts.</p>
            </div>
          )}
        </ChartCard>
      </div>
    </TMPageShell>
  );
}
