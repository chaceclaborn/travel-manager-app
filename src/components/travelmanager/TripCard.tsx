'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Calendar, DollarSign, Users, Building2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';

interface TripCardProps {
  trip: {
    id: string;
    title: string;
    destination?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status: string;
    budget?: number | null;
    vendors?: any[];
    clients?: any[];
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateCompact(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function getDurationDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatBudget(budget: number): string {
  if (budget >= 1_000_000) return `$${(budget / 1_000_000).toFixed(1)}M`;
  if (budget >= 1_000) return `$${(budget / 1_000).toFixed(budget % 1000 === 0 ? 0 : 1)}K`;
  return `$${budget.toLocaleString()}`;
}

const statusBorderColors: Record<string, string> = {
  DRAFT: 'border-l-slate-300',
  PLANNED: 'border-l-blue-400',
  IN_PROGRESS: 'border-l-amber-400',
  COMPLETED: 'border-l-emerald-400',
  CANCELLED: 'border-l-red-400',
};

export function TripCard({ trip }: TripCardProps) {
  const days = trip.startDate && trip.endDate ? getDurationDays(trip.startDate, trip.endDate) : null;
  const vendorCount = trip.vendors?.length || 0;
  const clientCount = trip.clients?.length || 0;
  const borderColor = statusBorderColors[trip.status] ?? 'border-l-slate-300';

  return (
    <Link href={`/trips/${trip.id}`} className="block outline-none group">
      <motion.div
        whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
        whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      >
        <div
          className={`relative cursor-pointer overflow-hidden rounded-xl border border-slate-100 border-l-[3px] ${borderColor} bg-white p-5 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:border-slate-200 group-focus-visible:ring-2 group-focus-visible:ring-amber-500 group-focus-visible:ring-offset-2`}
        >
          {/* Header: title + status */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-slate-800 leading-snug line-clamp-2 min-w-0 flex-1">
              {trip.title}
            </h3>
            <div className="shrink-0">
              <TMStatusBadge status={trip.status} />
            </div>
          </div>

          {/* Destination */}
          {trip.destination && (
            <div className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
              <MapPin className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{trip.destination}</span>
            </div>
          )}

          {/* Date range */}
          {trip.startDate && trip.endDate ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar className="size-3.5 shrink-0 text-slate-400" />
              <span>
                {formatDateCompact(trip.startDate)} &ndash; {formatDate(trip.endDate)}
              </span>
              {days && (
                <span className="ml-1 inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                  {days}d
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-400 italic">
              <Calendar className="size-3.5 shrink-0" />
              <span>Dates not set</span>
            </div>
          )}

          {/* Vendor/Client badges */}
          {(vendorCount > 0 || clientCount > 0) && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {vendorCount > 0 && (
                <Badge variant="secondary" className="text-[11px] gap-1 bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 border-0 px-2 py-0.5">
                  <Building2 className="size-3" />
                  {vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'}
                </Badge>
              )}
              {clientCount > 0 && (
                <Badge variant="secondary" className="text-[11px] gap-1 bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 border-0 px-2 py-0.5">
                  <Users className="size-3" />
                  {clientCount} {clientCount === 1 ? 'client' : 'clients'}
                </Badge>
              )}
            </div>
          )}

          {/* Footer: budget + arrow */}
          <div className="mt-3.5 flex items-center justify-between border-t border-slate-50 pt-3">
            {trip.budget != null ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                <DollarSign className="size-3.5 text-emerald-500" />
                {formatBudget(trip.budget)}
              </span>
            ) : (
              <span className="text-xs text-slate-400">No budget set</span>
            )}
            <ChevronRight className="size-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-400" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
