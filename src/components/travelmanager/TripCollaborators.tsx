'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Loader2, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { ConnectionRow, RowGroup } from '@/components/travelmanager/ConnectionsPanel';
import type { PublicUserSummary } from '@/lib/travelmanager/types';

/**
 * Who else can see and edit this trip.
 *
 * Lives inside the trip detail content rather than at its own route: the iOS
 * bundle is a static export with every [param] directory stripped, so a
 * /trips/[id]/collaborators page could not ship, and the route firewall fails
 * CI on any link to one. Both the web and native trip screens render this file,
 * so putting it here ships it to both for free.
 *
 * Every affordance below is a convenience, never the boundary — the server
 * re-decides on each request via requireTripAccess(). Hiding the Remove button
 * from a collaborator is UX; the 403 is the security.
 */

type Role = 'VIEWER' | 'EDITOR';

interface CollaboratorRow {
  id: string;
  role: Role;
  status: 'PENDING' | 'ACCEPTED';
  user: PublicUserSummary;
}

const ROLE_LABEL: Record<Role, string> = {
  EDITOR: 'Can edit',
  VIEWER: 'Can view',
};

export function TripCollaborators({
  tripId,
  isOwner,
  viewerRole,
}: {
  tripId: string;
  isOwner: boolean;
  viewerRole: 'OWNER' | 'EDITOR' | 'VIEWER';
}) {
  const { showToast } = useTMToast();
  const [rows, setRows] = useState<CollaboratorRow[]>([]);
  const [candidates, setCandidates] = useState<PublicUserSummary[]>([]);
  const [myRowId, setMyRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(Array.isArray(data.collaborators) ? data.collaborators : []);
      // Candidates come back empty for non-owners; the server decides, not us.
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setMyRowId(typeof data.myRowId === 'string' ? data.myRowId : null);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (user: PublicUserSummary, role: Role) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to invite');
      }
      showToast(`Invited ${user.name || '@' + user.username}`);
      setInviteOpen(false);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to invite', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (row: CollaboratorRow, role: Role) => {
    setBusyId(row.user.id);
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators/${row.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
      showToast(`${row.user.name || 'They'} can now ${role === 'EDITOR' ? 'edit' : 'view'}`);
      await load();
    } catch {
      showToast('Failed to change role', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: CollaboratorRow) => {
    setBusyId(row.user.id);
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators/${row.user.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      showToast('Removed from trip');
      await load();
    } catch {
      showToast('Failed to remove', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const leave = async () => {
    // myRowId comes from the server — the client has no reliable handle on its
    // own user id, and picking "the first accepted row" would delete the wrong
    // person's membership on any trip with more than one collaborator.
    if (!myRowId) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/collaborations/${myRowId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('You left this trip');
      window.location.href = '/trips';
    } catch {
      showToast('Failed to leave trip', 'error');
      setLeaving(false);
    }
  };

  // Nothing to say on a solo trip you own — don't spend a card on it.
  if (!loading && rows.length === 0 && !isOwner) return null;

  return (
    <section className="tm-card px-4 py-4 md:px-6 md:py-5">
      <div className="mb-3 flex flex-row items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">
          <Users className="size-4 text-tm-muted" aria-hidden="true" />
          Collaborators
          {rows.length > 0 && <span className="text-[13px] font-normal text-tm-subtle">· {rows.length}</span>}
        </h3>
        {isOwner && (
          <Button
            size="sm"
            className="tm-btn tm-btn-primary shrink-0"
            onClick={() => setInviteOpen(true)}
            disabled={candidates.length === 0}
            title={candidates.length === 0 ? 'Connect with someone first to invite them' : undefined}
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            Invite
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-tm-subtle">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Loading
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-tm-subtle">
          {candidates.length === 0
            ? 'Add a friend on the Friends tab, then you can invite them to plan this trip with you.'
            : 'Invite a friend to plan this trip together.'}
        </p>
      ) : (
        <RowGroup>
          {rows.map((row) => (
            <ConnectionRow key={row.id} user={row.user}>
              {row.status === 'PENDING' && (
                <span className="rounded-full bg-tm-fill px-2 py-0.5 text-[11px] font-medium text-tm-muted">
                  Invited
                </span>
              )}
              {isOwner ? (
                <>
                  <select
                    value={row.role}
                    onChange={(e) => changeRole(row, e.target.value as Role)}
                    disabled={busyId === row.user.id}
                    aria-label={`Role for ${row.user.name || row.user.username}`}
                    className="rounded-[8px] border border-tm-control bg-white px-2 py-1 text-[12px] text-tm-body"
                  >
                    <option value="VIEWER">Can view</option>
                    <option value="EDITOR">Can edit</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(row)}
                    disabled={busyId === row.user.id}
                    className="text-tm-subtle hover:text-tm-danger"
                  >
                    {busyId === row.user.id ? <Loader2 className="size-3.5 animate-spin" /> : 'Remove'}
                  </Button>
                </>
              ) : (
                <span className="text-[12px] font-medium text-tm-subtle">{ROLE_LABEL[row.role]}</span>
              )}
            </ConnectionRow>
          ))}
        </RowGroup>
      )}

      {!isOwner && (
        <div className="mt-3 flex flex-row items-center justify-between gap-3 border-t border-tm-divider pt-3">
          <p className="text-[12px] text-tm-subtle">
            {viewerRole === 'EDITOR'
              ? 'You can edit this trip.'
              : 'You can view this trip.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLeaveOpen(true)}
            className="shrink-0 text-tm-subtle hover:text-tm-danger"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Leave
          </Button>
        </div>
      )}

      {/* Invite picker. The candidate list is computed server-side — connected,
          and not already on the trip — so the UI cannot drift from the rule the
          invite endpoint actually enforces. */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a friend</DialogTitle>
            <DialogDescription>
              They&apos;ll get a notification and can accept from their Trips screen.
            </DialogDescription>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-[13px] text-tm-subtle">
              Everyone you&apos;re connected with is already on this trip.
            </p>
          ) : (
            <RowGroup>
              {candidates.map((user) => (
                <ConnectionRow key={user.id} user={user}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => invite(user, 'VIEWER')}
                    disabled={busyId === user.id}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    className="tm-btn tm-btn-primary"
                    onClick={() => invite(user, 'EDITOR')}
                    disabled={busyId === user.id}
                  >
                    {busyId === user.id ? <Loader2 className="size-3.5 animate-spin" /> : 'Edit'}
                  </Button>
                </ConnectionRow>
              ))}
            </RowGroup>
          )}
        </DialogContent>
      </Dialog>

      <TMDeleteDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={leave}
        title="Leave this trip"
        description="You'll lose access to this trip. The owner can invite you again."
        isDeleting={leaving}
      />
    </section>
  );
}
