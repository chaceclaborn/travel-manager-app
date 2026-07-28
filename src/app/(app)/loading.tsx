import { TMPageShell } from '@/components/travelmanager/TMPageShell';
import { TMSkeleton, TMStatStripSkeleton, TMCardGridSkeleton } from '@/components/travelmanager/TMEmptyState';

/**
 * Route-level loading fallback.
 *
 * Mirrors the common page shape — title row, stat strip, card grid — so
 * navigation lands on the layout it's about to fill rather than a spinner.
 * The shimmer is the shared skeleton treatment; nothing here pulses opacity.
 */
export default function AppLoading() {
  return (
    <TMPageShell width={1120}>
      <div className="pt-9" role="status" aria-label="Loading page">
        <div className="flex items-end justify-between gap-4">
          <div>
            <TMSkeleton className="h-6 w-44" />
            <TMSkeleton className="mt-2.5 h-3.5 w-64" />
          </div>
          <TMSkeleton className="h-9 w-28" style={{ borderRadius: 9 }} />
        </div>

        <div className="mt-7">
          <TMStatStripSkeleton cells={5} />
        </div>

        <div className="mt-5">
          <TMCardGridSkeleton count={6} columns={3} />
        </div>

        <span className="sr-only">Loading…</span>
      </div>
    </TMPageShell>
  );
}
