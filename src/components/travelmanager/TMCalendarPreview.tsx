'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

interface TripDayInfo {
  trip: CalendarTrip;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
  isSingle: boolean;
}

interface TMCalendarPreviewProps {
  trips: CalendarTrip[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-200/80',
  PLANNED: 'bg-blue-100',
  IN_PROGRESS: 'bg-amber-100',
  COMPLETED: 'bg-green-100',
  CANCELLED: 'bg-red-100',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  PLANNED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-red-400',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  DRAFT: 'text-slate-600',
  PLANNED: 'text-blue-700',
  IN_PROGRESS: 'text-amber-800',
  COMPLETED: 'text-green-700',
  CANCELLED: 'text-red-600',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseUTCDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const monthVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

export function TMCalendarPreview({ trips }: TMCalendarPreviewProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [direction, setDirection] = useState(0);
  const [popoverDay, setPopoverDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverDay(null);
      }
    }
    if (popoverDay) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [popoverDay]);

  const { weeks, today } = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

    return { weeks: rows, today: now };
  }, [year, month]);

  const tripsByDay = useMemo(() => {
    const map = new Map<string, TripDayInfo[]>();

    // 1. Parse all trips and compute their day ranges for this month
    const tripRanges = trips.map(trip => {
      const start = parseUTCDate(trip.startDate);
      const end = parseUTCDate(trip.endDate);
      return { trip, start, end };
    }).sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime();
      if (startDiff !== 0) return startDiff;
      return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    });

    // 2. Assign lanes (greedy: find lowest free lane for each trip)
    const laneAssignments = new Map<string, number>();

    for (const { trip, start, end } of tripRanges) {
      let assignedLane = 0;
      while (assignedLane < 3) {
        const busy = tripRanges.some(other => {
          if (other.trip.id === trip.id) return false;
          const otherLane = laneAssignments.get(other.trip.id);
          if (otherLane !== assignedLane) return false;
          return start <= other.end && end >= other.start;
        });
        if (!busy) break;
        assignedLane++;
      }
      if (assignedLane >= 3) assignedLane = 2;
      laneAssignments.set(trip.id, assignedLane);
    }

    // 3. For each trip, iterate through its days and populate the map
    const lastOfMonth = new Date(year, month + 1, 0).getDate();

    for (const { trip, start, end } of tripRanges) {
      const lane = laneAssignments.get(trip.id) ?? 0;
      const cursor = new Date(start);
      const isSingleDay = start.getTime() === end.getTime();

      while (cursor <= end) {
        if (cursor.getMonth() === month && cursor.getFullYear() === year) {
          const key = cursor.getDate().toString();
          const dayOfWeek = cursor.getDay();

          const isFirstDay = cursor.getTime() === start.getTime();
          const isLastDay = cursor.getTime() === end.getTime();

          const isStartVisual = isFirstDay || dayOfWeek === 0;
          const isEndVisual = isLastDay || dayOfWeek === 6 || cursor.getDate() === lastOfMonth;

          const existing = map.get(key) ?? [];
          existing.push({
            trip,
            lane,
            isStart: isStartVisual,
            isEnd: isEndVisual,
            isSingle: isSingleDay,
          });
          map.set(key, existing);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return map;
  }, [trips, month, year]);

  const prevMonth = useCallback(() => {
    setDirection(-1);
    setViewDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const nextMonth = useCallback(() => {
    setDirection(1);
    setViewDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const goToToday = useCallback(() => {
    const now = new Date();
    const newDirection = now > viewDate ? 1 : now < viewDate ? -1 : 0;
    setDirection(newDirection);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long' });
  const yearLabel = viewDate.getFullYear();
  const monthKey = `${year}-${month}`;

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Calendar</h2>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="text-[11px] font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-[150px] text-center select-none">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.span
                key={monthKey}
                custom={direction}
                variants={monthVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="inline-block text-sm font-semibold text-slate-800"
              >
                {monthLabel}{' '}
                <span className="font-normal text-slate-400">{yearLabel}</span>
              </motion.span>
            </AnimatePresence>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={monthKey}
          custom={direction}
          initial={{ opacity: 0, y: direction > 0 ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: direction > 0 ? -8 : 8 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="grid grid-cols-7 gap-px bg-slate-100/50 rounded-lg overflow-hidden"
        >
          {weeks.flat().map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="min-h-[4.5rem] bg-white/60" />;
            }

            const dayNum = day.getDate();
            const isToday = isSameDay(day, today);
            const dayTrips = tripsByDay.get(dayNum.toString()) ?? [];
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const hasTrips = dayTrips.length > 0;
            const isPopoverOpen = popoverDay === dateStr;
            const isHovered = hoveredDay === dateStr;
            const isLastRow = Math.floor(i / 7) === weeks.length - 1;
            const colIndex = i % 7;
            const popoverAlign = colIndex <= 1 ? 'left-0' : colIndex >= 5 ? 'right-0' : 'left-1/2 -translate-x-1/2';

            return (
              <div
                key={dayNum}
                className={`min-h-[4.5rem] flex flex-col text-xs relative transition-all duration-150 group bg-white ${
                  isToday
                    ? 'ring-2 ring-amber-400/70 ring-inset bg-gradient-to-b from-amber-50/80 to-amber-50/30 z-10'
                    : isPopoverOpen
                    ? 'bg-amber-50 ring-1 ring-amber-200 ring-inset'
                    : 'hover:bg-amber-50/60 active:bg-amber-50'
                } ${!hasTrips ? 'cursor-pointer' : ''}`}
                onClick={!hasTrips ? () => setPopoverDay(isPopoverOpen ? null : dateStr) : undefined}
                onMouseEnter={() => { setHoveredDay(dateStr); if (!hasTrips) setPopoverDay(dateStr); }}
                onMouseLeave={() => { setHoveredDay(null); setPopoverDay(null); }}
              >
                {/* Day number row */}
                <div className="flex items-center justify-between px-1.5 pt-1.5">
                  <div className="flex items-center gap-1">
                    {isToday ? (
                      <span className="relative flex items-center justify-center size-6 -ml-0.5">
                        <span className="absolute inset-0 rounded-full bg-amber-500 animate-pulse opacity-20" />
                        <span className="relative size-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">
                          {dayNum}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] leading-none text-slate-500 font-medium pl-0.5">
                        {dayNum}
                      </span>
                    )}
                  </div>
                  {!hasTrips && (
                    <Plus className="size-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  )}
                </div>

                {/* Trip range bars */}
                <div className="relative mt-0.5 flex-1" style={{ minHeight: dayTrips.length > 0 ? `${Math.min(dayTrips.length, 3) * 20 + 2}px` : undefined }}>
                  {dayTrips.slice(0, 3).map((info) => {
                    const bg = STATUS_COLORS[info.trip.status] ?? 'bg-slate-200/80';
                    const text = STATUS_TEXT_COLORS[info.trip.status] ?? 'text-slate-600';
                    const dot = STATUS_DOT_COLORS[info.trip.status] ?? 'bg-slate-400';

                    return (
                      <Link
                        key={info.trip.id}
                        href={`/trips/${info.trip.id}`}
                        className={`absolute left-0 right-0 h-[18px] flex items-center overflow-hidden transition-all duration-150 hover:brightness-95 ${bg} ${
                          info.isSingle ? 'mx-0.5 rounded-md' :
                          info.isStart && info.isEnd ? 'rounded-md mx-0.5' :
                          info.isStart ? 'rounded-l-md ml-0.5' :
                          info.isEnd ? 'rounded-r-md mr-0.5' : ''
                        }`}
                        style={{ top: `${info.lane * 20}px` }}
                        title={info.trip.title}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(info.isStart || info.isSingle) && (
                          <span className={`flex items-center gap-1 px-1 min-w-0 ${text}`}>
                            <span className={`shrink-0 size-1.5 rounded-full ${dot}`} />
                            <span className="truncate text-[10px] font-medium leading-none">{info.trip.title}</span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {dayTrips.length > 3 && (
                    <span className="absolute left-0 right-0 text-[9px] text-slate-400 font-medium px-1.5 leading-tight" style={{ top: `${3 * 20}px` }}>
                      +{dayTrips.length - 3} more
                    </span>
                  )}
                </div>

                {/* Hover tooltip for trip count */}
                {isHovered && hasTrips && !isPopoverOpen && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className="bg-slate-800 text-white text-[10px] font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
                      {dayTrips.length} trip{dayTrips.length !== 1 ? 's' : ''}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-800" />
                    </div>
                  </div>
                )}

                {/* New trip popover */}
                {isPopoverOpen && (
                  <div
                    ref={popoverRef}
                    className={`absolute ${popoverAlign} z-50 bg-white rounded-lg shadow-lg ring-1 ring-slate-200 py-1 min-w-[120px] ${
                      isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                  >
                    <Link
                      href={`/trips/new?startDate=${dateStr}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                      onClick={() => setPopoverDay(null)}
                    >
                      <Plus className="size-3" />
                      New Trip
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
