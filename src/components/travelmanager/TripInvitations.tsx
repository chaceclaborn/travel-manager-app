'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { UserAvatar, RowGroup } from '@/components/travelmanager/ConnectionsPanel';
import { formatDateShort } from '@/lib/date-utils';
import type { PublicUserSummary } from '@/lib/travelmanager/types';

/**
 * Pending "come plan this trip with me" invitations, shown above the trip list.
 *
 * This is the landing spot for the invite push (url: '/trips'), so it has to be
 * the first thing on the screen — a notification that drops you somewhere you
 * then have to go hunting is worse than no notification.
 *
 * The payload behind it is deliberately thin: a PENDING invitation grants no
 * trip access at all, so the server sends only what is needed to decide —
 * title, destination, dates, and who asked. No notes, no budget, no children.
 */

interface Invitation {
  id: string;
  role: 'VIEWER' | 'EDITOR';
  trip: {
    id: string;
    title: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  invitedBy: PublicUserSummary;
}

export function TripInvitations({ onAccepted }: { onAccepted?: () => void }) {
  const { showToast } = useTMToast();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/collaborations');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInvites(Array.isArray(data.invitations) ? data.invitations : []);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invite: Invitation, accept: boolean) => {
    setBusyId(invite.id);
    try {
      const res = await fetch(`/api/collaborations/${invite.id}`, {
        method: accept ? 'PATCH' : 'DELETE',
        ...(accept
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'accept' }),
            }
          : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
      }
      showToast(accept ? `You joined ${invite.trip.title}` : 'Invitation declined');
      await load();
      // The accepted trip only appears in the list on the next fetch.
      if (accept) onAccepted?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <section className="mb-5">
      <h2 className="tm-label-upper mb-2 px-1">Trip invitations · {invites.length}</h2>
      <RowGroup>
        {invites.map((invite) => {
          const dates =
            invite.trip.startDate && invite.trip.endDate
              ? `${formatDateShort(invite.trip.startDate)} – ${formatDateShort(invite.trip.endDate)}`
              : null;
          return (
            <div key={invite.id} className="flex min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
              <UserAvatar user={invite.invitedBy} className="size-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-tm-ink">{invite.trip.title}</p>
                <p className="truncate text-[12px] text-tm-subtle">
                  {invite.invitedBy.name || `@${invite.invitedBy.username}`}
                  {invite.trip.destination && (
                    <>
                      {' · '}
                      <MapPin className="inline size-3 -translate-y-px" aria-hidden="true" />{' '}
                      {invite.trip.destination}
                    </>
                  )}
                  {dates && ` · ${dates}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-row items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => respond(invite, true)}
                  disabled={busyId === invite.id}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  {busyId === invite.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(invite, false)}
                  disabled={busyId === invite.id}
                  aria-label="Decline invitation"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </RowGroup>
    </section>
  );
}
