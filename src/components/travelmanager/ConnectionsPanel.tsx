'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, UserPlus, Check, X, Loader2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import type { FriendConnection, PublicUserSummary } from '@/lib/travelmanager/types';

function initials(user: PublicUserSummary): string {
  const source = user.name || user.username || '?';
  return source
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserAvatar({ user, className }: { user: PublicUserSummary; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.username || ''} />}
      <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
        {initials(user)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserIdentity({ user }: { user: PublicUserSummary }) {
  return (
    <div className="min-w-0 flex-1">
      {user.name && <p className="truncate text-[14px] font-medium text-tm-ink">{user.name}</p>}
      <p className="truncate text-[12px] text-tm-subtle">
        {user.username ? `@${user.username}` : 'No username'}
      </p>
    </div>
  );
}

/**
 * One person, as a row.
 *
 * These were each a <Card>, which is `flex flex-col gap-6 … py-6` at its base.
 * Adding `flex items-center` to that does nothing — flex-col wins on stylesheet
 * order — so every connection rendered as a ~170px centred column: avatar on
 * its own line, then name, then handle, then the button. Three people filled a
 * phone screen. Explicit flex-row here, and the group sits in ONE bordered
 * container with dividers rather than a card per person.
 */
export function ConnectionRow({
  user,
  children,
}: {
  user: PublicUserSummary;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
      <UserAvatar user={user} className="size-9 shrink-0" />
      <UserIdentity user={user} />
      <div className="flex shrink-0 flex-row items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Bordered container for a run of ConnectionRows. */
export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-tm-divider overflow-hidden rounded-[14px] border border-tm-line bg-tm-surface shadow-tm-card">
      {children}
    </div>
  );
}

export function ConnectionsPanel() {
  const { showToast } = useTMToast();

  const [connections, setConnections] = useState<FriendConnection[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<FriendConnection | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadConnections = useCallback(() => {
    return fetch('/api/friendships')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FriendConnection[]) => setConnections(Array.isArray(data) ? data : []))
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Debounced user search
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data: PublicUserSummary[]) => {
          if (seq !== searchSeq.current) return;
          setResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (seq === searchSeq.current) setResults([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { incoming, outgoing, accepted } = useMemo(() => {
    const incoming: FriendConnection[] = [];
    const outgoing: FriendConnection[] = [];
    const accepted: FriendConnection[] = [];
    for (const c of connections) {
      if (c.status === 'ACCEPTED') accepted.push(c);
      else if (c.direction === 'incoming') incoming.push(c);
      else outgoing.push(c);
    }
    return { incoming, outgoing, accepted };
  }, [connections]);

  // Ids we already have any relationship with — hide from search results.
  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.user.id)),
    [connections]
  );
  const visibleResults = results.filter((u) => !connectedIds.has(u.id));

  const addFriend = async (user: PublicUserSummary) => {
    if (!user.username) return;
    setAddingId(user.id);
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send request');
      }
      showToast(`Request sent to @${user.username}`);
      await loadConnections();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to send request', 'error');
    } finally {
      setAddingId(null);
    }
  };

  const acceptRequest = async (c: FriendConnection) => {
    setBusyId(c.friendshipId);
    try {
      const res = await fetch(`/api/friendships/${c.friendshipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (!res.ok) throw new Error();
      showToast(`You're now friends with ${c.user.name || '@' + c.user.username}`);
      await loadConnections();
    } catch {
      showToast('Failed to accept request', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Used for decline / cancel (no confirmation needed).
  const deleteConnection = async (c: FriendConnection, successMsg: string) => {
    setBusyId(c.friendshipId);
    try {
      const res = await fetch(`/api/friendships/${c.friendshipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(successMsg);
      await loadConnections();
    } catch {
      showToast('Something went wrong', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/friendships/${removeTarget.friendshipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Friend removed');
      setRemoveTarget(null);
      await loadConnections();
    } catch {
      showToast('Failed to remove friend', 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* The page header already says "Friends"; a second h2 saying it again
          cost a whole row on a phone. The count moves onto the section
          heading below, where it labels the list it actually counts. */}

      {/* Search / add by username */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find people by username..."
            aria-label="Search users by username"
            className="pl-10"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-300" />
          )}
        </div>

        {query.trim() && (
          <RowGroup>
            {visibleResults.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-tm-subtle">
                {searching ? 'Searching…' : 'No matching people found.'}
              </p>
            ) : (
              visibleResults.map((user) => (
                <ConnectionRow key={user.id} user={user}>
                  <Button
                    size="sm"
                    onClick={() => addFriend(user)}
                    disabled={addingId === user.id || !user.username}
                    className="tm-btn tm-btn-primary"
                  >
                    {addingId === user.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    Add
                  </Button>
                </ConnectionRow>
              ))
            )}
          </RowGroup>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="tm-label-upper px-1">Requests</h3>
          <RowGroup>
            {incoming.map((c) => (
              <ConnectionRow key={c.friendshipId} user={c.user}>
                <Button
                  size="sm"
                  onClick={() => acceptRequest(c)}
                  disabled={busyId === c.friendshipId}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  {busyId === c.friendshipId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Accept
                </Button>
                {/* Icon-only below sm: "Accept" + "Decline" side by side pushed
                    the name into a truncate on a phone. */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteConnection(c, 'Request declined')}
                  disabled={busyId === c.friendshipId}
                  aria-label="Decline request"
                >
                  <X className="size-3.5" />
                  <span className="hidden sm:inline">Decline</span>
                </Button>
              </ConnectionRow>
            ))}
          </RowGroup>
        </div>
      )}

      {/* Outgoing / pending */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <h3 className="tm-label-upper px-1">Sent</h3>
          <RowGroup>
            {outgoing.map((c) => (
              <ConnectionRow key={c.friendshipId} user={c.user}>
                {/* The clock icon alone carries "pending" on a phone; the word
                    only earns its width once there is room for it. */}
                <span className="inline-flex flex-row items-center gap-1 text-[12px] font-medium text-tm-subtle">
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Requested</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteConnection(c, 'Request canceled')}
                  disabled={busyId === c.friendshipId}
                >
                  {busyId === c.friendshipId ? <Loader2 className="size-3.5 animate-spin" /> : 'Cancel'}
                </Button>
              </ConnectionRow>
            ))}
          </RowGroup>
        </div>
      )}

      {/* Accepted friends */}
      {accepted.length > 0 && (
        <div className="space-y-2">
          <h3 className="tm-label-upper px-1">Friends · {accepted.length}</h3>
          <RowGroup>
            {accepted.map((c) => (
              <ConnectionRow key={c.friendshipId} user={c.user}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoveTarget(c)}
                  className="text-tm-subtle hover:text-tm-danger"
                >
                  Remove
                </Button>
              </ConnectionRow>
            ))}
          </RowGroup>
        </div>
      )}

      {incoming.length === 0 && outgoing.length === 0 && accepted.length === 0 && (
        <p className="text-sm text-slate-500">
          Search for people by username to send your first friend request.
        </p>
      )}

      <TMDeleteDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remove friend"
        description={
          removeTarget
            ? `Remove ${removeTarget.user.name || '@' + removeTarget.user.username} from your friends?`
            : ''
        }
        isDeleting={removing}
      />
    </section>
  );
}
