"use client";

import React, { useState, useEffect, useCallback } from "react";
import AuditTrailDrawer from "./AuditTrailDrawer";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  query, 
  where,
  deleteDoc
} from "firebase/firestore";
import { useUserStore } from "../lib/store";
import { 
  SUBSCRIPTION_PLANS, 
  SubscriptionPlan, 
  ALL_FEATURES, 
  getLockedFeaturesForPlan,
  daysBetween,
  getPlanPrice,
  formatPlanPrice
} from "../lib/subscriptions";
import { logAction } from "../lib/audit";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Settings, 
  ShieldCheck, 
  ArrowRight, 
  LayoutDashboard, 
  Sparkles, 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  DollarSign, 
  Image as ImageIcon, 
  RefreshCw, 
  Layers, 
  Network, 
  FolderKanban, 
  FileText, 
  ShieldAlert, 
  ChevronRight,
  TrendingUp,
  UserCheck,
  UserPlus,
  Shield,
  Activity,
  Coins,
  Receipt,
  HelpCircle,
  Clock,
  Briefcase,
  Webhook,
  XCircle,
  PauseCircle
} from "lucide-react";
import Image from "next/image";
import CompanyProfile from "./CompanyProfile";
import SubscriptionsView from "./SubscriptionsView";
import DepartmentManager from "./DepartmentManager";
import EnterpriseSecurityPanel from "./governance/EnterpriseSecurityPanel";
import DataPrivacyVault from "./governance/DataPrivacyVault";
import ApiWebhookHub from "./governance/ApiWebhookHub";
import DepartmentBudgetHub from "./governance/DepartmentBudgetHub";

interface BusinessAdminDashboardProps {
  onNavigateToCompanyDashboard: () => void;
  onNavigateTab?: (tabId: string) => void;
  initialSubTab?: "overview" | "settings" | "employees" | "billing" | "hierarchy" | "security" | "compliance" | "integrations" | "budgets";
}

interface EmployeeRecord {
  id: string;
  displayName?: string;
  email: string;
  role: string;
  positionTitle?: string;
  departments?: string[];
  status?: string;
  isVerified?: boolean;
  phone?: string;
  createdAt?: string;
  permissions?: Record<string, boolean>;
}

