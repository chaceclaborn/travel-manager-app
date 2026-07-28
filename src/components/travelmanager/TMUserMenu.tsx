'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, Download, LogOut, ChevronsUpDown } from 'lucide-react';
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
  /**
   * `avatar` — a bare 32px circle. Used where space is tight.
   * `chip` — the full-width sidebar footer chip: avatar, name, email, and a
   *   ChevronsUpDown affordance. This replaced the top-bar avatar; the account
   *   now lives at the bottom of the sidebar, next to Settings, where the rest
   *   of the "about you" controls already were.
   */
  variant?: 'avatar' | 'chip';
}

export function TMUserMenu({ user, onSignOut, variant = 'avatar' }: TMUserMenuProps) {
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

  const avatar = (size: number) =>
    avatarUrl && !imageError ? (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    ) : (
      <span
        className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ width: size, height: size, background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
        aria-hidden="true"
      >
        {initials}
      </span>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'chip' ? (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            aria-label="Account menu"
          >
            {avatar(30)}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-tm-on-dark">{fullName}</span>
              <span className="block truncate text-[10px] text-tm-nav-meta">{email}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-tm-nav-icon" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="User menu"
          >
            {avatar(32)}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={variant === 'chip' ? 'start' : 'end'}
        side={variant === 'chip' ? 'top' : 'bottom'}
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
