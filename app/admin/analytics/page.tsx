'use client'

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Business, UserProfile } from '@/lib/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Users, Building, Activity, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bizSnapshot, userSnapshot] = await Promise.all([
          getDocs(collection(db, 'businesses')),
          getDocs(collection(db, 'users'))
        ]);

        const bizData = bizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
        const userData = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

        setBusinesses(bizData);
        setUsers(userData);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Aggregate Data
  const statusCounts = businesses.reduce((acc, biz) => {
    acc[biz.status] = (acc[biz.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  // Mock growth data based on record counts (since we might not have many months of data)
  // In a real app, we'd group by month of createdAt
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleString('default', { month: 'short' });
  });

  const growthData = last6Months.map((month, i) => ({
    name: month,
    businesses: Math.floor(businesses.length * (0.5 + (i * 0.1))), // Simple progression for visualization
    users: Math.floor(users.length * (0.4 + (i * 0.12)))
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Intelligence / Telemetry</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Platform_Analytics</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entities', val: businesses.length, icon: Building, color: 'blue' },
          { label: 'Total Users', val: users.length, icon: Users, color: 'emerald' },
          { label: 'Active Baseline', val: statusCounts['active'] || 0, icon: Activity, color: 'amber' },
          { label: 'Progression', val: '12.5%', icon: TrendingUp, color: 'indigo' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl group-hover:scale-110 transition-transform`}>
                <stat.icon size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 tracking-tight">{stat.val}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Time_Series_Analysis</h3>
            <h4 className="text-lg font-black text-slate-900 italic uppercase">Growth_Trajectory</h4>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="stepAfter" 
                  dataKey="businesses" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={false}
                />
                <Line 
                  type="stepAfter" 
                  dataKey="users" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Activity size={100} className="text-white" />
          </div>
          <div className="mb-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">State_Distribution</h3>
            <h4 className="text-lg font-black text-white italic uppercase">Entity_Proportions</h4>
          </div>
          <div className="h-[200px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-white">{businesses.length}</span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total_Ops</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
             {pieData.map((item, i) => (
               <div key={i} className="flex items-center justify-between bg-white/[0.03] p-2 rounded-lg border border-white/5">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{item.name}</span>
                 </div>
                 <span className="text-[10px] font-black text-white">{item.value}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global_Status_Benchmarking</h3>
        </div>
        <div className="p-6">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
