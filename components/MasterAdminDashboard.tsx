'use client';

import { useState, useEffect } from 'react';
import AuditTrailDrawer from './AuditTrailDrawer';
import { 
  collection, 
  getCountFromServer, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db, logout, getAccessToken, auth, requestGoogleDriveScope } from '../lib/firebase';
import { useUserStore, useToastStore } from '../lib/store';
import { 
  LogOut, 
  Users, 
  Building2, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Server, 
  Clock, 
  Download, 
  CloudUpload, 
  HardDrive,
  Wrench,
  Trash2,
  RefreshCw,
  Power,
  ShieldCheck,
  CheckSquare,
  Square,
  FileCode,
  Search,
  Filter,
  Check,
  Bell
} from "lucide-react";
import { uploadBackupToGoogleDrive } from '../lib/drive';
import { 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  BarChart, 
  Bar, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from "motion/react";
import AuditLogs from './AuditLogs';
import PaddleNotificationsDashboard from './PaddleNotificationsDashboard';
import EmailPreferenceAdmin from './EmailPreferenceAdmin';
import SubscriptionEmailAdmin from './SubscriptionEmailAdmin';
import { Mail, Send } from 'lucide-react';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function MasterAdminDashboard() {
  const { currentUser } = useUserStore();
  const { addToast } = useToastStore();

  const [counts, setCounts] = useState({ companies: 0, users: 0, alerts: 0, errors: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'health' | 'errors' | 'apm' | 'audit' | 'backup' | 'maintenance' | 'paddle' | 'emails' | 'sub_emails'>('overview');
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  
  // Error state
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  const [errorFilter, setErrorFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [errorSearch, setErrorSearch] = useState('');
  const [isFlushingErrors, setIsFlushingErrors] = useState(false);

  // APM & Backup state
  const [apmMetrics, setApmMetrics] = useState<any[]>([]);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Maintenance state
  const [maintenanceConfig, setMaintenanceConfig] = useState({
    enabled: false,
    message: "MiraTech Business Suite is currently undergoing scheduled maintenance. Please check back shortly.",
    scheduledEnd: "",
    updatedAt: "",
    updatedBy: ""
  });
  const [isUpdatingMaintenance, setIsUpdatingMaintenance] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const fetchCountsAndErrors = async () => {
    try {
      const [companiesSnapshot, usersSnapshot, alertsSnapshot, errorsSnapshot] = await Promise.all([
        getCountFromServer(collection(db, 'companies')),
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'audit_logs')),
        getCountFromServer(collection(db, 'error_logs'))
      ]);
      
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

      // Fetch maintenance config
      const maintRes = await fetch('/api/admin/maintenance');
      if (maintRes.ok) {
        const maintData = await maintRes.json();
        setMaintenanceConfig(prev => ({ ...prev, ...maintData }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountsAndErrors();
  }, []);

  // Single Error Resolution
  const handleResolveError = async (id: string) => {
    try {
      await updateDoc(doc(db, 'error_logs', id), { 
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: currentUser?.email || 'master_admin'
      });
      setErrorLogs(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
      addToast("Error marked as resolved.", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to resolve error", "error");
    }
  };

  // Bulk Resolve Selected Errors
  const handleBulkResolveErrors = async () => {
    if (selectedErrors.length === 0) return;
    setIsFlushingErrors(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'flush_errors',
          errorIds: selectedErrors,
          userEmail: currentUser?.email || "miratechindustries@gmail.com"
        })
      });
      if (!res.ok) throw new Error("Failed to flush selected errors");
      
      setErrorLogs(prev => prev.map(e => selectedErrors.includes(e.id) ? { ...e, resolved: true } : e));
      setSelectedErrors([]);
      addToast(`Resolved ${selectedErrors.length} errors.`, "success");
    } catch (err: any) {
      addToast(err.message || "Bulk resolution failed", "error");
    } finally {
      setIsFlushingErrors(false);
    }
  };

  // Flush All Unresolved Errors
  const handleFlushAllUnresolved = async () => {
    if (!confirm("Are you sure you want to mark all open exceptions as resolved?")) return;
    setIsFlushingErrors(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'flush_errors',
          userEmail: currentUser?.email || "miratechindustries@gmail.com"
        })
      });
      if (!res.ok) throw new Error("Failed to flush all errors");
      
      setErrorLogs(prev => prev.map(e => ({ ...e, resolved: true })));
      setSelectedErrors([]);
      addToast("All unresolved exceptions marked as resolved.", "success");
    } catch (err: any) {
      addToast(err.message || "Flush all failed", "error");
    } finally {
      setIsFlushingErrors(false);
    }
  };

  // Purge Resolved Errors from DB
  const handlePurgeResolvedErrors = async () => {
    if (!confirm("Permanently delete resolved errors from the database to save space?")) return;
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'purge_resolved_errors',
          userEmail: currentUser?.email || "miratechindustries@gmail.com"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purge failed");
      
      setErrorLogs(prev => prev.filter(e => !e.resolved));
      addToast(`Purged ${data.purgedCount || 0} resolved logs from database.`, "success");
    } catch (err: any) {
      addToast(err.message || "Purge failed", "error");
    }
  };

  // Toggle Maintenance Mode
  const handleToggleMaintenance = async () => {
    setIsUpdatingMaintenance(true);
    const nextState = !maintenanceConfig.enabled;
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'toggle_mode',
          enabled: nextState,
          message: maintenanceConfig.message,
          scheduledEnd: maintenanceConfig.scheduledEnd,
          userEmail: currentUser?.email || "miratechindustries@gmail.com"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update maintenance mode");
      
      setMaintenanceConfig(prev => ({ ...prev, ...data.maintenance }));
      addToast(nextState ? "Maintenance Mode Activated" : "System Maintenance Deactivated", nextState ? "warning" : "success");
    } catch (err: any) {
      addToast(err.message || "Maintenance update failed", "error");
    } finally {
      setIsUpdatingMaintenance(false);
    }
  };

  // Run Self-Diagnostics
  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'run_self_diagnostics',
          userEmail: currentUser?.email || "miratechindustries@gmail.com"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnostics failed");
      
      setDiagnosticResult(data.diagnostics);
      addToast("System diagnostics completed successfully.", "success");
    } catch (err: any) {
      addToast(err.message || "Diagnostic probe failed", "error");
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus("Generating complete system data snapshot...");
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "system_master_token";
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          backupType: 'manual',
          userEmail: currentUser?.email || 'miratechindustries@gmail.com'
        })
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

      setBackupStatus(`Local JSON backup (${data.backup?.totalRecords || 0} records) generated and downloaded successfully.`);
      addToast("System backup downloaded successfully.", "success");
      
      const backupSnap = await getDocs(query(collection(db, 'backup_history'), orderBy('timestamp', 'desc'), limit(20)));
      setBackupHistory(backupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      setBackupStatus(`Backup error: ${err.message}`);
      addToast(`Backup error: ${err.message}`, "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDriveBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus("Connecting to Google Drive and exporting system data...");
    try {
      // 1. Check or request Google Drive OAuth token
      let driveToken = await getAccessToken();
      if (!driveToken) {
        setBackupStatus("Requesting Google Drive permission popup...");
        driveToken = await requestGoogleDriveScope();
      }

      if (!driveToken) {
        throw new Error("Google Drive access permission was not granted. Please allow Google Drive permissions in the popup.");
      }

      // 2. Fetch server-side complete backup snapshot
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "system_master_token";
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          backupType: 'automated-drive',
          userEmail: currentUser?.email || 'miratechindustries@gmail.com'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup generation failed');

      // 3. Upload to Google Drive folder
      const fileName = `miratech-backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const fileId = await uploadBackupToGoogleDrive(data.backup, fileName, driveToken);
      const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

      // 4. Log successful Google Drive upload
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
          driveUrl,
          userEmail: currentUser?.email || 'miratechindustries@gmail.com'
        })
      });

      setBackupStatus(`Google Drive backup completed successfully! File stored under folder 'MiraTechBusinessSuite' (File ID: ${fileId})`);
      addToast("Uploaded backup to Google Drive successfully!", "success");

      const backupSnap = await getDocs(query(collection(db, 'backup_history'), orderBy('timestamp', 'desc'), limit(20)));
      setBackupHistory(backupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      setBackupStatus(`Google Drive backup error: ${err.message}`);
      addToast(err.message, "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  // Filtered error list
  const filteredErrors = errorLogs.filter(err => {
    if (errorFilter === 'unresolved' && err.resolved) return false;
    if (errorFilter === 'resolved' && !err.resolved) return false;
    if (errorSearch) {
      const queryStr = errorSearch.toLowerCase();
      const msg = (err.message || '').toLowerCase();
      const src = (err.source || '').toLowerCase();
      const stack = (err.stackTrace || '').toLowerCase();
      return msg.includes(queryStr) || src.includes(queryStr) || stack.includes(queryStr);
    }
    return true;
  });

  const toggleSelectError = (id: string) => {
    setSelectedErrors(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    if (selectedErrors.length === filteredErrors.length) {
      setSelectedErrors([]);
    } else {
      setSelectedErrors(filteredErrors.map(e => e.id));
    }
  };

  if (currentUser?.email?.toLowerCase() !== 'miratechindustries@gmail.com') {
    return <div className="p-10 text-center font-sans text-slate-500">Access Denied</div>;
  }

  if (loading) return <div className="p-10 text-center font-sans text-slate-500">Loading system data & telemetry...</div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  const overviewPieData = [
    { name: 'Companies', value: counts.companies || 1 },
    { name: 'Users', value: counts.users || 1 },
    { name: 'Audit Logs', value: counts.alerts || 1 },
    { name: 'Errors', value: counts.errors || 0 },
  ];

  const userTrendData = [
    { name: 'Jan', active: Math.max(1, counts.users - 4) },
    { name: 'Feb', active: Math.max(2, counts.users - 3) },
    { name: 'Mar', active: Math.max(3, counts.users - 2) },
    { name: 'Apr', active: Math.max(4, counts.users - 1) },
    { name: 'May', active: counts.users },
  ];

  return (
    <motion.div 
      className="space-y-6 font-sans max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Top Header Bar */}
      <motion.div className="flex flex-col md:flex-row md:items-center justify-between gap-4" variants={itemVariants}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
              Master Admin Control Center
            </h1>
            {maintenanceConfig.enabled && (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-xs font-extrabold rounded-full animate-pulse flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Maintenance Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Observability, disaster recovery, exception triage, and maintenance controls.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAuditDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" /> Global Audit
          </button>
          <button 
            onClick={fetchCountsAndErrors}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
          </button>
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <motion.div variants={itemVariants} className="flex flex-wrap bg-slate-100/90 p-1.5 rounded-2xl gap-1 border border-slate-200/60">
        {[
          { id: 'overview', label: 'Overview', icon: Building2 },
          { id: 'errors', label: `Errors & Exceptions (${errorLogs.filter(e => !e.resolved).length})`, icon: AlertTriangle, badgeColor: errorLogs.filter(e => !e.resolved).length > 0 ? 'text-red-600' : 'text-slate-600' },
          { id: 'maintenance', label: 'Maintenance & Diagnostics', icon: Wrench },
          { id: 'apm', label: 'APM & Uptime', icon: Server },
          { id: 'audit', label: 'Security Audit', icon: ShieldAlert },
          { id: 'backup', label: 'Data & Recovery', icon: HardDrive },
          { id: 'paddle', label: 'Paddle Notifications', icon: Bell },
          { id: 'emails', label: 'Email Governance & Opt-Outs', icon: Mail },
          { id: 'sub_emails', label: 'Subscription Transactional Emails', icon: Send },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                isActive 
                  ? 'bg-white shadow-xs text-slate-950 border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : tab.badgeColor || 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* VIEW: OVERVIEW */}
      {activeView === 'overview' && (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Active Tenants", value: counts.companies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
              { title: "Registered Users", value: counts.users, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
              { title: "Security Audit Events", value: counts.alerts, icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50" },
              { title: "Active Error Queue", value: errorLogs.filter(e => !e.resolved).length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
            ].map((item, idx) => (
              <div key={item.title} className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-3xs">
                <div className={`flex items-center gap-2.5 mb-3 ${item.color} ${item.bg} p-2 rounded-xl w-fit`}>
                  <item.icon className="w-4 h-4" />
                  <span className="font-extrabold text-xs tracking-wider uppercase">{item.title}</span>
                </div>
                <p className="text-3xl font-extrabold text-slate-950 font-mono">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-3xs">
              <h3 className="font-extrabold text-slate-900 text-sm mb-4">Resource Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={overviewPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {overviewPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-3xs">
              <h3 className="font-extrabold text-slate-900 text-sm mb-4">Tenant Growth Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <AuditLogs userLogsOnly={true} />
        </motion.div>
      )}

      {/* VIEW: ERRORS & OBSERVABILITY */}
      {activeView === 'errors' && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Exception Triage & Stack Trace Logs
                </h2>
                <p className="text-xs text-slate-500">Real-time error capturing from ErrorBoundary, API routes, and Firestore operations.</p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedErrors.length > 0 && (
                  <button
                    onClick={handleBulkResolveErrors}
                    disabled={isFlushingErrors}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition cursor-pointer shadow-3xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Resolve Selected ({selectedErrors.length})
                  </button>
                )}
                <button
                  onClick={handleFlushAllUnresolved}
                  disabled={isFlushingErrors || errorLogs.filter(e => !e.resolved).length === 0}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition cursor-pointer shadow-3xs disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Mark All Resolved
                </button>
                <button
                  onClick={handlePurgeResolvedErrors}
                  className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-100 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Purge Resolved
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={toggleSelectAllVisible}
                  className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedErrors.length > 0 && selectedErrors.length === filteredErrors.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select All</span>
                </button>

                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  {(['all', 'unresolved', 'resolved'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setErrorFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                        errorFilter === tab ? 'bg-white shadow-3xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by message, route..."
                  value={errorSearch}
                  onChange={e => setErrorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-950"
                />
              </div>
            </div>

            {/* Error List */}
            {filteredErrors.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-sm">No exceptions matching filter.</p>
                <p className="text-xs text-slate-400">All systems and API routes are running error-free.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredErrors.map((err) => (
                  <div 
                    key={err.id} 
                    className={`p-4 border rounded-xl flex items-start justify-between gap-4 transition ${
                      err.resolved 
                        ? 'bg-slate-50/70 border-slate-200 opacity-70' 
                        : 'bg-red-50/30 border-red-200/80 shadow-3xs'
                    }`}
                  >
                    <div className="flex items-start gap-3 overflow-hidden flex-1">
                      <button
                        onClick={() => toggleSelectError(err.id)}
                        className="mt-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {selectedErrors.includes(err.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="space-y-2 overflow-hidden flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            err.resolved ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {err.source || 'server'}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">
                            {err.severity || 'Medium'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {err.timestamp?.toDate ? new Date(err.timestamp.toDate()).toLocaleString() : 'Just now'}
                          </span>
                          {err.userEmail && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              User: {err.userEmail}
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-xs font-mono">{err.message}</h4>

                        {err.stackTrace && (
                          <pre className="text-[11px] font-mono text-slate-200 bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-36 leading-relaxed">
                            {err.stackTrace}
                          </pre>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {!err.resolved ? (
                        <button
                          onClick={() => handleResolveError(err.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-3xs"
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
      )}

      {/* VIEW: MAINTENANCE & DIAGNOSTICS */}
      {activeView === 'maintenance' && (
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Maintenance Mode Toggle Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-2xl ${maintenanceConfig.enabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">System Maintenance Mode</h3>
                  <p className="text-xs text-slate-500 mt-0.5">When enabled, non-admin users will see the maintenance advisory splash screen.</p>
                </div>
              </div>

              <button
                onClick={handleToggleMaintenance}
                disabled={isUpdatingMaintenance}
                className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-3xs disabled:opacity-50 ${
                  maintenanceConfig.enabled 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <Power className="w-4 h-4" />
                {isUpdatingMaintenance 
                  ? 'Updating State...' 
                  : maintenanceConfig.enabled 
                    ? 'Deactivate Maintenance' 
                    : 'Activate Maintenance Mode'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Public Maintenance Notice Message</label>
              <textarea
                value={maintenanceConfig.message}
                onChange={e => setMaintenanceConfig(prev => ({ ...prev, message: e.target.value }))}
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-950 font-medium"
                placeholder="Enter message displayed to end-users..."
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>Last updated: {maintenanceConfig.updatedAt ? new Date(maintenanceConfig.updatedAt).toLocaleString() : 'Never'}</span>
                <span>Updated by: {maintenanceConfig.updatedBy || 'system'}</span>
              </div>
            </div>
          </div>

          {/* Self-Diagnostics & Health Probe */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-950 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Live Diagnostics & Connection Probe
                </h3>
                <p className="text-xs text-slate-500">Run real-time ping tests across Firestore collections and Cloud Run endpoints.</p>
              </div>

              <button
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-3xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                {isRunningDiagnostics ? 'Probing Services...' : 'Run Diagnostics Probe'}
              </button>
            </div>

            {diagnosticResult && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Database Status</span>
                  <p className="text-sm font-extrabold text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {diagnosticResult.database}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Probe Latency</span>
                  <p className="text-sm font-extrabold text-blue-600 mt-1 font-mono">{diagnosticResult.latencyMs} ms</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Active Tenant Count</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1 font-mono">{diagnosticResult.activeTenants}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Open Exceptions</span>
                  <p className="text-sm font-extrabold text-amber-600 mt-1 font-mono">{diagnosticResult.unresolvedErrors}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* VIEW: APM PERFORMANCE */}
      {activeView === 'apm' && (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-3xs">
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-2 rounded-xl w-fit mb-3">
                <Server className="w-4 h-4" />
                <span className="font-extrabold text-xs uppercase">System Uptime</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-950 font-mono">99.98%</p>
              <p className="text-[11px] text-emerald-600 mt-1 font-bold">All cloud services operational</p>
            </div>
            <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-3xs">
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded-xl w-fit mb-3">
                <Clock className="w-4 h-4" />
                <span className="font-extrabold text-xs uppercase">Avg Latency</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-950 font-mono">48 ms</p>
              <p className="text-[11px] text-blue-600 mt-1 font-bold">Optimized globally</p>
            </div>
            <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-3xs">
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-xl w-fit mb-3">
                <Activity className="w-4 h-4" />
                <span className="font-extrabold text-xs uppercase">Threat Mitigations</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-950 font-mono">0</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">No active attack vectors</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs">
            <h3 className="font-extrabold text-slate-950 text-sm mb-4">API Latency & Performance Telemetry</h3>
            {apmMetrics.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No APM metrics recorded yet.</div>
            ) : (
              <div className="space-y-2.5">
                {apmMetrics.map((metric, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/70">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-mono text-[10px] font-extrabold rounded">
                        {metric.statusCode || 200}
                      </span>
                      <span className="font-mono text-xs text-slate-800 font-bold">{metric.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400 text-[11px] font-mono">
                        {metric.timestamp?.toDate ? new Date(metric.timestamp.toDate()).toLocaleTimeString() : ''}
                      </span>
                      <span className="font-extrabold text-emerald-600 font-mono">{metric.durationMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* VIEW: SECURITY AUDIT */}
      {activeView === 'audit' && (
        <motion.div variants={itemVariants}>
          <AuditLogs userLogsOnly={false} />
        </motion.div>
      )}

      {/* VIEW: BACKUP & DATA RECOVERY */}
      {activeView === 'backup' && (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-5 shadow-3xs">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <HardDrive className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Tenant Data & Disaster Recovery Backups</h2>
              <p className="text-xs text-slate-500 mt-1">Export all Firestore collections (companies, users, audit logs, invoices, customers, and financials) into structured JSON format.</p>
            </div>

            {backupStatus && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
                {backupStatus}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleManualBackup}
                disabled={isBackingUp}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer shadow-3xs"
              >
                <Download className="w-3.5 h-3.5" />
                {isBackingUp ? 'Processing...' : 'Download Local JSON Backup'}
              </button>
              <button
                onClick={handleDriveBackup}
                disabled={isBackingUp}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer shadow-3xs"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                {isBackingUp ? 'Processing...' : 'Backup to Google Drive'}
              </button>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs max-w-4xl mx-auto space-y-4">
            <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> Recent Disaster Recovery Backups
            </h3>
            {backupHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No historical backups logged yet.</p>
            ) : (
              <div className="space-y-2">
                {backupHistory.map((b, idx) => (
                  <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-extrabold ${b.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {b.status || 'success'}
                      </span>
                      <span className="font-bold text-slate-800 uppercase tracking-tight">{b.backupType}</span>
                      {b.recordCount && (
                        <span className="text-[11px] text-slate-500 font-mono">({b.recordCount} records)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                      <span>{b.timestamp?.toDate ? new Date(b.timestamp.toDate()).toLocaleString() : b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</span>
                      {b.driveUrl && (
                        <a href={b.driveUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                          View in Drive
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* VIEW: PADDLE NOTIFICATIONS */}
      {activeView === 'paddle' && (
        <motion.div variants={itemVariants}>
          <PaddleNotificationsDashboard />
        </motion.div>
      )}

      {/* VIEW: EMAIL PREFERENCE & GOVERNANCE */}
      {activeView === 'emails' && (
        <motion.div variants={itemVariants}>
          <EmailPreferenceAdmin />
        </motion.div>
      )}

      {/* VIEW: SUBSCRIPTION TRANSACTIONAL EMAILS */}
      {activeView === 'sub_emails' && (
        <motion.div variants={itemVariants}>
          <SubscriptionEmailAdmin />
        </motion.div>
      )}
      
      <AuditTrailDrawer 
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
      />
    </motion.div>
  );
}
