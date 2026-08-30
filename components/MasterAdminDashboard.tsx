'use client';

import { useState, useEffect } from 'react';
import { collection, getCountFromServer, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserStore } from '../lib/store';
import { LogOut, Users, Building2, ShieldAlert, AlertTriangle, CheckCircle, Activity, Server, Clock, Download, CloudUpload, HardDrive } from "lucide-react";
import { logout, getAccessToken } from '../lib/firebase';
import { uploadBackupToGoogleDrive } from '../lib/drive';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend, BarChart, Bar, CartesianGrid } from 'recharts';
import { motion } from "motion/react";
import AuditLogs from './AuditLogs';

export default function MasterAdminDashboard() {
  const { currentUser } = useUserStore();
  const [counts, setCounts] = useState({ companies: 0, users: 0, alerts: 0, errors: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'health' | 'errors' | 'apm' | 'audit' | 'backup'>('overview');
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [apmMetrics, setApmMetrics] = useState<any[]>([]);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    async function fetchCountsAndErrors() {
        try {
            const companiesSnapshot = await getCountFromServer(collection(db, 'companies'));
            const usersSnapshot = await getCountFromServer(collection(db, 'users'));
            const alertsSnapshot = await getCountFromServer(collection(db, 'audit_logs'));
            const errorsSnapshot = await getCountFromServer(collection(db, 'error_logs'));
            
            setCounts({
                companies: companiesSnapshot.data().count,
                users: usersSnapshot.data().count,
                alerts: alertsSnapshot.data().count,
                errors: errorsSnapshot.data().count
            });

            const errorsQuery = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'), limit(50));
            const errorsSnap = await getDocs(errorsQuery);
            setErrorLogs(errorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const apmQuery = query(collection(db, 'apm_metrics'), orderBy('timestamp', 'desc'), limit(50));
            const apmSnap = await getDocs(apmQuery);
            setApmMetrics(apmSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const backupQuery = query(collection(db, 'backup_history'), orderBy('timestamp', 'desc'), limit(20));
            const backupSnap = await getDocs(backupQuery);
            setBackupHistory(backupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    fetchCountsAndErrors();
  }, []);

  const handleResolveError = async (id: string) => {
    try {
      await updateDoc(doc(db, 'error_logs', id), { resolved: true });
      setErrorLogs(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus("Generating system data snapshot...");
    try {
      const token = currentUser ? await currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupType: 'manual' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup generation failed');

      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miratech-suite-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStatus("Local JSON backup successfully downloaded!");
      const backupSnap = await getDocs(query(collection(db, 'backup_history'), orderBy('timestamp', 'desc'), limit(20)));
      setBackupHistory(backupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      setBackupStatus(`Backup error: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDriveBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus("Exporting tenant data & connecting to Google Drive...");
    try {
      const token = currentUser ? await currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupType: 'automated-drive' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup generation failed');

      const fileName = `miratech-backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const driveToken = await getAccessToken();
      const fileId = await uploadBackupToGoogleDrive(data.backup, fileName, driveToken || undefined);
      const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

      await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-action': 'log-history'
        },
        body: JSON.stringify({
          backupType: 'automated-drive',
          status: 'success',
          driveFileId: fileId,
          driveUrl
        })
      });

      setBackupStatus(`Successfully uploaded backup to Google Drive under MiraTechBusinessSuite/backup/ (File ID: ${fileId})`);
      const backupSnap = await getDocs(query(collection(db, 'backup_history'), orderBy('timestamp', 'desc'), limit(20)));
      setBackupHistory(backupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      setBackupStatus(`Google Drive backup error: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  if (currentUser?.email?.toLowerCase() !== 'miratechindustries@gmail.com') {
    return <div className="p-10 text-center font-sans text-slate-500">Access Denied</div>;
  }

  if (loading) return <div className="p-10 text-center font-sans text-slate-500">Loading system data & telemetry...</div>;

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
                {activeView === 'overview' ? 'System Overview' : 
                 activeView === 'health' ? 'System Health & Request Rate' :
                 activeView === 'errors' ? 'Error Tracking & Observability' : 
                 activeView === 'apm' ? 'APM Performance & Uptime' : 
                 activeView === 'audit' ? 'Security Audit Log' : 'Data & Recovery'}
            </h1>
            <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
                <button 
                    onClick={() => setActiveView('overview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeView === 'overview' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveView('health')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'health' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    Health
                </button>
                <button 
                    onClick={() => setActiveView('errors')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'errors' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    Errors ({counts.errors})
                </button>
                <button 
                    onClick={() => setActiveView('apm')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'apm' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <Server className="w-3.5 h-3.5 text-blue-500" />
                    APM
                </button>
                <button 
                    onClick={() => setActiveView('audit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'audit' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                    Security Audit
                </button>
                <button 
                    onClick={() => setActiveView('backup')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'backup' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                    Data & Recovery
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { title: "Companies", value: counts.companies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
              { title: "Users", value: counts.users, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
              { title: "Security Alerts", value: counts.alerts, icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50" },
              { title: "Captured Errors", value: counts.errors, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
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

          <motion.div variants={itemVariants}>
            <AuditLogs userLogsOnly={true} />
          </motion.div>
        </>
      ) : activeView === 'errors' ? (
          <motion.div variants={itemVariants} className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                      <div>
                          <h2 className="text-xl font-bold text-slate-950">Captured Exceptions & Stack Traces</h2>
                          <p className="text-sm text-slate-500">Real-time error tracking and origin analysis across client and server routes.</p>
                      </div>
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold">
                          {errorLogs.filter(e => !e.resolved).length} Unresolved Errors
                      </span>
                  </div>

                  {errorLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">No errors recorded. System running smoothly.</div>
                  ) : (
                      <div className="space-y-4">
                          {errorLogs.map((err) => (
                              <div key={err.id} className={`p-4 border rounded-xl flex items-start justify-between gap-4 ${err.resolved ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-red-50/30 border-red-200'}`}>
                                  <div className="space-y-2 overflow-hidden">
                                      <div className="flex items-center gap-3">
                                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${err.resolved ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-700'}`}>
                                              {err.source || 'server'}
                                          </span>
                                          <span className="text-xs text-slate-400 font-mono">
                                              {err.timestamp?.toDate ? new Date(err.timestamp.toDate()).toLocaleString() : 'Just now'}
                                          </span>
                                      </div>
                                      <h4 className="font-bold text-slate-900 text-sm">{err.message}</h4>
                                      <pre className="text-xs font-mono text-slate-600 bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-32">
                                          {err.stackTrace || 'No stack trace'}
                                      </pre>
                                  </div>
                                  <div>
                                      {!err.resolved ? (
                                          <button
                                              onClick={() => handleResolveError(err.id)}
                                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                                          >
                                              Resolve
                                          </button>
                                      ) : (
                                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                                              <CheckCircle className="w-4 h-4" /> Resolved
                                          </span>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </motion.div>
      ) : activeView === 'apm' ? (
          <motion.div variants={itemVariants} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl">
                      <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-2 rounded-xl w-fit mb-4">
                          <Server className="w-5 h-5" />
                          <span className="font-bold text-sm">System Uptime</span>
                      </div>
                      <p className="text-4xl font-extrabold text-slate-950">99.98%</p>
                      <p className="text-xs text-emerald-600 mt-2 font-medium">All cloud services operational</p>
                  </div>
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl">
                      <div className="flex items-center gap-3 text-blue-600 bg-blue-50 p-2 rounded-xl w-fit mb-4">
                          <Clock className="w-5 h-5" />
                          <span className="font-bold text-sm">Avg Latency</span>
                      </div>
                      <p className="text-4xl font-extrabold text-slate-950">48 ms</p>
                      <p className="text-xs text-blue-600 mt-2 font-medium">Optimized globally</p>
                  </div>
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl">
                      <div className="flex items-center gap-3 text-indigo-600 bg-indigo-50 p-2 rounded-xl w-fit mb-4">
                          <Activity className="w-5 h-5" />
                          <span className="font-bold text-sm">DDoS Mitigations</span>
                      </div>
                      <p className="text-4xl font-extrabold text-slate-950">0</p>
                      <p className="text-xs text-slate-500 mt-2 font-medium">No active attack vectors</p>
                  </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h3 className="font-bold text-slate-950 mb-4">API Latency & Performance Metrics</h3>
                  {apmMetrics.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">No APM metrics recorded yet.</div>
                  ) : (
                      <div className="space-y-3">
                          {apmMetrics.map((metric, i) => (
                              <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                                  <div className="flex items-center gap-3">
                                      <span className="px-2 py-1 bg-blue-100 text-blue-700 font-mono text-xs font-bold rounded">
                                          {metric.statusCode || 200}
                                      </span>
                                      <span className="font-mono text-xs text-slate-800 font-bold">{metric.endpoint}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                      <span className="text-slate-500">{metric.timestamp?.toDate ? new Date(metric.timestamp.toDate()).toLocaleTimeString() : ''}</span>
                                      <span className="font-bold text-emerald-600">{metric.durationMs}ms</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </motion.div>
      ) : (
          <motion.div variants={itemVariants} className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                      <HardDrive className="w-8 h-8" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-bold text-slate-950">Tenant Data & Disaster Recovery Backups</h2>
                      <p className="text-sm text-slate-500 mt-1">Export all Firestore collections (companies, users, audit logs, invoices, customers, and financials) into structured JSON format.</p>
                  </div>

                  {backupStatus && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
                          {backupStatus}
                      </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                      <button
                          onClick={handleManualBackup}
                          disabled={isBackingUp}
                          className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-50"
                      >
                          <Download className="w-4 h-4" />
                          {isBackingUp ? 'Processing...' : 'Download Local JSON Backup'}
                      </button>
                      <button
                          onClick={handleDriveBackup}
                          disabled={isBackingUp}
                          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
                      >
                          <CloudUpload className="w-4 h-4" />
                          {isBackingUp ? 'Processing...' : 'Backup to Google Drive (MiraTechBusinessSuite/backup/)'}
                      </button>
                  </div>
              </div>
          </motion.div>
      )}
    </motion.div>
  );
}
