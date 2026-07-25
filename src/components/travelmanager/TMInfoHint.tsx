'use client';

import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * A small ⓘ that reveals the long explanation on demand.
 *
 * The default for explanatory text in this app is: say the one thing the
 * control cannot say for itself, and put the rest behind this. Paragraphs of
 * preamble above every setting made the page long enough that people scrolled
 * past the settings themselves — and nobody reads the third line anyway.
 *
 * Use it for detail that is genuinely useful but rarely needed. Do NOT use it
 * to hide something the user must know before acting (an irreversible delete,
 * a billing consequence) — that belongs in the visible copy.
 */
export function TMInfoHint({
  label,
  children,
}: {
  /** Describes what the hint explains, for screen readers. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About ${label}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-tm-ghost transition-colors hover:text-tm-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
      >
        <Info className="size-[15px]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[260px] rounded-[11px] border border-tm-line bg-tm-surface p-3 text-[12px] leading-[1.55] text-tm-muted shadow-tm-card-hover"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
