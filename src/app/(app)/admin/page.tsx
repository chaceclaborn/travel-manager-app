'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Users,
  MapPin,
  Plane,
  Building2,
  UserCheck,
  HardDrive,
  FileText,
  Lock,
  BarChart2,
  MousePointerClick,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PLANNED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

interface AdminData {
  overview: {
    totalUsers: number;
    totalTrips: number;
    totalBookings: number;
    totalVendors: number;
    totalClients: number;
  };
  signInActivity: { date: string; count: number }[];
  tripStatusBreakdown: { status: string; count: number }[];
  storageSummary: {
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
}

interface UsageInsightsData {
  topFeatures: { label: string; count: number }[];
  frustrationHotspots: { page: string; count: number }[];
  summary: {
    totalFeatureClicks: number;
    totalFrustrationClicks: number;
    activeUsers: number;
  };
  dailyActivity: { date: string; count: number }[];
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
}

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900 px-3.5 py-2.5 shadow-xl shadow-black/20 border border-slate-700/50">
      {label && (
        <p className="text-xs font-medium text-slate-300 mb-1.5">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color || '#f59e0b' }}
          />
          <span className="text-white font-semibold">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [usageData, setUsageData] = useState<UsageInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/analytics').then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        if (!res.ok) throw new Error('Failed');
        return res.json();
      }),
      fetch('/api/admin/usage-insights').then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      }),
    ])
      .then(([adminData, usage]) => {
        if (adminData) setData(adminData);
        if (usage) setUsageData(usage);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg bg-slate-100 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-white border border-slate-100 p-5 space-y-3"
            >
              <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
              <div className="h-7 w-28 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="flex items-center justify-center size-16 rounded-full bg-red-50">
          <Lock className="size-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-slate-500 text-center max-w-md">
          You do not have permission to view this page. Admin access is
          restricted.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <div className="rounded-xl bg-white border border-slate-100 p-8 text-center">
          <p className="text-slate-500">Failed to load admin analytics.</p>
        </div>
      </div>
    );
  }

  const overviewCards = [
    {
      label: 'Total Users',
      value: data.overview.totalUsers.toString(),
      icon: Users,
      gradient: 'from-blue-400 to-blue-500',
    },
    {
      label: 'Total Trips',
      value: data.overview.totalTrips.toString(),
      icon: MapPin,
      gradient: 'from-amber-400 to-amber-500',
    },
    {
      label: 'Total Bookings',
      value: data.overview.totalBookings.toString(),
      icon: Plane,
      gradient: 'from-emerald-400 to-emerald-500',
    },
    {
      label: 'Total Vendors',
      value: data.overview.totalVendors.toString(),
      icon: Building2,
      gradient: 'from-purple-400 to-purple-500',
    },
    {
      label: 'Total Clients',
      value: data.overview.totalClients.toString(),
      icon: UserCheck,
      gradient: 'from-pink-400 to-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm"
        >
          <ShieldAlert className="size-4" />
          ADMIN
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="text-2xl font-bold text-slate-800"
        >
          Admin Dashboard
        </motion.h1>
      </div>

      {/* Platform Overview */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {overviewCards.map((card) => (
          <motion.div
            key={card.label}
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.97 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center size-9 rounded-lg bg-gradient-to-br ${card.gradient} shadow-sm`}
              >
                <card.icon className="size-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-sm text-slate-500 font-medium">
                {card.label}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-800 tracking-tight">
              {card.value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sign-in Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Sign-in Activity (Last 30 Days)
          </h2>
          {data.signInActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.signInActivity} barCategoryGap="15%">
                <defs>
                  <linearGradient
                    id="signInGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
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
                      formatter={(v) =>
                        `${v} sign-in${v !== 1 ? 's' : ''}`
                      }
                    />
                  }
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#signInGradient)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No sign-in data in the last 30 days
            </div>
          )}
        </motion.div>

        {/* Trip Status Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Trip Status Breakdown
          </h2>
          {data.tripStatusBreakdown.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.tripStatusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    animationDuration={900}
                  >
                    {data.tripStatusBreakdown.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || '#6b7280'}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={
                      <CustomTooltip
                        formatter={(v) =>
                          `${v} trip${v !== 1 ? 's' : ''}`
                        }
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {data.tripStatusBreakdown.map((entry) => (
                  <div
                    key={entry.status}
                    className="flex items-center gap-1.5 text-xs text-slate-500"
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          STATUS_COLORS[entry.status] || '#6b7280',
                      }}
                    />
                    <span>
                      {formatStatus(entry.status)} ({entry.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              No trip data yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Storage Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35 }}
        className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Storage & Data Usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 shadow-sm">
              <FileText className="size-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Files</p>
              <p className="text-lg font-bold text-slate-800">
                {data.storageSummary.totalFiles}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-sm">
              <HardDrive className="size-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Storage Used</p>
              <p className="text-lg font-bold text-slate-800">
                {data.storageSummary.totalSizeMB} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-500 shadow-sm">
              <Users className="size-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Registered Users</p>
              <p className="text-lg font-bold text-slate-800">
                {data.overview.totalUsers}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Usage Insights Section */}
      {usageData && (
        <>
          {/* Usage Insights Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.4 }}
            className="flex items-center gap-2 pt-2"
          >
            <BarChart2 className="size-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-800">
              Usage Insights
            </h2>
            <span className="text-xs text-slate-400 ml-1">Last 30 days</span>
          </motion.div>

          {/* Usage Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.45 }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm">
                  <MousePointerClick className="size-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  Feature Interactions
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-800 tracking-tight">
                {usageData.summary.totalFeatureClicks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 shadow-sm">
                  <AlertTriangle className="size-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  Frustration Clicks
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-800 tracking-tight">
                {usageData.summary.totalFrustrationClicks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-500 shadow-sm">
                  <Activity className="size-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  Active Users
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-800 tracking-tight">
                {usageData.summary.activeUsers}
              </p>
            </div>
          </motion.div>

          {/* Usage Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily Engagement Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.5 }}
              className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Daily Feature Engagement
              </h2>
              {usageData.dailyActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={usageData.dailyActivity}>
                    <defs>
                      <linearGradient
                        id="engagementGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
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
                          formatter={(v) =>
                            `${v} interaction${v !== 1 ? 's' : ''}`
                          }
                        />
                      }
                      cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#engagementGradient)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
                  No engagement data in the last 30 days
                </div>
              )}
            </motion.div>

            {/* Top Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.55 }}
              className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Most Used Features
              </h2>
              {usageData.topFeatures.length > 0 ? (
                <div className="space-y-3">
                  {usageData.topFeatures.map((feature, i) => {
                    const maxCount = usageData.topFeatures[0].count;
                    return (
                      <div key={feature.label} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-400 w-5 text-right shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 w-36 truncate shrink-0" title={feature.label}>
                          {feature.label}
                        </span>
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(feature.count / maxCount) * 100}%` }}
                            transition={{ duration: 0.6, delay: 0.55 + i * 0.05 }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-10 text-right tabular-nums">
                          {feature.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
                  No feature usage data yet
                </div>
              )}
            </motion.div>
          </div>

          {/* Frustration Hotspots */}
          {usageData.frustrationHotspots.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.6 }}
              className="rounded-xl bg-white border border-slate-100 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="size-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Frustration Hotspots
                </h2>
                <span className="text-xs text-slate-400">
                  Pages with the most whitespace clicks
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {usageData.frustrationHotspots.map((hotspot) => (
                  <div
                    key={hotspot.page}
                    className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50/50 px-4 py-3"
                  >
                    <span className="text-sm text-slate-700 truncate mr-3" title={hotspot.page}>
                      {hotspot.page || '/'}
                    </span>
                    <span className="text-sm font-semibold text-orange-600 shrink-0">
                      {hotspot.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                High frustration click counts may indicate confusing navigation or missing interactive elements on those pages.
              </p>
            </motion.div>
          )}
        </>
      )}

    </div>
  );
}
