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
          modules = ["hr", "finance", "sales", "inventory", "reports", "audit", "marketing"];
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
        const isUserAdmin = currentUser.role === "MASTER_ADMIN" || currentUser.role === "BUSINESS_ADMIN";
        
        let hasPerm = false;
        if (isUserAdmin) {
          hasPerm = true; // Administrators inherit access to all active departments
        } else {
          // Core modules are visible to staff; other modules require assigned departments
          hasPerm = isCoreModule || allowedDepts.map(d => d.toLowerCase()).includes(depLower);
        }

        setHasAccess(isModuleEnabled && hasPerm);
      } catch (err) {
        console.error("Access valuation error:", err);
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
  return function WithDepartmentAccessComponent(props: P) {
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
        <div className="bg-white border border-slate-250 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 shadow-3xs mt-12 animate-fade-in">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">
              Administrative Gate
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Your security clear level is insufficient for the <span className="font-bold uppercase text-indigo-600 font-mono">{departmentType}</span> department, or this specific module has been toggled offline by the organization administrator.
            </p>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold italic">
            Please log dynamic authorizations request with your corporate tenant lead.
          </p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
