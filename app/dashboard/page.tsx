'use client'

import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const data = [
  { name: 'Jan', revenue: 4000, orders: 240 },
  { name: 'Feb', revenue: 3000, orders: 198 },
  { name: 'Mar', revenue: 2000, orders: 980 },
  { name: 'Apr', revenue: 2780, orders: 390 },
  { name: 'May', revenue: 1890, orders: 480 },
  { name: 'Jun', revenue: 2390, orders: 380 },
  { name: 'Jul', revenue: 3490, orders: 430 },
];

const stats = [
  { label: 'Total Revenue', value: '$128,430', change: '+12.5%', icon: DollarSign, trend: 'up' },
  { label: 'Active Customers', value: '1,234', change: '+3.2%', icon: Users, trend: 'up' },
  { label: 'Products in stock', value: '456', change: '-2.1%', icon: Package, trend: 'down' },
  { label: 'Sales Growth', value: '24.5%', change: '+4.3%', icon: TrendingUp, trend: 'up' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Welcome back to your business control panel.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">May 1 2026 - May 18 2026</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/20 dark:text-blue-400">
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Analysis</h3>
            <select className="rounded-md border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F8FAFC'
                  }} 
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Order Volume</h3>
            <div className="flex gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#F1F5F9'}}
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#F8FAFC'
                  }} 
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-6 text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="pb-4 pt-0">Reference</th>
                <th className="pb-4 pt-0">Customer</th>
                <th className="pb-4 pt-0">Status</th>
                <th className="pb-4 pt-0">Date</th>
                <th className="pb-4 pt-0 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {[
                { ref: 'INV-2026-001', name: 'Acme Corp', status: 'Paid', date: '2026-05-18', amount: '$4,250.00' },
                { ref: 'INV-2026-002', name: 'Global Tech', status: 'Pending', date: '2026-05-17', amount: '$1,820.00' },
                { ref: 'INV-2026-003', name: 'Stark Ind.', status: 'Paid', date: '2026-05-16', amount: '$12,400.00' },
                { ref: 'INV-2026-004', name: 'Wayne Ent.', status: 'Overdue', date: '2026-05-15', amount: '$3,150.00' },
              ].map((item, i) => (
                <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-4 text-sm font-bold text-slate-900 dark:text-white">{item.ref}</td>
                  <td className="py-4 text-sm text-slate-600 dark:text-slate-400">{item.name}</td>
                  <td className="py-4">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-tight ${
                      item.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-slate-500">{item.date}</td>
                  <td className="py-4 text-right text-sm font-black text-slate-900 dark:text-white">{item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
