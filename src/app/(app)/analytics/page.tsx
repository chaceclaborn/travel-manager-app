'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, MapPin, Plane, TrendingUp } from 'lucide-react';
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
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444',
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

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-100 ${className ?? ''}`}>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
          animation: 'shimmer 1.8s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-14 !rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-white border border-slate-100 p-5 space-y-3"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 !rounded-lg" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-white border border-slate-100 p-5 space-y-4"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-[260px] w-full !rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
      className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActivePieIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActivePieIndex(undefined);
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <div className="rounded-xl bg-white border border-slate-100 p-8 text-center">
          <p className="text-slate-500">Failed to load analytics data.</p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Total Spent',
      value: formatCurrency(data.totalSpent),
      icon: DollarSign,
      gradient: 'from-amber-400 to-amber-500',
      bgLight: 'bg-amber-50',
    },
    {
      label: 'Total Trips',
      value: data.totalTrips.toString(),
      icon: Plane,
      gradient: 'from-blue-400 to-blue-500',
      bgLight: 'bg-blue-50',
    },
    {
      label: 'Avg Trip Cost',
      value: formatCurrency(data.averageTripCost),
      icon: TrendingUp,
      gradient: 'from-emerald-400 to-emerald-500',
      bgLight: 'bg-emerald-50',
    },
    {
      label: 'Most Visited',
      value: data.mostVisited || 'N/A',
      icon: MapPin,
      gradient: 'from-purple-400 to-purple-500',
      bgLight: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.h1
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="text-2xl font-bold text-slate-800"
        >
          Analytics
        </motion.h1>

        {/* Pill Toggle Group */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="relative flex gap-1 rounded-full bg-slate-100 p-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                period === p.value
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {period === p.value && (
                <motion.div
                  layoutId="period-pill"
                  className="absolute inset-0 rounded-full bg-amber-500 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{p.label}</span>
            </button>
          ))}
        </motion.div>
      </div>

      {/* Summary Cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
      >
        {summaryCards.map((card) => (
          <motion.div
            key={card.label}
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.97 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -3, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.08)' }}
            className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm cursor-default transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-9 rounded-lg bg-gradient-to-br ${card.gradient} shadow-sm`}>
                <card.icon className="size-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-sm text-slate-500 font-medium">{card.label}</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-800 truncate tracking-tight">
              {card.value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Spending by Category - Donut ── */}
        <ChartCard title="Spending by Category" index={0}>
          {data.spendingByCategory.length > 0 ? (
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
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={2}
                  animationBegin={100}
                  animationDuration={900}
                  animationEasing="ease-out"
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  label={({ name, percent, cx: labelCx, cy: labelCy, midAngle, outerRadius: or }) => {
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
                  }}
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
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No expense data yet
            </div>
          )}
        </ChartCard>

        {/* ── Monthly Trip Count - Bar ── */}
        <ChartCard title="Monthly Trip Count" index={1}>
          {data.tripsByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.tripsByMonth} barCategoryGap="20%">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
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
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No trip data yet
            </div>
          )}
        </ChartCard>

        {/* ── Top Destinations - Horizontal Bar ── */}
        <ChartCard title="Top Destinations" index={2}>
          {data.topDestinations.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.topDestinations} layout="vertical" barCategoryGap="25%">
                <defs>
                  <linearGradient id="hBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
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
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No destination data yet
            </div>
          )}
        </ChartCard>

        {/* ── Travel Days by Quarter - Area ── */}
        <ChartCard title="Travel Days by Quarter" index={3}>
          {data.travelDaysByQuarter.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.travelDaysByQuarter}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
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
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No travel day data yet
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
