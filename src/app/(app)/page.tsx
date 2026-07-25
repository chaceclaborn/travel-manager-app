'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Plus, CalendarDays, DollarSign, Building2, AlertCircle, RefreshCw, ListChecks } from 'lucide-react';
import { detailHref } from '@/lib/travelmanager/detail-routes';
import { TMStatStrip, type TMStat } from '@/components/travelmanager/TMStatsCard';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import {
  TMEmptyState,
  TMErrorState,
  TMStatStripSkeleton,
  TMSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMCalendarPreview } from '@/components/travelmanager/TMCalendarPreview';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TMCodeTile, TMCard, TMCardHeader, TMTimeline } from '@/components/travelmanager/TMPrimitives';
import { TripTemplateCard } from '@/components/travelmanager/TripTemplateCard';
import { TRIP_TEMPLATES } from '@/lib/travelmanager/templates';
import { statusPalette, tripCode } from '@/lib/travelmanager/design';
import { formatDate } from '@/lib/date-utils';
import { useAuth } from '@/lib/travelmanager/useAuth';
import type { TripWithRelations } from '@/lib/travelmanager/types';

interface DashboardData {
  stats: {
    totalTrips: number;
    upcomingTrips: number;
    totalVendors: number;
    totalClients: number;
    totalMeetings: number;
    totalBookings: number;
    pendingCommissions: number;
  };
  upcoming: TripWithRelations[];
  recent: TripWithRelations[];
}

interface CalendarMeeting {
  id: string;
  title: string;
  startDateTime: string;
}

/* ------------------------------------------------------------------- hero */

/**
 * "Up next" — the dark hero.
 *
 * This used to be a stat card reading "Days to Next Trip: 5", carrying the
 * same visual weight as "Vendors: 12". It is the single most useful fact on
 * the page, so it now gets the width, the countdown at 44px, and the two
 * actions a person actually wants from it.
 */
