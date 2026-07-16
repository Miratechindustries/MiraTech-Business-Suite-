'use client';

import { useState, useEffect } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserStore } from '../lib/store';
import { LogOut, Users, Building2, ShieldAlert } from "lucide-react";
import { logout } from '../lib/firebase';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend, BarChart, Bar, CartesianGrid } from 'recharts';
import { motion } from "motion/react";
import AuditLogs from './AuditLogs';

const data = [
  { name: 'Mon', active: 120 },
  { name: 'Tue', active: 132 },
  { name: 'Wed', active: 101 },
  { name: 'Thu', active: 134 },
  { name: 'Fri', active: 90 },
  { name: 'Sat', active: 230 },
  { name: 'Sun', active: 210 },
];

const pieData = [
  { name: 'Companies', value: 400 },
  { name: 'Users', value: 300 },
  { name: 'Alerts', value: 300 },
];
const COLORS = ['#3b82f6', '#10b981', '#ef4444'];


export default function MasterAdminDashboard() {
  const { currentUser } = useUserStore();
  const [counts, setCounts] = useState({ companies: 0, users: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'errors'>('overview');

  useEffect(() => {
    async function fetchCounts() {
        try {
            const companiesSnapshot = await getCountFromServer(collection(db, 'companies'));
            const usersSnapshot = await getCountFromServer(collection(db, 'users'));
            const alertsSnapshot = await getCountFromServer(collection(db, 'audit_logs'));
            
            setCounts({
                companies: companiesSnapshot.data().count,
                users: usersSnapshot.data().count,
                alerts: alertsSnapshot.data().count
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    fetchCounts();
  }, []);

  if (currentUser?.email?.toLowerCase() !== 'miratechindustries@gmail.com') {
    return <div className="p-10 text-center font-sans text-slate-500">Access Denied</div>;
  }

  if (loading) return <div className="p-10 text-center font-sans text-slate-500">Loading system data...</div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div 
        className="space-y-8 font-sans"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
    >
      <motion.div className="flex items-center justify-between" variants={itemVariants}>
        <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
                {activeView === 'overview' ? 'System Overview' : 'Error Management Center'}
            </h1>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveView('overview')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeView === 'overview' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveView('errors')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeView === 'errors' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Errors
                </button>
            </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-slate-600 hover:text-red-600 font-bold text-sm transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </motion.div>
      
      {activeView === 'overview' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Companies", value: counts.companies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
              { title: "Users", value: counts.users, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
              { title: "Security Alerts", value: counts.alerts, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
            ].map((item, idx) => (
                <motion.div 
                    key={item.title} 
                    className="bg-white p-6 border border-slate-200 rounded-2xl"
                    variants={itemVariants}
                    transition={{ delay: idx * 0.1 }}
                >
                    <div className={`flex items-center gap-3 mb-4 ${item.color} ${item.bg} p-2 rounded-xl w-fit`}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-bold text-sm tracking-wide uppercase">{item.title}</span>
                    </div>
                    <p className="text-5xl font-extrabold text-slate-950">{item.value}</p>
                </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div className="bg-white p-6 border border-slate-200 rounded-2xl" variants={itemVariants}>
                <h3 className="font-bold text-slate-950 mb-6">Activity Distribution</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div className="bg-white p-6 border border-slate-200 rounded-2xl" variants={itemVariants}>
                <h3 className="font-bold text-slate-950 mb-6">User Trend</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="active" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
              </motion.div>
          </div>

          <motion.div className="bg-white p-6 border border-slate-200 rounded-2xl" variants={itemVariants}>
            <h3 className="font-bold text-slate-950 mb-6">User Activity (Last 7 Days)</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={data}>
                   <defs>
                     <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                       <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                   <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                   <Tooltip />
                   <Area type="monotone" dataKey="active" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActive)" strokeWidth={2} />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <AuditLogs userLogsOnly={true} />
          </motion.div>
        </>
      ) : (
          <motion.div variants={itemVariants} className="bg-white p-8 border border-slate-200 rounded-2xl text-center text-slate-500">
              Error Management Center Coming Soon
          </motion.div>
      )}
    </motion.div>
  );
}
