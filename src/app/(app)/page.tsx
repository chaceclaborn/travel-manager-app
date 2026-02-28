'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Building2, Users, Plus, ArrowRight, Clock, Plane, DollarSign, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TMStatsCard } from '@/components/travelmanager/TMStatsCard';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { TMCalendarPreview } from '@/components/travelmanager/TMCalendarPreview';
import { UsageInsights } from '@/components/travelmanager/UsageInsights';
import { useAuth } from '@/lib/travelmanager/useAuth';
import type { TripWithRelations } from '@/lib/travelmanager/types';

interface DashboardData {
  stats: {
    totalTrips: number;
    upcomingTrips: number;
    totalVendors: number;
    totalClients: number;
  };
  upcoming: TripWithRelations[];
  recent: TripWithRelations[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, ease: 'easeOut' as const },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const statsContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const statsItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const sectionCardHover = {
  y: -3,
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -5px rgba(0, 0, 0, 0.04)',
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-slate-200/70 rounded-md ${className ?? ''}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div>
        <SkeletonPulse className="h-8 w-56 rounded-lg" />
        <SkeletonPulse className="h-4 w-72 mt-2" />
      </div>

      {/* Stats cards skeleton — mirrors TMStatsCard layout */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm"
          >
            <SkeletonPulse className="size-12 !rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="h-7 w-10" />
              <SkeletonPulse className="h-3.5 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Calendar skeleton — mirrors calendar grid shape */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SkeletonPulse className="h-5 w-20" />
          <div className="flex items-center gap-2">
            <SkeletonPulse className="size-6 !rounded-md" />
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="size-6 !rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonPulse key={`header-${i}`} className="h-4 mx-2 mb-2" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonPulse key={`cell-${i}`} className="min-h-[4rem] !rounded-lg mx-0.5 mb-0.5" />
          ))}
        </div>
      </div>

      {/* Two-column section skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <SkeletonPulse className="h-5 w-28" />
              <SkeletonPulse className="h-4 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50">
                  <div className="flex-1 space-y-2">
                    <SkeletonPulse className="h-4 w-3/4" />
                    <SkeletonPulse className="h-3 w-1/2" />
                    <div className="flex gap-3">
                      <SkeletonPulse className="h-3 w-14" />
                      <SkeletonPulse className="h-3 w-16" />
                    </div>
                  </div>
                  <SkeletonPulse className="h-5 w-16 !rounded-full ml-3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TravelManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/dashboard', { signal: controller.signal });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    return () => abortRef.current?.abort();
  }, [fetchDashboard]);


  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="relative mb-6">
          <div className="size-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="size-10 text-red-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-red-100 flex items-center justify-center">
            <RefreshCw className="size-3.5 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Unable to load dashboard</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          {error}. Check your connection and try again.
        </p>
        <Button
          onClick={fetchDashboard}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
        >
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      </motion.div>
    );
  }

  const stats = data?.stats ?? { totalTrips: 0, upcomingTrips: 0, totalVendors: 0, totalClients: 0 };
  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];

  const hour = new Date().getHours();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';
  const greeting = (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + (firstName ? `, ${firstName}` : '');
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const daysUntilNext = upcoming.length > 0 && upcoming[0].startDate
    ? Math.max(0, Math.ceil((new Date(upcoming[0].startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const calendarTrips = [...upcoming, ...recent].reduce<TripWithRelations[]>((acc, trip) => {
    if (!acc.find((t) => t.id === trip.id)) acc.push(trip);
    return acc;
  }, []);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Welcome Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">{greeting}</h1>
          <Sparkles className="size-5 text-amber-400" />
        </div>
        <p className="text-sm text-slate-500 mt-1">{dateStr}</p>
      </motion.div>

      {/* Stats Grid — staggered card entrance */}
      <motion.div
        variants={statsContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <motion.div variants={statsItem}>
          <TMStatsCard title="Total Trips" value={stats.totalTrips} icon={MapPin} color="blue" href="/trips" />
        </motion.div>
        <motion.div variants={statsItem}>
          <TMStatsCard title="Upcoming" value={stats.upcomingTrips} icon={Calendar} color="amber" href="/trips?status=UPCOMING" />
        </motion.div>
        <motion.div variants={statsItem}>
          <TMStatsCard title="Vendors" value={stats.totalVendors} icon={Building2} color="purple" href="/vendors" />
        </motion.div>
        <motion.div variants={statsItem}>
          <TMStatsCard title="Clients" value={stats.totalClients} icon={Users} color="green" href="/clients" />
        </motion.div>
        {daysUntilNext !== null && (
          <motion.div variants={statsItem}>
            <TMStatsCard title="Days to Next Trip" value={daysUntilNext} icon={Plane} color="red" href={upcoming[0] ? `/trips/${upcoming[0].id}` : '/trips'} />
          </motion.div>
        )}
      </motion.div>

      {/* Calendar Preview */}
      <motion.div variants={item}>
        <TMCalendarPreview
          trips={calendarTrips
            .filter((t) => t.startDate && t.endDate)
            .map((t) => ({
              id: t.id,
              title: t.title,
              destination: t.destination,
              startDate: t.startDate as unknown as string,
              endDate: t.endDate as unknown as string,
              status: t.status,
            }))}
        />
      </motion.div>

      {/* Usage Insights */}
      <motion.div variants={item}>
        <UsageInsights />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link href="/trips/new">
              <Plus className="size-4 mr-2" />
              New Trip
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/vendors/new">
              <Plus className="size-4 mr-2" />
              New Vendor
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/clients/new">
              <Plus className="size-4 mr-2" />
              New Client
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Two-column layout for upcoming + recent */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Trips */}
        <motion.div
          variants={item}
          whileHover={sectionCardHover}
          className="rounded-xl bg-white p-6 shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-amber-400" />
              <h2 className="text-lg font-semibold text-slate-800">Upcoming Trips</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
              <Link href="/trips">
                View all <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <TMEmptyState
              title="No upcoming trips"
              description="Plan your next adventure"
              actionLabel="Create Trip"
              actionHref="/trips/new"
              icon={MapPin}
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                      {trip.destination}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.startDate && trip.endDate
                        ? `${formatDate(trip.startDate as unknown as string)} -- ${formatDate(trip.endDate as unknown as string)}`
                        : 'Dates not set'}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {trip.budget != null && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
                          <DollarSign className="size-3" />
                          {trip.budget.toLocaleString()}
                        </span>
                      )}
                      {trip.vendors.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
                          <Building2 className="size-3" />
                          {trip.vendors.length} vendor{trip.vendors.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <TMStatusBadge status={trip.status} />
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={item}
          whileHover={sectionCardHover}
          className="rounded-xl bg-white p-6 shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-slate-400" />
              <h2 className="text-lg font-semibold text-slate-800">Recent Activity</h2>
            </div>
            <Clock className="size-4 text-slate-400" />
          </div>
          {recent.length === 0 ? (
            <TMEmptyState
              title="No recent activity"
              description="Your recent trip updates will appear here"
              icon={Clock}
            />
          ) : (
            <div className="space-y-3">
              {recent.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                      {trip.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.destination} &middot; Updated {formatDate(trip.updatedAt as unknown as string)}
                    </p>
                  </div>
                  <TMStatusBadge status={trip.status} />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
