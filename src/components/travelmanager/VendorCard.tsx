'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Mail, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const categoryColors: Record<string, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-700',
  HOTEL: 'bg-purple-100 text-purple-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  RESTAURANT: 'bg-green-100 text-green-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

interface VendorCardProps {
  vendor: {
    id: string;
    name: string;
    category: string;
    city?: string | null;
    state?: string | null;
    email?: string | null;
    phone?: string | null;
    trips?: any[];
  };
}

export function VendorCard({ vendor }: VendorCardProps) {
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const tripCount = vendor.trips?.length || 0;
  const colorClass = categoryColors[vendor.category] || categoryColors.OTHER;
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();

  return (
    <Link href={`/vendors/${vendor.id}`}>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <Card className="p-5 bg-white border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-lg text-slate-800 line-clamp-1" title={vendor.name}>{vendor.name}</h3>
            <Badge className={`${colorClass} border-0 shrink-0 ml-2`}>
              {categoryLabel}
            </Badge>
          </div>

          {location && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
              <MapPin className="size-3.5" />
              <span>{location}</span>
            </div>
          )}

          {vendor.email && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
              <Mail className="size-3.5" />
              <a
                href={`mailto:${vendor.email}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:text-amber-600 hover:underline"
              >
                {vendor.email}
              </a>
            </div>
          )}

          {vendor.phone && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
              <Phone className="size-3.5" />
              <a
                href={`tel:${vendor.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-amber-600 hover:underline"
              >
                {vendor.phone}
              </a>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">
            {tripCount} {tripCount === 1 ? 'trip' : 'trips'}
          </p>
        </Card>
      </motion.div>
    </Link>
  );
}
