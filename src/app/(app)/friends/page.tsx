'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, HeartHandshake } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FriendCard } from '@/components/travelmanager/FriendCard';
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMCardGridSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { ConnectionsPanel } from '@/components/travelmanager/ConnectionsPanel';

interface Friend {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  trips: unknown[];
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-az');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // All setState happens in async continuations (initial loading/error state
  // already covers the sync phase), keeping the mount effect side-effect-only.
  const loadFriends = useCallback(() => {
    return fetch('/api/friends')
      .then((res) => res.json())
      .then((data) => {
        setFriends(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Full refresh with skeleton — used by the error-state retry button.
  const fetchFriends = () => {
    setLoading(true);
    setError(false);
    loadFriends();
  };

  const filtered = useMemo(() => {
    const result = search.trim()
      ? friends.filter((f) => {
          const q = search.toLowerCase();
          return (
            f.name.toLowerCase().includes(q) ||
            f.email?.toLowerCase().includes(q) ||
            f.phone?.toLowerCase().includes(q)
          );
        })
      : [...friends];

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'trips':
          return b.trips.length - a.trips.length;
        default:
          return 0;
      }
    });

    return result;
  }, [friends, search, sortBy]);

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title="Friends"
        subtitle={loading ? undefined : `People you travel with \u00B7 ${friends.length}`}
        actions={
          <Link href="/friends/new" className="tm-btn tm-btn-primary">
            Add Friend
          </Link>
        }
        mobileAction={
          <Link href="/friends/new" className="tm-btn tm-btn-primary h-[34px] px-[13px]">
            <Plus className="size-3.5" aria-hidden="true" />
            Add
          </Link>
        }
      />

      <div className="pt-5 md:pt-7">
        <ConnectionsPanel />
      </div>

      <div className="mt-6 border-t border-tm-divider pt-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts"
              aria-label="Search contacts"
              className="tm-input pl-[34px]"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Sort friends">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-az">Name \u00B7 A\u2013Z</SelectItem>
              <SelectItem value="name-za">Name \u00B7 Z\u2013A</SelectItem>
              <SelectItem value="trips">Most trips</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-5">
          {loading ? (
            <TMCardGridSkeleton count={6} columns={3} />
          ) : error ? (
            <div className="tm-card">
              <TMErrorState
                title="Couldn't load your friends"
                description="Something went wrong on our end. Your data is safe \u2014 nothing was lost."
                onRetry={fetchFriends}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="tm-card">
              {friends.length === 0 ? (
                <TMEmptyState
                  title="No friends yet"
                  description="Add the people you travel with, then attach them to trips."
                  actionLabel="Add Friend"
                  actionHref="/friends/new"
                  icon={HeartHandshake}
                />
              ) : (
                <TMFilteredEmpty noun="contacts" query={search} onClear={() => setSearch('')} />
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((friend, i) => (
                <FriendCard key={friend.id} friend={friend} index={i} onSaved={loadFriends} onDeleted={loadFriends} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TMPageShell>
  );
}