function UpNextHero({ trip }: { trip: TripWithRelations }) {
  // Pinned at mount rather than read during render: the countdown must not
  // change value just because a sibling re-rendered.
  const [now] = useState(() => Date.now());
  const start = trip.startDate ? new Date(trip.startDate as unknown as string) : null;
  const end = trip.endDate ? new Date(trip.endDate as unknown as string) : null;
  const days = start ? Math.max(0, Math.ceil((start.getTime() - now) / 86_400_000)) : null;
  const checklists = trip.checklists ?? [];
  const done = checklists.filter((c) => c.checked).length;
  const confirmedVendors = trip.vendors.length;

  return (
    <section className="tm-hero px-5 py-5 text-white md:px-8 md:py-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-tm-accent-hover">Up next</span>
            <TMStatusBadge status={trip.status} variant="pill" className="!bg-white/10 !text-[#93C5FD]" />
          </div>

          <h2 className="mt-2.5 truncate text-[22px] font-semibold tracking-[-0.02em] md:text-[26px]">
            {trip.destination || trip.title}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-tm-nav-text">
            {start && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {formatDate(start.toISOString())}
                {end ? ` – ${formatDate(end.toISOString())}` : ''}
              </span>
            )}
            {trip.budget != null && (
              <span className="inline-flex items-center gap-1.5 tm-nums">
                <DollarSign className="size-3.5" aria-hidden="true" />
                {Number(trip.budget).toLocaleString('en-US')} budget
              </span>
            )}
            {confirmedVendors > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden="true" />
                {confirmedVendors} vendor{confirmedVendors === 1 ? '' : 's'} confirmed
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={detailHref('trips', trip.id)} className="tm-btn tm-btn-accent">
              View itinerary
            </Link>
            {checklists.length > 0 && (
              <Link href={detailHref('trips', trip.id)} className="tm-btn tm-btn-ghost-dark">
                <ListChecks className="size-3.5" aria-hidden="true" />
                Checklist · {done} of {checklists.length}
              </Link>
            )}
          </div>
        </div>

        {days !== null && (
          <div className="shrink-0 text-left md:text-right">
            <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] tm-nums md:text-[44px]">{days}</p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-tm-nav-meta">
              {days === 1 ? 'Day to departure' : 'Days to departure'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- lists */

function UpcomingTrips({ trips }: { trips: TripWithRelations[] }) {
  return (
    <TMCard>
      <TMCardHeader
        title="Upcoming trips"
        action={
          <Link href="/trips" className="text-[12px] font-medium text-tm-accent-text hover:text-tm-accent-text-hover">
            View all
          </Link>
        }
      />
      {trips.length === 0 ? (
        <TMEmptyState
          title="No upcoming trips"
          description="Trips hold your itinerary, bookings, budget, and the people travelling with you."
          actionLabel="New Trip"
          actionHref="/trips/new"
          icon={MapPin}
        />
      ) : (
        <div className="mt-3">
          {trips.map((trip, i) => (
            <div key={trip.id}>
              {i > 0 && <div className="h-px bg-tm-divider" />}
              <Link
                href={detailHref('trips', trip.id)}
                className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-[11px] hover:bg-tm-wash"
              >
                {/* The next trip's tile inverts — one anchor per list, not five. */}
                <TMCodeTile code={tripCode(trip.destination, trip.title)} highlight={i === 0} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-tm-ink">{trip.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-tm-subtle tm-nums">
                    {trip.startDate && trip.endDate
                      ? `${formatDate(trip.startDate as unknown as string)} – ${formatDate(trip.endDate as unknown as string)}`
                      : 'Dates not set'}
                    {trip.budget != null && ` · $${Number(trip.budget).toLocaleString('en-US')}`}
                  </p>
                </div>
                <TMStatusBadge status={trip.status} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </TMCard>
  );
}

/**
 * Recent activity as a timeline.
 *
 * Each entry says what happened rather than showing a status pill — "Napa
 * Valley Tasting completed" reads as an event; a green "Completed" chip next
 * to a name reads as a filter result.
 */
function RecentActivity({ trips }: { trips: TripWithRelations[] }) {
  const items = trips.map((trip) => {
    const palette = statusPalette(trip.status);
    const verb =
      trip.status === 'IN_PROGRESS' ? 'is in progress'
      : trip.status === 'COMPLETED' ? 'completed'
      : trip.status === 'CANCELLED' ? 'was cancelled'
      : trip.status === 'PLANNED' ? 'is planned'
      : 'was drafted';

    return {
      id: trip.id,
      color: palette.dot,
      pulse: trip.status === 'IN_PROGRESS',
      body: (
        <>
          <Link href={detailHref('trips', trip.id)} className="font-medium text-tm-ink hover:underline">
            {trip.title}
          </Link>{' '}
          {verb}
        </>
      ),
      meta: (
        <>
          {trip.destination ? `${trip.destination} · ` : ''}
          Updated {formatDate(trip.updatedAt as unknown as string)}
        </>
      ),
    };
  });

  return (
    <TMCard>
      <TMCardHeader title="Recent activity" />
      <div className="mt-4">
        {items.length === 0 ? (
          <TMEmptyState
            title="No recent activity"
            description="Updates to your trips will appear here as they happen."
            icon={CalendarDays}
          />
        ) : (
          <TMTimeline items={items} />
        )}
      </div>
    </TMCard>
  );
}

/* ------------------------------------------------------------- skeleton */

function DashboardSkeleton() {
  return (
    <TMPageShell width={1120}>
      <TMScreenHeader title="Loading…" />
      <div className="flex flex-col gap-6 pt-5 md:pt-7">
        <TMSkeleton className="h-[168px] w-full" style={{ borderRadius: 16 }} />
        <TMStatStripSkeleton cells={5} />
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <TMSkeleton className="h-[420px] w-full" style={{ borderRadius: 14 }} />
          <div className="flex flex-col gap-5">
            <TMSkeleton className="h-[200px] w-full" style={{ borderRadius: 14 }} />
            <TMSkeleton className="h-[200px] w-full" style={{ borderRadius: 14 }} />
          </div>
        </div>
      </div>
    </TMPageShell>
  );
}

/* ------------------------------------------------------------------ page */

export default function TravelManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [meetingsError, setMeetingsError] = useState(false);
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

  // Same abort discipline as fetchDashboard — without it, navigating away
  // mid-request fires setState on an unmounted page.
  const meetingsAbortRef = useRef<AbortController | null>(null);
  const fetchMeetings = useCallback(async () => {
    if (meetingsAbortRef.current) meetingsAbortRef.current.abort();
    const controller = new AbortController();
    meetingsAbortRef.current = controller;
    try {
      const res = await fetch('/api/meetings', { signal: controller.signal });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const d = await res.json();
      setMeetings(Array.isArray(d) ? d : []);
      setMeetingsError(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMeetingsError(true);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    return () => meetingsAbortRef.current?.abort();
  }, [fetchMeetings]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <TMPageShell width={1120}>
        <TMScreenHeader title="Dashboard" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load your dashboard"
            description={`${error}. Your data is safe — nothing was lost.`}
            onRetry={fetchDashboard}
          />
        </div>
      </TMPageShell>
    );
  }

  const stats = data?.stats ?? {
    totalTrips: 0, upcomingTrips: 0, totalVendors: 0, totalClients: 0, totalMeetings: 0, totalBookings: 0, pendingCommissions: 0,
  };
  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];
  const nextTrip = upcoming[0];

  const hour = new Date().getHours();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';
  const greeting =
    (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + (firstName ? `, ${firstName}` : '');
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // The starter templates are a first-run affordance, so they're gated on the
  // whole workspace being empty — not just on the trip count. Someone who has
  // built up clients and vendors but happens to have no trips right now (they
  // finished them, or deleted them) is not a new user, and pitching them
  // "Tokyo Client Summit" as a sample reads as the app forgetting who they are.
  const isFirstRun =
    stats.totalTrips === 0 &&
    stats.totalClients === 0 &&
    stats.totalVendors === 0 &&
    stats.totalMeetings === 0 &&
    stats.totalBookings === 0;

  // Deltas are only shown where a real figure backs them — an invented
  // "+3 this quarter" would be worse than a blank line.
  const cells: TMStat[] = [
    { label: 'Total trips', value: stats.totalTrips, href: '/trips' },
    {
      label: 'Upcoming',
      value: stats.upcomingTrips,
      href: '/trips',
      emphasis: nextTrip?.startDate ? `next departs ${formatDate(nextTrip.startDate as unknown as string)}` : undefined,
    },
    { label: 'Clients', value: stats.totalClients, href: '/clients' },
    { label: 'Vendors', value: stats.totalVendors, href: '/vendors' },
    { label: 'Meetings', value: stats.totalMeetings, href: '/meetings' },
  ];
  if (stats.pendingCommissions > 0) {
    cells.push({
      label: 'Commissions',
      value: `$${Math.round(stats.pendingCommissions).toLocaleString('en-US')}`,
      href: '/analytics',
      delta: 'pending',
    });
  }

  const calendarTrips = [...upcoming, ...recent].reduce<TripWithRelations[]>((acc, trip) => {
    if (!acc.find((t) => t.id === trip.id)) acc.push(trip);
    return acc;
  }, []);

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        eyebrow={dateStr}
        title={greeting}
        titleSize={28}
        actions={
          <>
            <Link href="/bookings" className="tm-btn tm-btn-secondary">
              <Plus className="size-3.5" aria-hidden="true" />
              Booking
            </Link>
            <Link href="/clients/new" className="tm-btn tm-btn-secondary">
              <Plus className="size-3.5" aria-hidden="true" />
              Client
            </Link>
            <Link href="/trips/new" className="tm-btn tm-btn-primary">
              New Trip
            </Link>
          </>
        }
        mobileAction={
          <Link href="/trips/new" className="tm-btn tm-btn-primary h-[34px] px-[13px]">
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </Link>
        }
      />

      <div className="flex flex-col gap-5 pt-5 md:gap-6 md:pt-7">
        {/* First run only: starter templates instead of five empty panels. */}
        {isFirstRun && (
          <section className="tm-card p-5 md:p-6">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Get started with a template</h2>
            <p className="mt-1 text-[13px] text-tm-subtle">
              Pick a template to create a sample trip with an itinerary and checklists.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {TRIP_TEMPLATES.map((template) => (
                <TripTemplateCard key={template.id} template={template} />
              ))}
            </div>
            <p className="mt-4 text-[12px] text-tm-subtle">
              Or{' '}
              <Link href="/trips/new" className="font-medium text-tm-accent-text hover:text-tm-accent-text-hover">
                create an empty trip
              </Link>
              .
            </p>
          </section>
        )}

        {nextTrip && <UpNextHero trip={nextTrip} />}

        <TMStatStrip stats={cells} />

        {meetingsError && (
          <div className="flex items-center gap-2 text-[12px] text-tm-accent-text">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            <span>Couldn&apos;t load meetings</span>
            <button
              type="button"
              onClick={fetchMeetings}
              aria-label="Retry loading meetings"
              className="inline-flex items-center justify-center rounded p-0.5 hover:bg-tm-accent-bg"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          {/* The calendar is desktop-only. On a phone it would be a 7-column
              grid of 40px cells — legible as a shape, useless as a calendar —
              so mobile leads with the upcoming list instead. */}
          <div className="hidden lg:block">
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
              meetings={meetings}
            />
          </div>

          <div className="flex flex-col gap-5">
            <UpcomingTrips trips={upcoming} />
            <RecentActivity trips={recent} />
          </div>
        </div>
      </div>
    </TMPageShell>
  );
}
