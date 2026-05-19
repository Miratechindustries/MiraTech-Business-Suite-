'use client'

import React from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useAppStore } from '@/lib/store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen, user } = useAppStore();

  // If we don't even have a cached user, we might want to wait a bit 
  // but if we show the shell immediately, it feels faster.
  // We'll rely on the redirect in page.tsx if they aren't logged in.

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <Sidebar />
      <div 
        className={`flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'ml-60' : 'ml-16'
        }`}
      >
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
