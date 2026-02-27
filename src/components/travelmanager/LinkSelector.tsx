'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface LinkSelectorProps {
  items: { id: string; name: string }[];
  linkedIds: string[];
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  type: 'vendor' | 'client';
  isLoading?: boolean;
}

export function LinkSelector({
  items,
  linkedIds,
  onLink,
  onUnlink,
  type,
  isLoading,
}: LinkSelectorProps) {
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentlyLinkedId, setRecentlyLinkedId] = useState<string | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const unlinkedItems = items.filter((item) => !linkedIds.includes(item.id));
  const filteredUnlinked = unlinkedItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );
  const linkedItems = items.filter((item) => linkedIds.includes(item.id));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    setSearch(name);
    setIsOpen(false);
  };

  const handleAdd = () => {
    if (selectedId) {
      onLink(selectedId);
      setRecentlyLinkedId(selectedId);
      setSelectedId('');
      setSearch('');
      setTimeout(() => setRecentlyLinkedId(null), 1500);
    }
  };

  const handleInputChange = (value: string) => {
    setSearch(value);
    setSelectedId('');
    if (!isOpen) setIsOpen(true);
  };

  const hasNoItems = items.length === 0;
  const allLinked = !hasNoItems && unlinkedItems.length === 0;

  return (
    <div className="space-y-3">
      {hasNoItems ? (
        <p className="text-sm text-slate-500">
          No {type}s yet &mdash;{' '}
          <Link
            href={`/${type}s/new`}
            className="text-amber-600 underline hover:text-amber-700"
          >
            create one first
          </Link>
        </p>
      ) : allLinked ? (
        <p className="text-sm text-slate-500 italic">All {type}s are already linked</p>
      ) : (
        <div className="flex items-start gap-2">
          <div ref={comboboxRef} className="relative flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setIsOpen(true)}
                placeholder={`Search ${type}s to add...`}
                disabled={isLoading}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus(); }}
                className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isOpen && (
              <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {filteredUnlinked.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500 italic">
                    No {type}s found
                  </li>
                ) : (
                  filteredUnlinked.map((item) => (
                    <li
                      key={item.id}
                      onClick={() => handleSelect(item.id, item.name)}
                      className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-amber-50 hover:text-amber-900 ${
                        selectedId === item.id ? 'bg-amber-50 text-amber-900 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {item.name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <Button
            onClick={handleAdd}
            disabled={!selectedId || isLoading}
            size="sm"
            className="shrink-0"
          >
            Add
          </Button>
        </div>
      )}

      {linkedItems.length > 0 && (
        <ul className="space-y-2">
          {linkedItems.map((item) => (
            <li
              key={item.id}
              className={`flex items-center justify-between rounded-lg border p-2 text-sm transition-colors duration-700 ${
                recentlyLinkedId === item.id ? 'bg-green-50 border-green-300' : ''
              }`}
            >
              <span>{item.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUnlink(item.id)}
                disabled={isLoading}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
