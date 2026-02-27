'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientCard } from '@/components/travelmanager/ClientCard';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  trips: unknown[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-az');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const result = search.trim()
      ? clients.filter((c) => {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q)
          );
        })
      : [...clients];

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'company':
          return (a.company || '').localeCompare(b.company || '');
        default:
          return 0;
      }
    });

    return result;
  }, [clients, search, sortBy]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-28 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-white border border-slate-100 p-5">
              <div className="h-5 w-2/3 rounded bg-slate-200" />
              <div className="mt-1.5 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/clients/new">
            <Plus className="mr-2 size-4" />
            New Client
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, company, or email..."
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-slate-500">
        Showing {filtered.length} of {clients.length} clients
      </p>

      {filtered.length === 0 ? (
        <TMEmptyState
          title={search ? 'No clients found' : 'No clients yet'}
          description={
            search
              ? 'Try adjusting your search terms.'
              : 'Create your first client to get started.'
          }
          actionLabel={search ? undefined : 'New Client'}
          actionHref={search ? undefined : '/clients/new'}
          icon={Users}
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
          {filtered.map((client) => (
            <motion.div
              key={client.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <ClientCard client={client} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
