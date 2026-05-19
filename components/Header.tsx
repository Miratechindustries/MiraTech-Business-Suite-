'use client'

import { Bell, Search, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import Link from 'next/link';

export function Header() {
  const { user, business } = useAppStore();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/80 px-6 backdrop-blur dark:bg-slate-900/80">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Quick search..." 
            className="h-9 w-full rounded-md border-slate-200 bg-slate-50 pl-9 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 px-2"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right md:block">
          <p className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{business?.name || 'Mira Suite'}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.role?.replace('_', ' ') || 'Staff Access'}</p>
        </div>

        <Link href="/dashboard/notifications" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-blue-500 dark:border-slate-900 animate-pulse" />
        </Link>

        <Link href="/dashboard/settings" className="relative h-8 w-8 overflow-hidden rounded-full border bg-slate-100 dark:border-slate-800 transition-transform hover:scale-105 active:scale-95 shadow-sm">
          {user?.photoURL ? (
            <Image 
              src={user.photoURL} 
              alt="User" 
              fill 
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-600 text-xs font-bold text-white uppercase italic">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
