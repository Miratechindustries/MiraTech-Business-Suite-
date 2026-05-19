'use client'

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  ChevronLeft,
  Menu,
  BarChart2,
  CreditCard,
  Shield
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { auth } from '@/lib/firebase';

const routes = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Inventory', icon: Package, href: '/dashboard/inventory' },
  { label: 'Customers', icon: Users, href: '/dashboard/customers' },
  { label: 'Quotations', icon: FileText, href: '/dashboard/quotations' },
  { label: 'Invoices', icon: FileText, href: '/dashboard/invoices' },
  { label: 'Receipts', icon: FileText, href: '/dashboard/receipts' },
  { label: 'Transactions', icon: CreditCard, href: '/dashboard/transactions' },
  { label: 'Reports & Analytics', icon: BarChart2, href: '/dashboard/reports' },
  { label: 'Audit Logs', icon: Shield, href: '/dashboard/audit-logs' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, toggleSidebar } = useAppStore();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/auth/login');
  };

  return (
    <aside 
      className={`${isSidebarOpen ? 'w-60' : 'w-16'} fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300 ease-in-out dark:bg-slate-900`}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {isSidebarOpen && (
          <span className="text-lg font-bold text-slate-800 dark:text-white">Mira Suite</span>
        )}
        <button 
          onClick={toggleSidebar}
          className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <nav className="mt-4 space-y-1 px-2">
        {routes.map((route) => {
          const Icon = route.icon;
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {isSidebarOpen && <span>{route.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 w-full px-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {isSidebarOpen && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
