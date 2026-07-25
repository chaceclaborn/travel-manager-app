'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface CalendarTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

interface CalendarMeeting {
  id: string;
  title: string;
  startDateTime: string;
}

interface TripDayInfo {
  trip: CalendarTrip;
  lane: number;
  /** The trip's real first/last day — carries the label and the colored edge. */
  isStart: boolean;
  isEnd: boolean;
  /** The visual ends of this row's segment — carries the rounding and margin. */
  isRunStart: boolean;
  isRunEnd: boolean;
  isSingle: boolean;
}

interface TMCalendarPreviewProps {
  trips: CalendarTrip[];
  meetings?: CalendarMeeting[];
  /** Shifts the leading offset and relabels the header row. */
  weekStartsMonday?: boolean;
}

/**
 * Trip bar palettes.
 *
 * Each bar is a near-neutral fill with a 2px colored left edge — the edge
 * carries the status, the fill just separates the run from the grid. Filled
 * status-colored bars turned the month into a bar chart.
 */
const BAR_PALETTE: Record<string, { bg: string; text: string; edge: string }> = {
  DRAFT: { bg: '#F1F4F8', text: '#64748B', edge: '#94A3B8' },
  PLANNED: { bg: '#EFF4FB', text: '#1D4ED8', edge: '#3B82F6' },
  IN_PROGRESS: { bg: '#FEF6E7', text: '#92400E', edge: '#F59E0B' },
  COMPLETED: { bg: '#F1F4F8', text: '#475569', edge: '#10B981' },
  CANCELLED: { bg: '#FEF2F2', text: '#DC2626', edge: '#F87171' },
};

const SUNDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseUTCDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function TMCalendarPreview({ trips, meetings = [], weekStartsMonday = false }: TMCalendarPreviewProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [popoverDay, setPopoverDay] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayLabels = weekStartsMonday ? MONDAY_LABELS : SUNDAY_LABELS;

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
    // getDay() is Sunday-indexed; a Monday-start grid shifts it back one and
    // wraps Sunday to the end of the row.
    const startOffset = weekStartsMonday ? (firstDay.getDay() + 6) % 7 : firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

    return { weeks: rows, today: now };
  }, [year, month, weekStartsMonday]);

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

          // A run that continues past a week boundary keeps square edges, so
          // the eye reads it as one trip broken across rows rather than two.
          const weekStartCol = weekStartsMonday ? 1 : 0;
          const weekEndCol = weekStartsMonday ? 0 : 6;
          const isRowStart = dayOfWeek === weekStartCol;
          const isRowEnd = dayOfWeek === weekEndCol;

          const existing = map.get(key) ?? [];
          existing.push({
            trip,
            lane,
            // `isStart` drives the label and the colored edge — only the real
            // first day gets those. `isRowStart` only affects rounding.
            isStart: isFirstDay,
            isEnd: isLastDay,
            isRunStart: isFirstDay || isRowStart,
            isRunEnd: isLastDay || isRowEnd || cursor.getDate() === lastOfMonth,
            isSingle: isSingleDay,
          });
          map.set(key, existing);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return map;
  }, [trips, month, year, weekStartsMonday]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    for (const m of meetings) {
      const d = new Date(m.startDateTime);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = d.getDate().toString();
      const existing = map.get(key) ?? [];
      existing.push(m);
      map.set(key, existing);
    }
    return map;
  }, [meetings, month, year]);

  const prevMonth = useCallback(() => setViewDate(new Date(year, month - 1, 1)), [year, month]);
  const nextMonth = useCallback(() => setViewDate(new Date(year, month + 1, 1)), [year, month]);
  const goToToday = useCallback(() => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long' });
  const yearLabel = viewDate.getFullYear();

  return (
    <div className="tm-card w-full px-6 py-[22px]">
      {/* Header: month, legend, and the three navigation controls. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-4">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">
            {monthLabel} <span className="font-normal text-tm-subtle">{yearLabel}</span>
          </h2>
          {/* Square for trips (they occupy a span), circle for meetings (they
              happen at a point) — the shapes match what they mark. */}
          <span className="hidden items-center gap-3 text-[11px] text-tm-subtle sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5" style={{ background: '#94A3B8' }} aria-hidden="true" />
              Trips
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: '#F59E0B' }} aria-hidden="true" />
              Meetings
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="flex size-7 items-center justify-center rounded-[7px] text-tm-subtle hover:bg-tm-fill hover:text-tm-body"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={goToToday}
            className="flex h-7 items-center rounded-[7px] px-2.5 text-[12px] font-medium text-tm-muted hover:bg-tm-fill hover:text-tm-body"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="flex size-7 items-center justify-center rounded-[7px] text-tm-subtle hover:bg-tm-fill hover:text-tm-body"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7">
        {dayLabels.map((d) => (
          <div key={d} className="pb-2 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-tm-faint">
            {d}
          </div>
        ))}
      </div>

      {/* Grid. A hairline rule set, not a gapped gray gutter: the container
          carries the top and left edges, each cell the right and bottom. */}
      <div className="grid grid-cols-7 overflow-hidden rounded-[8px] border-l border-t border-tm-hairline">
        {weeks.flat().map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-[76px] border-b border-r border-tm-hairline bg-tm-wash"
              />
            );
          }

          const dayNum = day.getDate();
          const isToday = isSameDay(day, today);
          const dayTrips = tripsByDay.get(dayNum.toString()) ?? [];
          const dayMeetings = meetingsByDay.get(dayNum.toString()) ?? [];
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const hasTrips = dayTrips.length > 0;
          const isPopoverOpen = popoverDay === dateStr;
          const isLastRow = Math.floor(i / 7) === weeks.length - 1;
          const colIndex = i % 7;
          const popoverAlign = colIndex <= 1 ? 'left-0' : colIndex >= 5 ? 'right-0' : 'left-1/2 -translate-x-1/2';

          return (
            <div
              key={dayNum}
              className="group relative flex min-h-[76px] flex-col border-b border-r border-tm-hairline"
              style={{ background: isToday ? '#FFFDF5' : undefined }}
              onClick={!hasTrips ? () => setPopoverDay(isPopoverOpen ? null : dateStr) : undefined}
              onMouseEnter={() => { if (!hasTrips) setPopoverDay(dateStr); }}
              onMouseLeave={() => setPopoverDay(null)}
            >
              <div className="flex items-start justify-between px-1.5 pt-1.5">
                {isToday ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-tm-accent text-[11px] font-semibold leading-none text-white">
                    {dayNum}
                  </span>
                ) : (
                  <span className="pl-1 text-[11px] font-medium leading-5 text-tm-muted tm-nums">{dayNum}</span>
                )}

                <div className="flex items-center gap-1 pt-1">
                  {dayMeetings.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-semibold text-tm-accent-text"
                      title={dayMeetings.map((m) => m.title).join(', ')}
                    >
                      <span className="size-[5px] rounded-full bg-tm-accent" aria-hidden="true" />
                      {dayMeetings.length > 1 ? dayMeetings.length : ''}
                    </span>
                  )}
                  {!hasTrips && (
                    <Plus className="size-3 text-tm-ghost opacity-0 group-hover:opacity-100" aria-hidden="true" />
                  )}
                </div>
              </div>

              {/* Trip range bars */}
              <div
                className="relative mt-1 flex-1"
                style={{ minHeight: hasTrips ? `${Math.min(dayTrips.length, 3) * 21 + 2}px` : undefined }}
              >
                {dayTrips.slice(0, 3).map((info) => {
                  const palette = BAR_PALETTE[info.trip.status] ?? BAR_PALETTE.DRAFT;
                  return (
                    <Link
                      key={info.trip.id}
                      href={detailHref('trips', info.trip.id)}
                      className="absolute left-0 right-0 flex h-[19px] items-center overflow-hidden hover:brightness-[0.97]"
                      style={{
                        top: info.lane * 21,
                        background: palette.bg,
                        // The colored edge marks the trip's real start, so a
                        // run broken across two rows only gets one.
                        borderLeft: info.isStart ? `2px solid ${palette.edge}` : undefined,
                        marginLeft: info.isRunStart ? 3 : 0,
                        marginRight: info.isRunEnd ? 3 : 0,
                        borderTopLeftRadius: info.isRunStart ? 5 : 0,
                        borderBottomLeftRadius: info.isRunStart ? 5 : 0,
                        borderTopRightRadius: info.isRunEnd ? 5 : 0,
                        borderBottomRightRadius: info.isRunEnd ? 5 : 0,
                      }}
                      title={info.trip.title}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {info.isStart && (
                        <span
                          className="truncate px-1.5 text-[10px] font-medium leading-none"
                          style={{ color: palette.text }}
                        >
                          {info.trip.title}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {dayTrips.length > 3 && (
                  <span
                    className="absolute left-0 right-0 px-1.5 text-[9px] font-medium leading-tight text-tm-faint"
                    style={{ top: 3 * 21 }}
                  >
                    +{dayTrips.length - 3} more
                  </span>
                )}
              </div>

              {/* New trip popover */}
              {isPopoverOpen && (
                <div
                  ref={popoverRef}
                  className={`absolute ${popoverAlign} z-50 min-w-[120px] rounded-[9px] border border-tm-line bg-white py-1 shadow-tm-card-hover ${
                    isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'
                  }`}
                >
                  <Link
                    href={`/trips/new?startDate=${dateStr}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-tm-body hover:bg-tm-wash"
                    onClick={() => setPopoverDay(null)}
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    New Trip
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
