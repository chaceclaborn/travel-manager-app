'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, Download, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface TMUserMenuProps {
  user: User;
  onSignOut: () => void;
}

export function TMUserMenu({ user, onSignOut }: TMUserMenuProps) {
  const [imageError, setImageError] = useState(false);

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || 'User';
  const email = user.email || '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleExport() {
    try {
      const res = await fetch('/api/user/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travelmanager-export-${new Date().toLocaleDateString('en-CA')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="User menu"
        >
          {avatarUrl && !imageError ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={32}
              height={32}
              className="rounded-full"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="size-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-64 max-w-64 rounded-lg bg-slate-900 border border-white/10 shadow-xl text-slate-300 p-0 overflow-hidden"
      >
        <DropdownMenuLabel className="px-4 py-3 border-b border-white/10 font-normal">
          <p className="text-sm font-medium text-white truncate">{fullName}</p>
          <p className="text-xs text-slate-400 truncate">{email}</p>
        </DropdownMenuLabel>

        <div className="py-1">
          <DropdownMenuItem
            asChild
            className="rounded-none focus:bg-white/5 focus:text-white"
          >
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleExport}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 rounded-none focus:bg-white/5 focus:text-white"
          >
            <Download className="size-4" />
            Export Data
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="bg-white/10 mx-0 my-0" />

        <div className="py-1">
          <DropdownMenuItem
            onSelect={() => onSignOut()}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 rounded-none focus:bg-white/5 focus:text-red-300"
          >
            <LogOut className="size-4" />
            Sign Out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
