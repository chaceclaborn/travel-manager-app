'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, Download, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface TMUserMenuProps {
  user: User;
  onSignOut: () => void;
}

export function TMUserMenu({ user, onSignOut }: TMUserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || 'User';
  const email = user.email || '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleExport() {
    setOpen(false);
    try {
      const res = await fetch('/api/user/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travelmanager-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        aria-label="User menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="size-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2 w-64 rounded-lg bg-slate-900 border border-white/10 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-medium text-white truncate">{fullName}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings className="size-4" />
              Settings
            </Link>
            <button
              onClick={handleExport}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Download className="size-4" />
              Export Data
            </button>
          </div>

          <div className="border-t border-white/10 py-1">
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
