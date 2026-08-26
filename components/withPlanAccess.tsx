"use client";

import React, { useEffect, useState } from "react";
import { useUserStore } from "../lib/store";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { checkCompanyPlanAccess, PlanAccessCheckResult } from "../lib/planAccess";
import { Lock, Sparkles, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

interface WithPlanAccessProps {
  onUpgradeClick?: () => void;
  onBack?: () => void;
  [key: string]: any;
}

/**
 * Hook to check if the active company subscription tier allows access to a module.
 */
export function usePlanAccess(moduleKey: string) {
  const { currentUser } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [accessResult, setAccessResult] = useState<PlanAccessCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function evaluatePlan() {
      if (!currentUser?.businessId) {
        if (isMounted) {
          setAccessResult(checkCompanyPlanAccess(null, moduleKey));
          setLoading(false);
        }
        return;
      }

      // Master admin bypasses all subscription locks
      if (currentUser.role === "MASTER_ADMIN" || currentUser.email === "miratechindustries@gmail.com") {
        if (isMounted) {
          setAccessResult({
            allowed: true,
            currentPlanId: "enterprise",
            currentPlanName: "Master Administrator",
            requiredPlanId: "starter",
            requiredPlanName: "Starter",
            requiredPlanPrice: 0,
            featureLabel: moduleKey,
            featureDescription: "Full administrative access granted.",
          });
          setLoading(false);
        }
        return;
      }

      try {
        const companyRef = doc(db, "companies", currentUser.businessId);
        const snap = await getDoc(companyRef);
        if (snap.exists()) {
          const compData = snap.data();
          const result = checkCompanyPlanAccess(compData, moduleKey);
          if (isMounted) setAccessResult(result);
        } else {
          if (isMounted) setAccessResult(checkCompanyPlanAccess(null, moduleKey));
        }
      } catch (err) {
        console.error("Plan access check error:", err);
        if (isMounted) setAccessResult(checkCompanyPlanAccess(null, moduleKey));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    evaluatePlan();

    return () => {
      isMounted = false;
    };
  }, [currentUser, moduleKey]);

  return { loading, accessResult, allowed: accessResult?.allowed ?? false };
}

/**
 * Plan Upgrade Gate Banner Component displayed when a module is locked.
 */
export function PlanUpgradeGate({
  accessResult,
  onUpgradeClick,
  onBack,
}: {
  accessResult: PlanAccessCheckResult | null;
  onUpgradeClick?: () => void;
  onBack?: () => void;
}) {
  const reqName = accessResult?.requiredPlanName || "Upgraded";
  const featName = accessResult?.featureLabel || "This Module";
  const desc = accessResult?.featureDescription || "Advanced business workflow module.";
  const currentPlan = accessResult?.currentPlanName || "Starter";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-6 shadow-sm my-8 animate-fade-in font-sans">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-150 shadow-inner">
        <Lock className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" /> Plan Tier Upgrade Required
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          {featName} is locked under {currentPlan}
        </h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
          {desc} To activate this module and elevate your operational capacity, upgrade your workspace subscription to the <strong className="text-slate-800">{reqName}</strong> tier.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Required Plan Level:</span>
          <span className="text-indigo-600 font-extrabold uppercase">{reqName}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Your Active Plan:</span>
          <span className="text-slate-500 font-semibold">{currentPlan}</span>
        </div>
        <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Includes priority security, multi-user provisioning & data compliance.</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Back to Hub
          </button>
        )}
        <button
          type="button"
          onClick={onUpgradeClick}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
        >
          Upgrade to {reqName} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Higher Order Component (HOC) to wrap application components with plan-level gating.
 */
export function withPlanAccess<P extends WithPlanAccessProps>(
  WrappedComponent: React.ComponentType<P>,
  moduleKey: string
) {
  return function WithPlanAccessComponent(props: P) {
    const { loading, accessResult, allowed } = usePlanAccess(moduleKey);

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[300px] space-y-3">
          <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-bold tracking-wider uppercase font-mono">
            Verifying subscription entitlement...
          </span>
        </div>
      );
    }

    if (!allowed) {
      return (
        <PlanUpgradeGate
          accessResult={accessResult}
          onUpgradeClick={props.onUpgradeClick}
          onBack={props.onBack}
        />
      );
    }

    return <WrappedComponent {...props} />;
  };
}
