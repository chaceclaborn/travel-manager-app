/** Convert a Date object to a YYYY-MM-DD string in local time (no timezone shift). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string into a Date in local time (avoids UTC midnight shift). */
export function parseLocalDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a YYYY-MM-DD string as "Mar 15" for display in picker buttons. */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format an ISO date string (YYYY-MM-DD or with T) as "Mar 15, 2024". Returns null for falsy input. */
export function formatDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const datePart = date.split('T')[0];
  if (!datePart) return date;
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format an ISO date string as "Monday, March 15, 2024" for section headings. */
export function formatDateHeading(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format an ISO datetime string as "Mar 15, 2024, 3:30 PM". Falls back to date-only if no time part. */
export function formatDateTime(date: string | null | undefined): string | null {
  if (!date) return null;
  const [datePart, timePart] = date.split('T');
  if (!datePart) return date;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!timePart) return dateStr;
  const [hours, minutes] = timePart.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${dateStr}, ${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}
