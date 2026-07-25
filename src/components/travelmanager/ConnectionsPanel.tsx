'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, UserPlus, Check, X, Loader2, Users, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

function UserAvatar({ user, className }: { user: PublicUserSummary; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.username || ''} />}
      <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
        {initials(user)}
      </AvatarFallback>
    </Avatar>
  );
}

function UserIdentity({ user }: { user: PublicUserSummary }) {
  return (
    <div className="min-w-0 flex-1">
      {user.name && <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>}
      <p className="truncate text-xs text-slate-500">
        {user.username ? `@${user.username}` : 'No username'}
      </p>
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
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-slate-800">Friends</h2>
        {accepted.length > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {accepted.length}
          </span>
        )}
      </div>

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
          <Card className="divide-y divide-slate-100 overflow-hidden p-0">
            {visibleResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                {searching ? 'Searching…' : 'No matching people found.'}
              </p>
            ) : (
              visibleResults.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-2.5">
                  <UserAvatar user={user} />
                  <UserIdentity user={user} />
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
                </div>
              ))
            )}
          </Card>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-600">Requests</h3>
          <div className="space-y-2">
            {incoming.map((c) => (
              <Card key={c.friendshipId} className="flex items-center gap-3 p-3">
                <UserAvatar user={c.user} />
                <UserIdentity user={c.user} />
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => acceptRequest(c)}
                    disabled={busyId === c.friendshipId}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {busyId === c.friendshipId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteConnection(c, 'Request declined')}
                    disabled={busyId === c.friendshipId}
                  >
                    <X className="size-3.5" />
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing / pending */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-600">Sent</h3>
          <div className="space-y-2">
            {outgoing.map((c) => (
              <Card key={c.friendshipId} className="flex items-center gap-3 p-3">
                <UserAvatar user={c.user} />
                <UserIdentity user={c.user} />
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="size-3.5" />
                  Requested
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteConnection(c, 'Request canceled')}
                  disabled={busyId === c.friendshipId}
                >
                  {busyId === c.friendshipId ? <Loader2 className="size-3.5 animate-spin" /> : 'Cancel'}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Accepted friends */}
      {accepted.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accepted.map((c) => (
            <Card
              key={c.friendshipId}
              className="flex items-center gap-3 border-emerald-100 p-4 ring-1 ring-emerald-500/5"
            >
              <UserAvatar user={c.user} className="size-10" />
              <UserIdentity user={c.user} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRemoveTarget(c)}
                className="text-slate-500 hover:text-red-600"
              >
                Remove
              </Button>
            </Card>
          ))}
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
