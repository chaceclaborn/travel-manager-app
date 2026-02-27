'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    trips: unknown[];
  };
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <Link href={`/clients/${client.id}`}>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <Card className="bg-white p-5 border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-xl">
          <h3 className="font-semibold text-lg text-slate-800" title={client.name}>{client.name}</h3>
          {client.company && (
            <p className="text-sm text-slate-500 mt-0.5">{client.company}</p>
          )}

          <div className="mt-3 space-y-1.5">
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="size-3.5 text-slate-400" />
                <a
                  href={`mailto:${client.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:text-amber-600 hover:underline"
                >
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="size-3.5 text-slate-400" />
                <a
                  href={`tel:${client.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-amber-600 hover:underline"
                >
                  {client.phone}
                </a>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {client.trips.length} {client.trips.length === 1 ? 'trip' : 'trips'}
          </p>
        </Card>
      </motion.div>
    </Link>
  );
}