export default function BusinessAdminDashboard({
  onNavigateToCompanyDashboard,
  onNavigateTab,
  initialSubTab = "overview"
}: BusinessAdminDashboardProps) {
  const { currentUser } = useUserStore();
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "settings" | "employees" | "billing" | "hierarchy" | "security" | "compliance" | "integrations" | "budgets">(initialSubTab);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  
  const [company, setCompany] = useState<any | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Quick Plan Upgrade State
  const [tierUpdating, setTierUpdating] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Add Employee Modal
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("DEPARTMENT_MANAGER");
  const [newEmpTitle, setNewEmpTitle] = useState("");
  const [newEmpPhone, setNewEmpPhone] = useState("");
  const [newEmpDepts, setNewEmpDepts] = useState<string[]>(["sales"]);
  const [newEmpPermissions, setNewEmpPermissions] = useState({
    canApproveQuotations: true,
    canApproveInvoices: true,
    canApproveExpenses: true,
    canManageStaff: true,
    canExportReports: true,
    canViewAuditLogs: true,
    canFinalizeDocuments: true,
    canRejectDocuments: true,
    canReturnForEditing: true
  });
  const [addingEmployee, setAddingEmployee] = useState(false);

  // Edit Employee Modal
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpEmail, setEditEmpEmail] = useState("");
  const [editEmpRole, setEditEmpRole] = useState("DEPARTMENT_MANAGER");
  const [editEmpTitle, setEditEmpTitle] = useState("");
  const [editEmpPhone, setEditEmpPhone] = useState("");
  const [editEmpDepts, setEditEmpDepts] = useState<string[]>([]);
  const [editEmpPermissions, setEditEmpPermissions] = useState({
    canApproveQuotations: false,
    canApproveInvoices: false,
    canApproveExpenses: false,
    canManageStaff: false,
    canExportReports: false,
    canViewAuditLogs: false,
    canFinalizeDocuments: false,
    canRejectDocuments: false,
    canReturnForEditing: false
  });
  const [savingEmployeeEdit, setSavingEmployeeEdit] = useState(false);

  // Search & Filter in Employee Tab
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterRole, setFilterRole] = useState("all");

  const companyId = currentUser?.companyId || currentUser?.businessId || currentUser?.id;

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Real-time listener for Company profile and Employees
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Company Listener
    const compRef = doc(db, "companies", companyId);
    const unsubComp = onSnapshot(compRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCompany({ id: snap.id, ...data });
        if (data.subscriptionBillingCycle) {
          setBillingCycle(data.subscriptionBillingCycle);
        }
      } else {
        // Fallback to businesses
        getDoc(doc(db, "businesses", companyId)).then((bSnap) => {
          if (bSnap.exists()) {
            setCompany({ id: bSnap.id, ...bSnap.data() });
          }
        });
      }
      setLoading(false);
    }, (err) => {
      console.warn("Company listener notice:", err.message);
      setLoading(false);
    });

    // 2. Employees Query Listener
    const usersRef = collection(db, "users");
    const qUsers = query(usersRef, where("companyId", "==", companyId));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const list: EmployeeRecord[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as EmployeeRecord);
      });
      // Also query businessId if list is small or fallback
      if (list.length === 0) {
        const qBiz = query(usersRef, where("businessId", "==", companyId));
        getDocs(qBiz).then((bizSnap) => {
          const bizList: EmployeeRecord[] = [];
          bizSnap.forEach((d) => {
            bizList.push({ id: d.id, ...d.data() } as EmployeeRecord);
          });
          setEmployees(bizList);
        });
      } else {
        setEmployees(list);
      }
    }, (err) => {
      console.warn("Employees listener notice:", err.message);
    });

    return () => {
      unsubComp();
      unsubUsers();
    };
  }, [companyId]);

  // Handle Quick Subscription Tier Upgrade / Downgrade
  const handleSwitchPlanTier = async (newPlanId: string) => {
    if (!companyId) return;
    const targetPlan = SUBSCRIPTION_PLANS.find(p => p.id === newPlanId);
    if (!targetPlan) return;

    setTierUpdating(true);
    try {
      const lockedFeatures = getLockedFeaturesForPlan(newPlanId);
      const updatePayload = {
        subscriptionPlanId: newPlanId,
        subscriptionPlan: targetPlan.name,
        subscriptionStatus: "active",
        subscriptionBillingCycle: billingCycle,
        lockedFeatures,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, "companies", companyId), updatePayload);
      try {
        await updateDoc(doc(db, "businesses", companyId), updatePayload);
      } catch (e) {}

      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "SUBSCRIPTION_TIER_CHANGED",
        `Corporate workspace plan changed to ${targetPlan.name} (${billingCycle} billing).`,
        "settings",
        "INFO"
      );

      showToast(`Subscription plan successfully updated to ${targetPlan.name}!`, "success");
    } catch (err: any) {
      console.error("Failed to update subscription tier:", err);
      showToast(err.message || "Failed to switch plan tier.", "error");
    } finally {
      setTierUpdating(false);
    }
  };

  // Handle Add New Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !newEmpEmail.trim()) {
      showToast("Employee email is required.", "error");
      return;
    }

    setAddingEmployee(true);
    try {
      const newEmpId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const employeeDoc = {
        id: newEmpId,
        displayName: newEmpName.trim() || newEmpEmail.split("@")[0],
        email: newEmpEmail.trim().toLowerCase(),
        role: newEmpRole,
        positionTitle: newEmpTitle.trim() || (newEmpRole === "DEPARTMENT_MANAGER" ? "Department Head" : "Staff Specialist"),
        phone: newEmpPhone.trim(),
        companyId,
        businessId: companyId,
        status: "ACTIVE",
        departments: newEmpDepts,
        permissions: newEmpPermissions,
        isVerified: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", newEmpId), employeeDoc);

      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "EMPLOYEE_ENROLLED",
        `Enrolled personnel: ${employeeDoc.displayName} (${employeeDoc.email}) as ${newEmpRole} assigned to [${newEmpDepts.join(", ")}].`,
        newEmpDepts[0] || "hr",
        "INFO"
      );

      showToast(`Personnel ${employeeDoc.displayName} enrolled with scoped permissions!`, "success");
      setIsAddEmployeeModalOpen(false);
      // Reset form
      setNewEmpName("");
      setNewEmpEmail("");
      setNewEmpTitle("");
      setNewEmpPhone("");
      setNewEmpRole("DEPARTMENT_MANAGER");
      setNewEmpDepts(["sales"]);
    } catch (err: any) {
      console.error("Failed to add employee:", err);
      showToast(err.message || "Failed to create employee record.", "error");
    } finally {
      setAddingEmployee(false);
    }
  };

  // Handle Start Edit Employee
  const handleStartEditEmployee = (emp: EmployeeRecord) => {
    setEditingEmpId(emp.id);
    setEditEmpName(emp.displayName || "");
    setEditEmpEmail(emp.email || "");
    setEditEmpRole(emp.role || "STAFF");
    setEditEmpTitle(emp.positionTitle || "");
    setEditEmpPhone(emp.phone || "");
    setEditEmpDepts(emp.departments || ["sales"]);
    setEditEmpPermissions({
      canApproveQuotations: emp.permissions?.canApproveQuotations ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canApproveInvoices: emp.permissions?.canApproveInvoices ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canApproveExpenses: emp.permissions?.canApproveExpenses ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canManageStaff: emp.permissions?.canManageStaff ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canExportReports: emp.permissions?.canExportReports ?? true,
      canViewAuditLogs: emp.permissions?.canViewAuditLogs ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canFinalizeDocuments: emp.permissions?.canFinalizeDocuments ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canRejectDocuments: emp.permissions?.canRejectDocuments ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER"),
      canReturnForEditing: emp.permissions?.canReturnForEditing ?? (emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER")
    });
    setIsEditEmployeeModalOpen(true);
  };

  // Handle Save Edit Employee
  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmpId || !companyId) return;

    setSavingEmployeeEdit(true);
    try {
      const updatePayload = {
        displayName: editEmpName.trim() || editEmpEmail.split("@")[0],
        role: editEmpRole,
        positionTitle: editEmpTitle.trim(),
        phone: editEmpPhone.trim(),
        departments: editEmpDepts,
        permissions: editEmpPermissions,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, "users", editingEmpId), updatePayload);

      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "EMPLOYEE_PERMISSIONS_UPDATED",
        `Updated scoped permissions for ${editEmpName || editEmpEmail} (${editEmpRole}). Departments: [${editEmpDepts.join(", ")}].`,
        editEmpDepts[0] || "hr",
        "INFO"
      );

      showToast(`Personnel ${editEmpName || editEmpEmail} permissions updated!`, "success");
      setIsEditEmployeeModalOpen(false);
      setEditingEmpId(null);
    } catch (err: any) {
      console.error("Failed to update employee:", err);
      showToast(err.message || "Failed to update employee record.", "error");
    } finally {
      setSavingEmployeeEdit(false);
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (empId: string, empName: string) => {
    if (!confirm(`Are you sure you want to revoke access and remove ${empName}?`)) return;
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, "users", empId));
      showToast(`Employee ${empName} has been removed.`, "info");
      await logAction(
        companyId,
        currentUser?.id || "admin",
        currentUser?.email || "admin",
        "EMPLOYEE_REMOVED",
        `Employee record removed: ${empName} (${empId}).`,
        "hr",
        "WARNING"
      );
    } catch (err: any) {
      console.error("Failed to delete employee:", err);
      showToast("Failed to remove employee record.", "error");
    }
  };

  const currentPlanId = company?.subscriptionPlanId || "professional";
  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.id === currentPlanId) || SUBSCRIPTION_PLANS[2];

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      (emp.displayName?.toLowerCase() || "").includes(employeeSearch.toLowerCase()) ||
      (emp.email?.toLowerCase() || "").includes(employeeSearch.toLowerCase()) ||
      (emp.positionTitle?.toLowerCase() || "").includes(employeeSearch.toLowerCase());
    
    const matchesDept = filterDepartment === "all" || (emp.departments && emp.departments.includes(filterDepartment));
    
    let matchesRole = true;
    if (filterRole === "managers") {
      matchesRole = emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER" || emp.role === "HR" || emp.role === "FINANCE_MANAGER" || emp.role === "OPERATIONS_MANAGER";
    } else if (filterRole === "staff") {
      matchesRole = emp.role === "STAFF" || emp.role === "EMPLOYEE" || emp.role === "DEPARTMENT_STAFF";
    } else if (filterRole === "admins") {
      matchesRole = emp.role === "BUSINESS_ADMIN" || emp.role === "SUPER_ADMIN" || emp.role === "MASTER_ADMIN" || emp.role === "COMPANY_OWNER";
    }

    return matchesSearch && matchesDept && matchesRole;
  });

  const availableDepts = [
    { id: "sales", label: "Sales & CRM" },
    { id: "finance", label: "Finance & Accounts" },
    { id: "hr", label: "HR & Payroll" },
    { id: "inventory", label: "Inventory Stock" },
    { id: "projects", label: "Projects & Tasks" },
    { id: "procurement", label: "Procurement" },
    { id: "pos", label: "Point of Sale (POS)" },
    { id: "reports", label: "Reports & Analytics" },
    { id: "marketing", label: "Marketing Hub" },
    { id: "audit", label: "Security & Audit" },
    { id: "support", label: "Customer Support" },
    { id: "executive", label: "Executive Lounge" }
  ];

  return (
    <div className="w-full space-y-6 animate-fade-in font-sans pb-16 text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold transition-all border ${
          toastMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
            : toastMessage.type === "error"
            ? "bg-rose-50 text-rose-900 border-rose-200"
            : "bg-blue-50 text-blue-900 border-blue-200"
        }`}>
          {toastMessage.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {toastMessage.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          {toastMessage.type === "info" && <Shield className="w-4 h-4 text-blue-600 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Company Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/60 via-indigo-50/30 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Company Info Left */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md border-2 border-white shrink-0 overflow-hidden relative">
              {company?.logo ? (
                <Image src={company.logo} alt={company?.name || "Company"} fill className="object-cover" />
              ) : (
                <span>{(company?.name || "M").charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-150">
                  Business Administration Center
                </span>

                {/* Visual Subscription Status Badge directly from Firestore Document */}
                {(() => {
                  const rawStatus = (company?.status || company?.subscriptionStatus || 'active').toLowerCase().trim();
                  const nextDate = company?.next_billing_date || company?.nextBillingDate || company?.subscriptionRenewsAt;
                  const formattedNextDate = nextDate ? new Date(nextDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

                  if (rawStatus === 'active') {
                    return (
                      <span
                        id="badge-subscription-status"
                        title={formattedNextDate ? `Active • Next renewal on ${formattedNextDate}` : "Active Subscription"}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-250 shadow-3xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Subscription: Active</span>
                      </span>
                    );
                  }

                  if (rawStatus === 'trialing') {
                    return (
                      <span
                        id="badge-subscription-status"
                        title={formattedNextDate ? `Trial active until ${formattedNextDate}` : "Trialing Subscription"}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-250 shadow-3xs"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                        <span>Subscription: Trialing</span>
                      </span>
                    );
                  }

                  if (rawStatus === 'past_due') {
                    return (
                      <span
                        id="badge-subscription-status"
                        title="Immediate attention required: Payment past due"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 shadow-3xs animate-pulse"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>Subscription: Past Due</span>
                      </span>
                    );
                  }

                  if (rawStatus === 'canceled') {
                    return (
                      <span
                        id="badge-subscription-status"
                        title="Subscription has been canceled"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-250 shadow-3xs"
                      >
                        <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>Subscription: Canceled</span>
                      </span>
                    );
                  }

                  return (
                    <span
                      id="badge-subscription-status"
                      className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-250 shadow-3xs"
                    >
                      <PauseCircle className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>Subscription: {rawStatus.toUpperCase()}</span>
                    </span>
                  );
                })()}

                {company?.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" /> Verified Corporate Workspace
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Workspace Pending Verification
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {company?.name || "Your Corporate Workspace"}
              </h1>

              <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-3">
                {company?.industry && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" /> {company.industry}
                  </span>
                )}
                {company?.country && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {company.city ? `${company.city}, ` : ""}{company.country}
                  </span>
                )}
                {company?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {company.officialEmail || company.email}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Primary Action Right: GO TO COMPANY DASHBOARD */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsAuditDrawerOpen(true)}
              className="px-5 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>Audit Trail</span>
            </button>
            <button
              type="button"
              id="btn-go-to-company-dashboard"
              onClick={onNavigateToCompanyDashboard}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer uppercase tracking-wider group"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-100 group-hover:scale-110 transition-transform" />
              <span>Go to Company Dashboard</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Quick KPI Ticker */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-6 mt-6 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-150/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Active Tier & Health
            </span>
            <div className="flex items-center gap-1.5 font-mono text-base font-black text-indigo-700">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{currentPlan.name}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span className="capitalize font-semibold text-slate-700">
                {company?.status || company?.subscriptionStatus || 'Active'}
              </span>
              {(company?.next_billing_date || company?.nextBillingDate || company?.subscriptionRenewsAt) && (
                <span className="text-slate-400 text-[10px]">
                  Next: {new Date(company.next_billing_date || company.nextBillingDate || company.subscriptionRenewsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Team Headcount
            </span>
            <div className="flex items-center gap-1.5 font-mono text-base font-black text-slate-800">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{employees.length} Personnel</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Branch Nodes
            </span>
            <div className="flex items-center gap-1.5 font-mono text-base font-black text-slate-800">
              <Network className="w-4 h-4 text-emerald-600" />
              <span>{company?.branchCount || 1} Operational</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-150/80 p-3.5 rounded-2xl">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Security Protocol
            </span>
            <div className="flex items-center gap-1.5 font-mono text-base font-black text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>MFA & 256-Bit Guard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "overview"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Governance & Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "settings"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Business Settings & Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("employees")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "employees"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employees & Hierarchy</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-100 text-indigo-700 font-extrabold">
            {employees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("billing")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "billing"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Billing & Plan Tiers</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold uppercase">
            {currentPlan.name}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("hierarchy")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "hierarchy"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Department Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "security"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span>Zero-Trust Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("compliance")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "compliance"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>GDPR / POPIA Vault</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("integrations")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "integrations"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Webhook className="w-3.5 h-3.5 text-blue-500" />
          <span>API & ERP Webhooks</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("budgets")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition cursor-pointer shrink-0 ${
            activeSubTab === "budgets"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span>Budget Circuit Breakers</span>
        </button>
      </div>

      {/* TAB CONTENT: SECURITY */}
      {activeSubTab === "security" && (
        <EnterpriseSecurityPanel companyId={companyId || ""} currentUser={currentUser} />
      )}

      {/* TAB CONTENT: COMPLIANCE */}
      {activeSubTab === "compliance" && (
        <DataPrivacyVault companyId={companyId || ""} currentUser={currentUser} />
      )}

      {/* TAB CONTENT: INTEGRATIONS */}
      {activeSubTab === "integrations" && (
        <ApiWebhookHub companyId={companyId || ""} currentUser={currentUser} />
      )}

      {/* TAB CONTENT: BUDGETS */}
      {activeSubTab === "budgets" && (
        <DepartmentBudgetHub companyId={companyId || ""} currentUser={currentUser} />
      )}

      {/* TAB CONTENT 1: GOVERNANCE & OVERVIEW */}
      {activeSubTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Launch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Launch Operations */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                  <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Launch Company Operations</h3>
                <p className="text-xs text-blue-100 font-medium leading-relaxed">
                  Access point-of-sale, invoices, quotations, inventory, CRM, financial ledgers, and live operational nodes.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToCompanyDashboard}
                className="w-full py-2.5 bg-white text-blue-700 hover:bg-blue-50 text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Enter Company Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Manage Employees & Hierarchy */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Staff & Team Hierarchy</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Provision employee accounts, assign manager roles, manage departmental permissions, and organize corporate structure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab("employees")}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Manage Employees ({employees.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Plan Tier & Billing */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Plan Tier & Capacity</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    {currentPlan.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Upgrade or scale your workspace tier, manage automated billing cycle, download invoice statements, and unlock advanced modules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab("billing")}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Manage Subscriptions & Billing</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Department Operational Grid */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Corporate Department Nodes
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Direct portals to active business workspaces and functional units.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToCompanyDashboard}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
              >
                <span>View All In Hub</span> <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {availableDepts.slice(0, 6).map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => onNavigateTab ? onNavigateTab(dept.id) : onNavigateToCompanyDashboard()}
                  className="p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-300 rounded-2xl transition cursor-pointer text-left group"
                >
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1 group-hover:text-blue-600">
                    Node
                  </span>
                  <p className="text-xs font-extrabold text-slate-800 group-hover:text-blue-700">
                    {dept.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: BUSINESS SETTINGS & IDENTITY */}
      {activeSubTab === "settings" && (
        <div className="space-y-6 animate-fade-in">
          <CompanyProfile onCompanyLoaded={(data) => setCompany(data)} />
        </div>
      )}

      {/* TAB CONTENT 3: EMPLOYEES & HIERARCHY */}
      {activeSubTab === "employees" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Controls */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Staff & Employee Directory
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Manage all authorized personnel, position titles, department allocation, and security roles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddEmployeeModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll New Employee</span>
            </button>
          </div>

          {/* Governance & Scoped Permissions Compliance Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Corporate Governance Framework & Scoped RBAC
                </div>
                <h3 className="text-base font-black tracking-tight">
                  Principle of Least Privilege & Audit Trail Non-Repudiation
                </h3>
                <p className="text-xs text-slate-300 font-medium max-w-2xl leading-relaxed">
                  Department managers are granted scoped authorization specifically for their designated business divisions (e.g. Sales approvals, HR records, Expense clearance), preserving the integrity of audit logs in compliance with COBIT, SOC2, and ISO 27001 standards.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-white/10 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Dept Managers
                  </span>
                  <span className="text-base font-mono font-black text-white">
                    {employees.filter(e => e.role === "DEPARTMENT_MANAGER" || e.role === "MANAGER" || e.role === "HR" || e.role === "FINANCE_MANAGER").length}
                  </span>
                </div>
                <div className="bg-white/10 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Scoped Staff
                  </span>
                  <span className="text-base font-mono font-black text-white">
                    {employees.filter(e => e.role === "STAFF" || e.role === "EMPLOYEE" || e.role === "DEPARTMENT_STAFF").length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:flex-1 relative">
              <input
                type="text"
                placeholder="Search staff by name, email, or position..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-4 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="managers">Department Managers</option>
              <option value="staff">Standard Staff</option>
              <option value="admins">Business Admins</option>
            </select>

            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {availableDepts.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Employee Directory Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5">Personnel</th>
                    <th className="py-3.5 px-4">Role & Clearance</th>
                    <th className="py-3.5 px-4">Assigned Scopes</th>
                    <th className="py-3.5 px-4">Scoped Privileges</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        No employee records found matching your filters. Click &quot;Enroll New Employee&quot; to assign department managers.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isManager = emp.role === "DEPARTMENT_MANAGER" || emp.role === "MANAGER" || emp.role === "HR" || emp.role === "FINANCE_MANAGER";
                      const isAdmin = emp.role === "SUPER_ADMIN" || emp.role === "BUSINESS_ADMIN" || emp.role === "MASTER_ADMIN";
                      
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-xl font-black flex items-center justify-center text-sm shrink-0 border ${
                                isAdmin
                                  ? "bg-purple-100 text-purple-800 border-purple-200"
                                  : isManager
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {(emp.displayName || emp.email || "E").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  {emp.displayName || "Staff Member"}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                  {emp.positionTitle || "Specialist"} • <span className="font-mono">{emp.email}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              isAdmin
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : isManager
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              {emp.role?.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(emp.departments && emp.departments.length > 0 ? emp.departments : ["sales"]).map(d => (
                                <span key={d} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9px] font-bold uppercase border border-slate-200">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {emp.permissions?.canApproveQuotations && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-extrabold border border-emerald-200">
                                  Quotes/Invoices
                                </span>
                              )}
                              {emp.permissions?.canApproveExpenses && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-extrabold border border-indigo-200">
                                  Expenses
                                </span>
                              )}
                              {emp.permissions?.canManageStaff && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-extrabold border border-amber-200">
                                  Staff Mgmt
                                </span>
                              )}
                              {emp.permissions?.canViewAuditLogs && (
                                <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[9px] font-extrabold border border-sky-200">
                                  Audit Access
                                </span>
                              )}
                              {!emp.permissions?.canApproveQuotations && !emp.permissions?.canApproveExpenses && !emp.permissions?.canManageStaff && (
                                <span className="text-[10px] text-slate-400 italic">Operational Execution</span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditEmployee(emp)}
                                className="px-2.5 py-1 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 border border-slate-200 transition cursor-pointer text-[11px] font-bold"
                                title="Edit Scoped Permissions"
                              >
                                Edit Scope
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEmployee(emp.id, emp.displayName || emp.email)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Revoke Access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: BILLING & SUBSCRIPTION TIERS */}
      {activeSubTab === "billing" && (
        <div className="space-y-6 animate-fade-in">
          {/* Unified Subscriptions & Billing Center with Payment Gateway Integration */}
          <SubscriptionsView />
        </div>
      )}

      {/* TAB CONTENT 5: DEPARTMENT MATRIX & HIERARCHY */}
      {activeSubTab === "hierarchy" && (
        <div className="space-y-6 animate-fade-in">
          <DepartmentManager />
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Enroll New Team Member
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Assign role, corporate email, and departmental authority.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEmployeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sipho Dlamini"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Corporate Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sipho@company.com"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Position Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Head of Sales / Lead Accountant"
                    value={newEmpTitle}
                    onChange={(e) => setNewEmpTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Security & RBAC Role
                  </label>
                  <select
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                  >
                    <option value="DEPARTMENT_MANAGER">Department Manager (Scoped Clearance)</option>
                    <option value="STAFF">Standard Staff (Operational Execution)</option>
                    <option value="FINANCE_MANAGER">Finance Manager (Ledger & Accounts)</option>
                    <option value="HR">HR Officer (Personnel & Payroll)</option>
                    <option value="BUSINESS_ADMIN">Business Admin (Global Governance)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +27 82 123 4567"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Assigned Departments (Least-Privilege Scoping)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {availableDepts.map((d) => (
                    <label key={d.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEmpDepts.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEmpDepts([...newEmpDepts, d.id]);
                          } else {
                            setNewEmpDepts(newEmpDepts.filter(id => id !== d.id));
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span className="truncate">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Granular Scoped Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canApproveQuotations}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canApproveQuotations: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Approve Quotes & Invoices</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canApproveExpenses}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canApproveExpenses: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Approve Department Expenses</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canManageStaff}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canManageStaff: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Manage Department Staff</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canViewAuditLogs}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canViewAuditLogs: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>View Scoped Audit Logs</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canExportReports}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canExportReports: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Export Department Reports</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmpPermissions.canFinalizeDocuments}
                      onChange={(e) => setNewEmpPermissions({ ...newEmpPermissions, canFinalizeDocuments: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Finalize Operational Records</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEmployee}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  {addingEmployee && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enroll Personnel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE SCOPED PERMISSIONS */}
      {isEditEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Edit Scoped Clearance & Role
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Modify departmental privileges without granting global admin permissions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditEmployeeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditEmployee} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editEmpName}
                  onChange={(e) => setEditEmpName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Corporate Email (Read Only)
                </label>
                <input
                  type="email"
                  disabled
                  value={editEmpEmail}
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Position Title
                  </label>
                  <input
                    type="text"
                    value={editEmpTitle}
                    onChange={(e) => setEditEmpTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Security Role
                  </label>
                  <select
                    value={editEmpRole}
                    onChange={(e) => setEditEmpRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  >
                    <option value="DEPARTMENT_MANAGER">Department Manager (Scoped)</option>
                    <option value="STAFF">Standard Staff (Operational)</option>
                    <option value="FINANCE_MANAGER">Finance Manager</option>
                    <option value="HR">HR Officer</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Assigned Departments
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {availableDepts.map((d) => (
                    <label key={d.id} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editEmpDepts.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditEmpDepts([...editEmpDepts, d.id]);
                          } else {
                            setEditEmpDepts(editEmpDepts.filter(id => id !== d.id));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-0"
                      />
                      <span className="truncate">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Granular Scoped Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canApproveQuotations}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canApproveQuotations: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Approve Quotes & Invoices</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canApproveExpenses}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canApproveExpenses: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Approve Department Expenses</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canManageStaff}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canManageStaff: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Manage Department Staff</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canViewAuditLogs}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canViewAuditLogs: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>View Scoped Audit Logs</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canExportReports}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canExportReports: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Export Department Reports</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEmpPermissions.canFinalizeDocuments}
                      onChange={(e) => setEditEmpPermissions({ ...editEmpPermissions, canFinalizeDocuments: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Finalize Operational Records</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEmployeeEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  {savingEmployeeEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Scoped Permissions</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AuditTrailDrawer 
        isOpen={isAuditDrawerOpen} 
        onClose={() => setIsAuditDrawerOpen(false)} 
        companyId={companyId} 
      />
    </div>
  );
}
