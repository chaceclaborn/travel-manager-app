'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VendorCard } from '@/components/travelmanager/VendorCard';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';

const CATEGORIES = ['ALL', 'SUPPLIER', 'HOTEL', 'TRANSPORT', 'RESTAURANT', 'OTHER'] as const;

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name-az');

  useEffect(() => {
    fetch('/api/vendors')
      .then((res) => res.json())
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const result = vendors.filter((v) => {
      const matchesSearch =
        !search ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.city && v.city.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return result;
  }, [vendors, search, categoryFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-white border border-slate-100 p-5">
              <div className="flex justify-between mb-3">
                <div className="h-5 w-2/3 rounded bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/vendors/new">
            <Plus className="mr-2 size-4" />
            New Vendor
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && vendors.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {vendors.length} vendors
        </p>
      )}

      {filtered.length === 0 ? (
        <TMEmptyState
          title={vendors.length === 0 ? 'No vendors yet' : 'No matching vendors'}
          description={
            vendors.length === 0
              ? 'Create your first vendor to get started.'
              : 'Try adjusting your search or filters.'
          }
          actionLabel={vendors.length === 0 ? 'New Vendor' : undefined}
          actionHref={vendors.length === 0 ? '/vendors/new' : undefined}
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {filtered.map((vendor) => (
            <motion.div
              key={vendor.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <VendorCard vendor={vendor} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
