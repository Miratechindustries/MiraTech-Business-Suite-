"use client";

import React, { useEffect, useState } from "react";
import { useUserStore } from "../lib/store";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShieldAlert, Loader2 } from "lucide-react";

export interface DepartmentAccessResult {
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  enabledModules: string[];
  userDepartments: string[];
}

/**
 * Custom React Hook to query and verify the current user's security level
 * and department privileges, alongside tenant-specific active modules.
 */
export function useDepartmentAccess(departmentType: string): DepartmentAccessResult {
  const { currentUser } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setHasAccess(false);
      return;
    }

    async function checkAccess() {
      try {
        const businessId = currentUser.businessId;
        if (!businessId) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        // 1. Query Tenant-specific modules enabled status
        const companyRef = doc(db, "companies", businessId);
        const companySnap = await getDoc(companyRef);
        let modules: string[] = [];

        if (companySnap.exists()) {
          const compData = companySnap.data();
          modules = compData.enabledModules || compData.modules || [
            "hr", "finance", "sales", "inventory", "reports", "audit"
          ];
        } else {
          // Fallback default modules
          modules = ["hr", "finance", "sales", "inventory", "reports", "audit", "marketing", "projects", "support", "procurement", "administration", "executive"];
        }
        setEnabledModules(modules);

        const depLower = departmentType.toLowerCase();
        
        // Settings & subscriptions bypass enabled module flags for core accessibility
        const isCoreModule = depLower === "settings" || depLower === "subscriptions" || depLower === "dashboard";
        const isModuleEnabled = isCoreModule || modules.includes(depLower);

        // 2. Query individual User-specific department rights
        const userRef = doc(db, "users", currentUser.id);
        const userSnap = await getDoc(userRef);
        let allowedDepts: string[] = [];

        if (userSnap.exists()) {
          const userData = userSnap.data();
          allowedDepts = userData.departments || userData.allowedDepartments || [];
        }
        setUserDepartments(allowedDepts);

        // 3. Execute RBAC evaluation rules
        const userRole = (currentUser.role || "").toUpperCase();
        const isMasterOrBusinessAdmin = userRole === "MASTER_ADMIN" || userRole === "SUPER_ADMIN" || userRole === "BUSINESS_ADMIN" || userRole === "COMPANY_OWNER";
        
        let hasPerm = false;
        if (isMasterOrBusinessAdmin) {
          hasPerm = true; // Business Admins inherit administrative governance across the company
        } else {
          // Core modules (dashboard overview, settings)
          if (isCoreModule) {
            hasPerm = true;
          } else {
            // Check specific role shortcuts
            if (userRole === "HR" && depLower === "hr") {
              hasPerm = true;
            } else if (userRole === "FINANCE_MANAGER" && (depLower === "finance" || depLower === "procurement")) {
              hasPerm = true;
            } else if ((userRole === "DEPARTMENT_MANAGER" || userRole === "MANAGER" || userRole === "STAFF" || userRole === "DEPARTMENT_STAFF") && allowedDepts.length > 0) {
              hasPerm = allowedDepts.map(d => d.toLowerCase()).includes(depLower);
            } else {
              hasPerm = allowedDepts.map(d => d.toLowerCase()).includes(depLower);
            }
          }
        }

        setHasAccess(isModuleEnabled && hasPerm);
      } catch (err) {
        console.error("Access evaluation error:", err);
        setError("Error validating department level privileges.");
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [currentUser, departmentType]);

  return { hasAccess, loading, error, enabledModules, userDepartments };
}

/**
 * Higher-Order Component (HOC) to wrap routes/views with strict tenant-module check
 * and user role/department-level permission checks.
 */
export function withDepartmentAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  departmentType: string
) {
  return function WithDepartmentAccessComponent(props: P & { onUpgradeClick?: () => void; [key: string]: any }) {
    const { hasAccess, loading } = useDepartmentAccess(departmentType);

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[300px] space-y-3">
          <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase font-mono">Securing gateway...</span>
        </div>
      );
    }

    if (!hasAccess) {
      return (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto text-center space-y-4 shadow-xs mt-12 animate-fade-in">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
              Governance & Least-Privilege Gate
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Department Access Restricted
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Your user credentials are not assigned to the <span className="font-bold uppercase text-indigo-600 font-mono">{departmentType}</span> division, or this operational module has been toggled offline by your Business Administrator.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 font-medium text-left space-y-1">
            <span className="font-bold text-slate-700 block">Corporate Governance Policy:</span>
            <span>Department managers and staff operate under strictly scoped role privileges to maintain audit ledger integrity and segregation of duties.</span>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props as P} />;
  };
}
