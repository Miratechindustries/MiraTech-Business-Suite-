import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Building, Settings, BarChart } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r bg-white p-6">
        <h2 className="text-xl font-bold mb-8">Admin Panel</h2>
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-100">
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </Link>
          <Link href="/admin/businesses" className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-100">
            <Building className="h-5 w-5" /> Businesses
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-100">
            <Users className="h-5 w-5" /> Users
          </Link>
          <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-100">
            <BarChart className="h-5 w-5" /> Analytics
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-100">
            <Settings className="h-5 w-5" /> Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
