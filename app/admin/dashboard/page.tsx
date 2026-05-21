'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Users, 
  Building, 
  Shield, 
  Activity, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Terminal as TerminalIcon,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Business, AuditLog, Transaction, Subscription, SubscriptionPlan } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import AddCompanyModal from '@/components/AddCompanyModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function MasterAdminDashboardPage() {
  const { user } = useAppStore();
  const isAuthorized = user?.role === 'MASTER_ADMIN';
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;
    setRefreshing(true);
    try {
      const bizQuery = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
      const userQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const logsQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(25));
      const transQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(100));
      const subsQuery = query(collection(db, 'subscriptions'));
      const plansQuery = query(collection(db, 'plans'));
      
      const [bizSnapshot, userSnapshot, logsSnapshot, transSnapshot, subsSnapshot, plansSnapshot] = await Promise.all([
        getDocs(bizQuery),
        getDocs(userQuery),
        getDocs(logsQuery),
        getDocs(transQuery),
        getDocs(subsQuery),
        getDocs(plansQuery)
      ]);
      
      setBusinesses(bizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business)));
      setUsers(userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setAuditLogs(logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setTransactions(transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setSubscriptions(subsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
      setPlans(plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionPlan)));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Calculations
  const revenueData = useMemo(() => {
    // Monthly segments for last 12 months
    const now = new Date();
    const months = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setMonth(now.getMonth() - (11 - i));
      return {
        month: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        revenue: 0,
        count: 0
      };
    });

    // Handle zero state
    if (transactions.length === 0 && businesses.length === 0) {
      // Keep simulation only if the entire platform is empty to show how it looks
      return months.map((m, i) => ({
        ...m,
        revenue: 8000 + (Math.sin(i * 0.5) * 2000),
        count: 5 + i
      }));
    }

    transactions.forEach(t => {
      if (t.type === 'income') {
        const date = new Date(t.date);
        const m = date.toLocaleString('default', { month: 'short' });
        const y = date.getFullYear();
        const entry = months.find(item => item.month === m && item.year === y);
        if (entry) {
          entry.revenue += t.amount;
          entry.count++;
        }
      }
    });

    return months;
  }, [transactions, businesses]);

  const businessStatusData = useMemo(() => {
    const counts = businesses.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([name, value]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1), 
      value 
    }));
  }, [businesses]);

  const currentRevenue = useMemo(() => revenueData[revenueData.length - 1].revenue, [revenueData]);
  const prevRevenue = useMemo(() => revenueData[revenueData.length - 2].revenue, [revenueData]);
  const revenueGrowth = prevRevenue === 0 ? 0 : ((currentRevenue - prevRevenue) / prevRevenue) * 100;

  const mrr = useMemo(() => {
    return subscriptions.reduce((acc, sub) => {
      if (sub.status !== 'active') return acc;
      const plan = plans.find(p => p.id === sub.planId);
      if (!plan) return acc;
      return acc + (plan.interval === 'yearly' ? plan.price / 12 : plan.price);
    }, 0);
  }, [subscriptions, plans]);

  const businessTrend = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const currentMonthUnits = businesses.filter(b => b.createdAt >= lastMonth).length;
    const totalBefore = businesses.length - currentMonthUnits;
    if (totalBefore === 0) return 0;
    return (currentMonthUnits / totalBefore) * 100;
  }, [businesses]);

  const userTrend = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const currentMonthUsers = users.filter(u => (u as any).createdAt >= lastMonth).length;
    const totalBeforeValue = users.length - currentMonthUsers;
    if (totalBeforeValue === 0) return 0;
    return (currentMonthUsers / totalBeforeValue) * 100;
  }, [users]);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Shield className="h-16 w-16 text-slate-200 mb-4" />
        <h1 className="text-xl font-bold text-slate-800">Authorization Required</h1>
        <p className="text-slate-500 mt-2">Access restricted to master administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Hydrating Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mb-1 italic">Sector: Global Oversight</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Platform_Command_</h1>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={fetchData}
            className={`p-3 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCcw size={18} className="text-slate-600" />
          </button>
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest italic"
          >
            <Plus size={18} />
            Provision_Entity
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'EST. MRR', 
            val: `$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 
            icon: DollarSign, 
            trend: revenueGrowth,
            color: 'blue' 
          },
          { 
            label: 'Total Businesses', 
            val: businesses.length, 
            icon: Building, 
            trend: businessTrend,
            color: 'indigo'
          },
          { 
            label: 'Active Users', 
            val: users.length, 
            icon: Users, 
            trend: userTrend,
            color: 'emerald'
          },
          { 
            label: 'Uptime', 
            val: '99.98%', 
            icon: Activity, 
            trend: 0.01,
            color: 'amber'
          }
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={20} />
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-bold ${kpi.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpi.trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(kpi.trend).toFixed(1)}%
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1">{kpi.val}</h3>
          </div>
        ))}
      </div>

      {/* Primary Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Platform Growth & Revenue</h3>
              <p className="text-sm text-slate-500 font-medium">Monthly aggregate performance metrics</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button className="px-3 py-1 text-xs font-bold rounded-lg bg-white shadow-sm">Revenue</button>
              <button className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-900">Traffic</button>
            </div>
          </div>
          <div className="h-[250px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(v) => `$${v >= 1000 ? `${v/1000}k` : v}`}
                />
                <Tooltip 
                  cursor={{ stroke: '#2563eb', strokeWidth: 2 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#2563eb" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#chartGradient)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Activity size={120} />
          </div>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Operational Health
          </h3>
          
          <div className="h-[200px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={businessStatusData}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {businessStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
               <span className="text-2xl font-black">{businesses.length}</span>
               <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Units</span>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {businessStatusData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-slate-400 font-medium group-hover:text-white transition-colors">{item.name}</span>
                </div>
                <span className="font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal and Feeds Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit Log Terminal */}
        <div className="bg-[#0c0c0e] rounded-3xl border border-slate-800 shadow-2xl flex flex-col h-[450px]">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TerminalIcon size={16} className="text-blue-500" />
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-[0.3em]">Live_Audit_Sync</span>
            </div>
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700 animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 p-5 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar text-blue-100/70 space-y-1 bg-[#0c0c0e]">
            {auditLogs.length > 0 ? auditLogs.map((log) => (
              <div key={log.id} className="hover:bg-blue-500/5 py-0.5 rounded transition-colors group">
                <span className="text-slate-600 mr-2 opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="text-blue-500 font-bold group-hover:text-blue-400">@SYSTEM</span>{' '}
                <span className="text-slate-500">&gt;&gt;</span>{' '}
                <span className="text-emerald-500 uppercase">{log.action || 'TRANSACTION_EVENT'}</span>{' '}
                <span className="text-slate-600">REQ_UID:</span>{' '}
                <span className="text-indigo-400">#{log.id.slice(0, 8)}</span>{' '}
                <span className="text-slate-500">RES_ID:</span>{' '}
                <span className="text-amber-500">{log.resourceId || 'internal'}</span>
              </div>
            )) : (
              <div className="flex items-center gap-2 text-slate-700 italic py-2">
                <RefreshCcw className="animate-spin h-3 w-3" />
                Synchronizing with primary blockchain node...
              </div>
            )}
            <div className="flex items-center gap-2 text-blue-500/50 pt-2 animate-pulse">
              <span className="block w-2 h-4 bg-blue-500/50"></span>
              STREAMING_LATEST_EVENTS...
            </div>
          </div>
        </div>

        {/* Business Feed */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-900 italic tracking-tight">Recent Onboarding</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">LIVE FEED</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
             {businesses.slice(0, 10).map((biz) => (
               <div key={biz.id} className="p-4 hover:bg-slate-50/80 transition-all rounded-2xl flex items-center justify-between group">
                 <div className="flex items-center gap-4">
                   <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                     {biz.name[0]}
                   </div>
                   <div>
                     <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{biz.name}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                       <Clock size={10} />
                       {new Date(biz.createdAt).toLocaleDateString()}
                     </p>
                   </div>
                 </div>
                 <div className="flex flex-col items-end gap-1">
                   <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${
                      biz.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      biz.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      'bg-slate-50 text-slate-400 border-slate-100'
                   }`}>
                     {biz.status}
                   </span>
                   <button className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                     VIEW_PROFILE_&rarr;
                   </button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      <AddCompanyModal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        onCompanyAdded={fetchData}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
