'use client'

import React, { useEffect, useState, useCallback } from 'react';
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
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { Transaction, Product, Customer } from '@/lib/types';

export default function DashboardPage() {
  const { business, isLoading } = useAppStore();
  const [stats, setStats] = useState({ revenue: 0, customers: 0, inventory: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (businessId: string) => {
      setLoading(true);

      // Fetch stats
      const transQuery = query(collection(db, 'transactions'), where('businessId', '==', businessId));
      const custQuery = query(collection(db, 'customers'), where('businessId', '==', businessId));
      const prodQuery = query(collection(db, 'products'), where('businessId', '==', businessId));
      const recentTransQuery = query(collection(db, 'transactions'), where('businessId', '==', businessId), orderBy('date', 'desc'), limit(5));

      const [transSnap, custSnap, prodSnap, recentTransSnap] = await Promise.all([
        getDocs(transQuery),
        getDocs(custQuery),
        getDocs(prodQuery),
        getDocs(recentTransQuery)
      ]);

      const transactions = transSnap.docs.map(d => d.data() as Transaction);
      const revenue = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const inventory = prodSnap.docs.map(d => d.data() as Product).reduce((acc, p) => acc + p.stockQuantity, 0);
      
      setStats({
        revenue,
        customers: custSnap.size,
        inventory
      });
      setTransactions(recentTransSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!business) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    fetchData(business.id);
  }, [business, isLoading, fetchData]);

  if (isLoading || loading) return <div className="p-8">Loading dashboard...</div>;
  if (!business) return <div className="p-8">No business associated with your account.</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Welcome back to {business.name}.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="group rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue (Income)</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{business.currency} {stats.revenue.toLocaleString()}</h3>
          </div>
        </div>
        <div className="group rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Customers</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.customers}</h3>
          </div>
        </div>
        <div className="group rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Package size={24} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Items in Stock</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.inventory}</h3>
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
                <th className="pb-4 pt-0">Description</th>
                <th className="pb-4 pt-0">Type</th>
                <th className="pb-4 pt-0">Date</th>
                <th className="pb-4 pt-0 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {transactions.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-4 text-sm font-bold text-slate-900 dark:text-white">{item.description}</td>
                  <td className="py-4 text-sm text-slate-600 dark:text-slate-400 capitalize">{item.type}</td>
                  <td className="py-4 text-sm text-slate-500">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="py-4 text-right text-sm font-black text-slate-900 dark:text-white">{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
