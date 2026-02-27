'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TMBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function TMBreadcrumb({ items }: TMBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 overflow-x-auto">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
          {i > 0 && <ChevronRight className="size-3.5 text-slate-400 shrink-0" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-amber-600 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-800 font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
