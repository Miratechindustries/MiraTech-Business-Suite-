'use client';

import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Role } from '../lib/types';
import { logAction } from '../lib/audit';
import { SUBSCRIPTION_PLANS } from '../lib/subscriptions';
import { 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  Eye, 
  EyeOff, 
  Check, 
  ShieldAlert, 
  UserPlus2, 
  Key, 
  UserCheck2,
  X
} from 'lucide-react';

export default function UserManagement() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('STAFF');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [editDepartments, setEditDepartments] = useState<string[]>([]);

  // Approval Permissions creation states
  const [canApproveQuotations, setCanApproveQuotations] = useState(false);
  const [canApproveInvoices, setCanApproveInvoices] = useState(false);
  const [canOverrideHR, setCanOverrideHR] = useState(false);
  const [canFinalizeDocuments, setCanFinalizeDocuments] = useState(false);
  const [canRejectDocuments, setCanRejectDocuments] = useState(false);
  const [canReturnForEditing, setCanReturnForEditing] = useState(false);
  const [canViewApprovalHistory, setCanViewApprovalHistory] = useState(false);
  const [canApproveAcrossAllDepartments, setCanApproveAcrossAllDepartments] = useState(false);
  const [canReceiveApprovalNotifications, setCanReceiveApprovalNotifications] = useState(false);
  const [approvalRights, setApprovalRights] = useState(false);

  // Approval Permissions editing states
  const [editCanApproveQuotations, setEditCanApproveQuotations] = useState(false);
  const [editCanApproveInvoices, setEditCanApproveInvoices] = useState(false);
  const [editCanOverrideHR, setEditCanOverrideHR] = useState(false);
  const [editCanFinalizeDocuments, setEditCanFinalizeDocuments] = useState(false);
  const [editCanRejectDocuments, setEditCanRejectDocuments] = useState(false);
  const [editCanReturnForEditing, setEditCanReturnForEditing] = useState(false);
  const [editCanViewApprovalHistory, setEditCanViewApprovalHistory] = useState(false);
  const [editCanApproveAcrossAllDepartments, setEditCanApproveAcrossAllDepartments] = useState(false);
  const [editCanReceiveApprovalNotifications, setEditCanReceiveApprovalNotifications] = useState(false);
  const [editApprovalRights, setEditApprovalRights] = useState(false);

  const AVAILABLE_DEPARTMENTS = [
    { id: "sales", name: "Sales & CRM" },
    { id: "finance", name: "Finance & Accounting" },
    { id: "hr", name: "HR & Payroll" },
    { id: "inventory", name: "Inventory Stock" },
    { id: "projects", name: "Projects & Tasks" },
    { id: "reports", name: "Reports & Analytics" },
    { id: "support", name: "Customer Support" },
    { id: "procurement", name: "Procurement" },
    { id: "marketing", name: "Marketing Hub" },
    { id: "audit", name: "Security Audit Logs" },
    { id: "executive", name: "Executive Lounge" },
    { id: "pos", name: "POS System" }
  ];

  const fetchData = async () => {
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(companiesData);
    } catch (err: any) {
      console.error("Error loading companies in user management directory:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'companies');
      } catch (r) {}
    }

    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (err: any) {
      console.error("Error loading users in user management directory:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'users');
      } catch (r) {}
    }
  };

  const startEdit = (user: any) => {
    setEditingUserId(user.id);
    setEditRole(user.role || 'STAFF');
    setEditCompanyId(user.companyId || '');
    setEditDepartments(user.departments || []);
    setEditCanApproveQuotations(user.canApproveQuotations || false);
    setEditCanApproveInvoices(user.canApproveInvoices || false);
    setEditCanOverrideHR(user.canOverrideHR || false);
    setEditCanFinalizeDocuments(user.canFinalizeDocuments || false);
    setEditCanRejectDocuments(user.canRejectDocuments || false);
    setEditCanReturnForEditing(user.canReturnForEditing || false);
    setEditCanViewApprovalHistory(user.canViewApprovalHistory || false);
    setEditCanApproveAcrossAllDepartments(user.canApproveAcrossAllDepartments || false);
    setEditCanReceiveApprovalNotifications(user.canReceiveApprovalNotifications || false);
    setEditApprovalRights(user.approvalRights || false);
  };

  const saveEdit = async (userId: string) => {
    try {
      const isScopedRole = editRole === 'STAFF' || editRole === 'DEPARTMENT_MANAGER' || editRole === 'HR' || editRole === 'FINANCE_MANAGER' || editRole === 'OPERATIONS_MANAGER';
      await updateDoc(doc(db, 'users', userId), {
        role: editRole,
        companyId: editCompanyId,
        businessId: editCompanyId, // Supporting legacy
        departments: isScopedRole ? editDepartments : [],
        canApproveQuotations: editCanApproveQuotations,
        canApproveInvoices: editCanApproveInvoices,
        canOverrideHR: editCanOverrideHR,
        canFinalizeDocuments: editCanFinalizeDocuments,
        canRejectDocuments: editCanRejectDocuments,
        canReturnForEditing: editCanReturnForEditing,
        canViewApprovalHistory: editCanViewApprovalHistory,
        canApproveAcrossAllDepartments: editCanApproveAcrossAllDepartments,
        canReceiveApprovalNotifications: editCanReceiveApprovalNotifications,
        approvalRights: editApprovalRights
      });
      fetchData();
      setEditingUserId(null);
    } catch (err: any) {
      console.error(err);
      setError('Failed to update user');
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      } catch (r) {}
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Helper to register users in Firebase Auth securely without breaking master session
  const createAuthUserSecondary = async (emailInput: string, passwordInput: string): Promise<string> => {
    const secondaryAppName = `UserMgtApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailInput, passwordInput);
      const uid = userCredential.user.uid;
      await signOut(secondaryAuth);
      return uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !selectedCompanyId) {
      setError('Please fill in all layout fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // 1. Check if email is already listed locally
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('This email address is already registered in the system.');
      }

      // Check Plan capacity limits
      const comp = companies.find(c => c.id === selectedCompanyId);
      if (comp) {
        const planId = comp.subscriptionPlanId || 'starter';
        const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0];
        
        const companyUsers = users.filter(u => u.companyId === selectedCompanyId && u.status !== 'DEACTIVATED');
        if (role === 'BUSINESS_ADMIN') {
          const adminCount = companyUsers.filter(u => u.role === 'BUSINESS_ADMIN').length;
          if (adminCount >= plan.maxAdmin) {
            throw new Error(`The company's active subscription (${plan.name}) allows a maximum of ${plan.maxAdmin} Administrator user account(s). This limit has been reached. Please upgrade the company's subscription plan.`);
          }
        } else if (role === 'STAFF') {
          const staffCount = companyUsers.filter(u => u.role === 'STAFF').length;
          if (staffCount >= plan.maxStaff) {
            throw new Error(`The company's active subscription (${plan.name}) allows a maximum of ${plan.maxStaff} Staff user account(s). This limit has been reached. Please upgrade the company's subscription plan.`);
          }
        }
      }

      // 2. Auth Creation
      const userUid = await createAuthUserSecondary(email, password);

      // 3. User Document Creation using setDoc with Auth UID
      const userPayload = {
        email,
        role,
        companyId: selectedCompanyId,
        businessId: selectedCompanyId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        departments: role === 'STAFF' ? selectedDepartments : [],
        canApproveQuotations,
        canApproveInvoices,
        canOverrideHR,
        canFinalizeDocuments,
        canRejectDocuments,
        canReturnForEditing,
        canViewApprovalHistory,
        canApproveAcrossAllDepartments,
        canReceiveApprovalNotifications,
        approvalRights
      };

      await setDoc(doc(db, 'users', userUid), userPayload);

      // Log database audit trail
      await logAction(
        'User Account Provisioned',
        `Provisioned credentials and authorized level ${role} for account "${email}" (UID: ${userUid}).`,
        selectedCompanyId
      );

      setSuccess(`Account ${email} created & provisioned successfully with UID: ${userUid}`);
      setEmail('');
      setPassword('');
      setSelectedDepartments([]);
      setCanApproveQuotations(false);
      setCanApproveInvoices(false);
      setCanOverrideHR(false);
      setCanFinalizeDocuments(false);
      setCanRejectDocuments(false);
      setCanReturnForEditing(false);
      setCanViewApprovalHistory(false);
      setCanApproveAcrossAllDepartments(false);
      setCanReceiveApprovalNotifications(false);
      setApprovalRights(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use')) {
        setError('This email address is already in use by another account in Firebase Authentication.');
      } else {
        setError(err?.message || 'Failed to populate user registration credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const u = users.find(x => x.id === userId);
      await updateDoc(doc(db, 'users', userId), { status: 'DEACTIVATED' });
      
      // Log Action
      await logAction(
        'User Suspended',
        `Deactivated and suspended system access for account "${u?.email || 'Unknown'}" (ID: ${userId}).`,
        u?.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to deactivate user');
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      const u = users.find(x => x.id === userId);
      await updateDoc(doc(db, 'users', userId), { status: 'ACTIVE' });
      
      // Log Action
      await logAction(
        'User Restored',
        `Restored and activated system access for account "${u?.email || 'Unknown'}" (ID: ${userId}).`,
        u?.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to activate user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return;

    if (!confirm(`Are you absolutely sure you want to permanently delete user account "${u.email}" from the registry?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));

      // Log Action
      await logAction(
        'User Permanently Deleted',
        `Permanently removed and purged access for user account "${u.email}" (ID: ${userId}).`,
        u.companyId || 'SYSTEM'
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <Users className="w-5.5 h-5.5 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">System Roster & Credentials Manager</h2>
          <p className="text-xs text-slate-500 font-medium">Verify account directories and inspect emails & plain-text password credentials.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Form */}
        <div className="lg:col-span-4">
          <form onSubmit={handleInvite} className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <UserPlus2 className="w-4 h-4 text-blue-600" /> Create Custom Account
            </h3>

            {error && (
              <p className="text-[11px] font-semibold bg-red-50 text-red-600 p-2.5 border border-red-150 rounded-lg">
                {error}
              </p>
            )}

            {success && (
              <p className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 p-2.5 border border-emerald-150 rounded-lg">
                {success}
              </p>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">User Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="employee@business.com" 
                className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden transition" 
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authentication Password</label>
              <input 
                type="text" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Plain password (min 8 chars)" 
                className="w-full text-xs font-mono font-medium border border-slate-200 p-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden transition text-slate-700" 
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Authorization Privilege</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value as Role)} 
                className="w-full text-xs font-bold border border-slate-200 p-2 rounded-lg bg-slate-50"
              >
                <option value="DEPARTMENT_MANAGER">Department Manager (Scoped Clearance)</option>
                <option value="STAFF">Staff (Standard Operational Clerk)</option>
                <option value="BUSINESS_ADMIN">Business Admin (Workspace Owner)</option>
                <option value="MASTER_ADMIN">Master Admin (System Supervisor)</option>
                <option value="HR">HR Manager</option>
                <option value="FINANCE_MANAGER">Finance Manager</option>
                <option value="OPERATIONS_MANAGER">Operations Manager</option>
                <option value="GENERAL_MANAGER">General Manager</option>
                <option value="MANAGING_DIRECTOR">Managing Director</option>
                <option value="COMPANY_OWNER">Company Owner</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Corporate Association</label>
              <select 
                value={selectedCompanyId} 
                onChange={(e) => setSelectedCompanyId(e.target.value)} 
                className="w-full text-xs font-bold border border-slate-200 p-2 rounded-lg bg-slate-50"
                required
              >
                <option value="">Select Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {(role === 'STAFF' || role === 'DEPARTMENT_MANAGER' || role === 'HR' || role === 'FINANCE_MANAGER' || role === 'OPERATIONS_MANAGER') && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Assigned Departments (Scoped Access)
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto">
                  {AVAILABLE_DEPARTMENTS.map((dept) => {
                    const isChecked = selectedDepartments.includes(dept.id);
                    return (
                      <label key={dept.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                            } else {
                              setSelectedDepartments([...selectedDepartments, dept.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>{dept.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Approval Permissions & Override
              </label>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canApproveQuotations}
                    onChange={(e) => setCanApproveQuotations(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Approve Quotations</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canApproveInvoices}
                    onChange={(e) => setCanApproveInvoices(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Approve Invoices</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canOverrideHR}
                    onChange={(e) => setCanOverrideHR(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Override HR Approval</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canFinalizeDocuments}
                    onChange={(e) => setCanFinalizeDocuments(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Finalize Documents</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canRejectDocuments}
                    onChange={(e) => setCanRejectDocuments(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Reject Documents</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canReturnForEditing}
                    onChange={(e) => setCanReturnForEditing(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Return for Editing</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canViewApprovalHistory}
                    onChange={(e) => setCanViewApprovalHistory(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>View Approval History</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canApproveAcrossAllDepartments}
                    onChange={(e) => setCanApproveAcrossAllDepartments(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Approve Across All Depts</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canReceiveApprovalNotifications}
                    onChange={(e) => setCanReceiveApprovalNotifications(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Receive Approval Notifications</span>
                </label>
                <div className="border-t border-slate-200 my-1 pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-blue-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approvalRights}
                      onChange={(e) => setApprovalRights(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>Has Approval Override Rights</span>
                  </label>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 text-xs rounded-lg transition shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Provisioning Auth Account...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Provision User Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Users Table */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <h3 className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
              <UserCheck2 className="w-4 h-4 text-emerald-600" /> Active System & Credentials Directory
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 leading-none">
                    <th className="p-3">User Email Address</th>
                    <th className="p-3">Role Status</th>
                    <th className="p-3">Workspace Business</th>
                    <th className="p-3">Auth Security</th>
                     <th className="p-3 text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/45 transition">
                      <td className="p-3 font-semibold text-slate-800">{u.email}</td>
                      <td className="p-3 font-bold text-[10px]">
                        <div className="space-y-1.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase border tracking-wider ${
                            u.role === 'MASTER_ADMIN' 
                              ? 'bg-rose-50 text-rose-700 border-rose-100' 
                              : u.role === 'BUSINESS_ADMIN' 
                                ? 'bg-blue-50 text-blue-700 border-blue-105' 
                                : 'bg-amber-50 text-amber-700 border-amber-105'
                          }`}>
                            {u.role || 'STAFF'}
                          </span>
                          {u.role === 'STAFF' && (
                            <div className="flex flex-wrap gap-1 max-w-[155px]">
                              {(u.departments && u.departments.length > 0) ? (
                                u.departments.map((d: string) => (
                                  <span key={d} className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                                    {AVAILABLE_DEPARTMENTS.find(ad => ad.id === d)?.name || d}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[8px] font-bold text-red-500 bg-red-50 border border-red-150 px-1.5 rounded-md">
                                  No access nodes
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-600">
                        {companies.find(c => c.id === u.companyId)?.name || 'Direct / System Node'}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Key className="w-2.5 h-2.5 text-slate-500" /> Firebase Auth (Hashed)
                        </span>
                      </td>
                      <td className="p-3 text-right pr-6 space-x-2">
                        <button onClick={() => startEdit(u)} className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800">Edit</button>
                        {u.role !== 'MASTER_ADMIN' && u.email?.toLowerCase() !== 'miratechindustries@gmail.com' && (
                            <>
                              {u.status === 'DEACTIVATED' ? (
                                <button 
                                  onClick={() => handleActivate(u.id)} 
                                  className="text-[11px] font-extrabold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded transition cursor-pointer"
                                >
                                  Activate
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleDeactivate(u.id)} 
                                  className="text-[11px] font-extrabold text-slate-550 hover:text-slate-705 hover:bg-slate-100/70 px-2 py-1 rounded transition cursor-pointer"
                                >
                                  Deactivate
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteUser(u.id)} 
                                className="inline-flex items-center justify-center p-1.5 text-red-550 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Permanently Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal Dialog */}
      {editingUserId && (() => {
        const editingUser = users.find(u => u.id === editingUserId);
        if (!editingUser) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-3xs">
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800 tracking-tight flex items-center gap-2 text-sm sm:text-base">
                    <Users className="h-4 w-4 text-blue-600" />
                    Edit User Credentials & Access
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">User Email: {editingUser.email}</p>
                </div>
                <button 
                  onClick={() => setEditingUserId(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingUserId); }} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">User Role Status</label>
                    <select 
                      value={editRole} 
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className="text-xs font-bold border border-slate-250 rounded-lg p-2 w-full bg-slate-50/30"
                    >
                      <option value="DEPARTMENT_MANAGER">DEPARTMENT_MANAGER (Scoped Clearance)</option>
                      <option value="STAFF">STAFF (Operational Staff)</option>
                      <option value="BUSINESS_ADMIN">BUSINESS_ADMIN (Workspace Owner)</option>
                      <option value="MASTER_ADMIN">MASTER_ADMIN (System Supervisor)</option>
                      <option value="HR">HR</option>
                      <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                      <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER</option>
                      <option value="GENERAL_MANAGER">GENERAL_MANAGER</option>
                      <option value="MANAGING_DIRECTOR">MANAGING_DIRECTOR</option>
                      <option value="COMPANY_OWNER">COMPANY_OWNER</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Assigned Corporate Workspace</label>
                    <select 
                      value={editCompanyId} 
                      onChange={(e) => setEditCompanyId(e.target.value)}
                      className="text-xs font-bold border border-slate-250 rounded-lg p-2 w-full bg-slate-50/30"
                    >
                      <option value="">Direct / System Node</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {(editRole === 'STAFF' || editRole === 'DEPARTMENT_MANAGER' || editRole === 'HR' || editRole === 'FINANCE_MANAGER' || editRole === 'OPERATIONS_MANAGER') && (
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Assigned Department Access Node(s)</label>
                      <div className="border border-slate-200 bg-slate-50/50 p-3 rounded-xl space-y-1.5 max-h-48 overflow-y-auto">
                        {AVAILABLE_DEPARTMENTS.map((dept) => {
                          const isChecked = editDepartments.includes(dept.id);
                          return (
                            <label key={dept.id} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-slate-100/50 rounded px-1 transition select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setEditDepartments(editDepartments.filter(id => id !== dept.id));
                                  } else {
                                    setEditDepartments([...editDepartments, dept.id]);
                                  }
                                }}
                                className="rounded text-blue-600 w-4 h-4"
                              />
                              <span className="font-medium text-slate-700">{dept.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Approval Rights & Governance Permissions</label>
                    <div className="border border-slate-200 bg-slate-50/50 p-3 rounded-xl space-y-1.5 max-h-48 overflow-y-auto">
                      {[
                        { checked: editCanApproveQuotations, setChecked: setEditCanApproveQuotations, label: "Approve Quotations" },
                        { checked: editCanApproveInvoices, setChecked: setEditCanApproveInvoices, label: "Approve Invoices" },
                        { checked: editCanOverrideHR, setChecked: setEditCanOverrideHR, label: "Override HR & Payroll" },
                        { checked: editCanFinalizeDocuments, setChecked: setEditCanFinalizeDocuments, label: "Finalize PDF Documents" },
                        { checked: editCanRejectDocuments, setChecked: setEditCanRejectDocuments, label: "Reject Documents" },
                        { checked: editCanReturnForEditing, setChecked: setEditCanReturnForEditing, label: "Return for Editing" },
                        { checked: editCanViewApprovalHistory, setChecked: setEditCanViewApprovalHistory, label: "View Approval History Logs" },
                        { checked: editCanApproveAcrossAllDepartments, setChecked: setEditCanApproveAcrossAllDepartments, label: "Approve Across All Departments" },
                        { checked: editCanReceiveApprovalNotifications, setChecked: setEditCanReceiveApprovalNotifications, label: "Receive Approval Notifications" },
                        { checked: editApprovalRights, setChecked: setEditApprovalRights, label: "Enable Master Override Rights", highlight: true },
                      ].map((item, index) => (
                        <label key={index} className={`flex items-center gap-2 cursor-pointer py-1 hover:bg-slate-100/50 rounded px-1 transition select-none ${item.highlight ? 'text-blue-700 font-bold' : 'text-slate-700 font-medium'}`}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => item.setChecked(e.target.checked)}
                            className="rounded text-blue-600 w-4 h-4"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 text-xs flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white font-bold hover:bg-slate-800 rounded-lg cursor-pointer transition flex items-center gap-1.5"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
