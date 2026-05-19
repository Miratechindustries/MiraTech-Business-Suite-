import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Building, Settings, BarChart, CreditCard } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r bg-white p-6">
        <h2 className="text-xl font-bold mb-8 italic tracking-tight">PLATFORM_ADMIN</h2>
        <nav className="space-y-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/admin/businesses" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <Building size={18} /> Businesses
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <Users size={18} /> Users
          </Link>
          <Link href="/admin/subscriptions" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <CreditCard size={18} /> Subscriptions
          </Link>
          <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <BarChart size={18} /> Analytics
          </Link>
          <div className="pt-8 opacity-20 border-t border-slate-100 mt-8"></div>
          <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <Settings size={18} /> Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
