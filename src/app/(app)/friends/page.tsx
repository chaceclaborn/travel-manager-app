'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, HeartHandshake, AlertCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FriendCard } from '@/components/travelmanager/FriendCard';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
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

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading friends">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Friends</h1>
          <div className="h-9 w-32 rounded-md bg-slate-200/80 animate-pulse" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-9 flex-1 rounded-md bg-slate-200/60 animate-pulse" />
          <div className="h-9 w-full sm:w-44 rounded-md bg-slate-200/60 animate-pulse" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.04]">
              <div className="h-5 w-3/5 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="mt-4 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-3/5 rounded bg-slate-200/60 animate-pulse" />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-2/5 rounded bg-slate-200/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading friends…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-6">
          <div className="size-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="size-10 text-red-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-red-100 flex items-center justify-center">
            <RefreshCw className="size-3.5 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Unable to load friends</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button onClick={fetchFriends} className="mt-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Friends</h1>

      <ConnectionsPanel />

      <div className="space-y-6 border-t border-slate-100 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <HeartHandshake className="size-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800">Contacts</h2>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/friends/new">
            <Plus className="mr-2 size-4" />
            New Contact
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name, email, or phone..."
            aria-label="Search contacts"
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sort friends">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="trips">Most trips</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {friends.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {friends.length} {friends.length === 1 ? 'contact' : 'contacts'}
        </p>
      )}

      {filtered.length === 0 ? (
        <TMEmptyState
          title={search ? 'No contacts found' : 'No contacts yet'}
          description={
            search
              ? 'Try adjusting your search terms.'
              : 'Add the people you travel with, then attach them to trips.'
          }
          actionLabel={search ? undefined : 'New Contact'}
          actionHref={search ? undefined : '/friends/new'}
          icon={HeartHandshake}
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {filtered.map((friend) => (
            <motion.div
              key={friend.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <FriendCard friend={friend} onSaved={loadFriends} onDeleted={loadFriends} />
            </motion.div>
          ))}
        </motion.div>
      )}
      </div>
    </div>
  );
}
