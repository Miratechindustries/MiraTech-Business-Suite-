"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Clock, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronUp, 
  ChevronDown, 
  HelpCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface TrialCompanyInfo {
  name?: string;
  subscriptionStatus?: string;
  subscriptionPlanId?: string;
  subscriptionTrialEndsAt?: string;
  trialEndsAt?: string;
  createdAt?: string;
  status?: string;
  paddleSubscriptionId?: string;
}

interface TrialDaysIndicatorProps {
  company: TrialCompanyInfo | null;
  onUpgradeClick?: () => void;
  onContactSupport?: () => void;
  className?: string;
}

export default function TrialDaysIndicator({
  company,
  onUpgradeClick,
  onContactSupport,
  className = "",
}: TrialDaysIndicatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Update time every minute to keep dynamic countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute evaluation status and metrics
  const trialMetrics = useMemo(() => {
    if (!company) return null;

    const rawStatus = (company.subscriptionStatus || company.status || "").toLowerCase();
    const hasTrialDate = Boolean(company.subscriptionTrialEndsAt || company.trialEndsAt);

    // Identify if the company is in evaluation period
    const isTrialStatus = rawStatus === "trialing" || (!rawStatus && hasTrialDate);

    // If company is already paid/active and has no trial status, do not display
    if (rawStatus === "active" && !company.subscriptionTrialEndsAt?.includes("trial")) {
      return null;
    }

    if (!isTrialStatus && !hasTrialDate) {
      return null;
    }

    // Resolve trial end date
    let trialEndMs = 0;
    const dateStr = company.subscriptionTrialEndsAt || company.trialEndsAt;

    if (dateStr) {
      const parsed = new Date(dateStr).getTime();
      if (!isNaN(parsed)) {
        trialEndMs = parsed;
      }
    }

    // Fallback: If no explicit trial end timestamp is found, compute 14 days from createdAt or now
    if (!trialEndMs) {
      if (company.createdAt) {
        const createdMs = new Date(company.createdAt).getTime();
        if (!isNaN(createdMs)) {
          trialEndMs = createdMs + 14 * 24 * 60 * 60 * 1000;
        }
      }
    }

    if (!trialEndMs) {
      trialEndMs = currentTime + 14 * 24 * 60 * 60 * 1000;
    }

    const diffMs = trialEndMs - currentTime;
    const isExpired = diffMs <= 0;

    // Remaining calculations
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

    // Total evaluation is 14 days
    const totalTrialDays = 14;
    const daysElapsed = Math.min(totalTrialDays, Math.max(0, totalTrialDays - daysRemaining));
    const currentDayNumber = Math.min(totalTrialDays, Math.max(1, daysElapsed + 1));
    const progressPercentage = Math.min(100, Math.max(4, Math.round((daysElapsed / totalTrialDays) * 100)));

    // Formatted end date string
    const formattedEndDate = new Date(trialEndMs).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const planName = company.subscriptionPlanId 
      ? company.subscriptionPlanId.charAt(0).toUpperCase() + company.subscriptionPlanId.slice(1)
      : "Enterprise Suite";

    return {
      isExpired,
      daysRemaining,
      hoursRemaining,
      daysElapsed,
      currentDayNumber,
      totalTrialDays,
      progressPercentage,
      formattedEndDate,
      planName,
    };
  }, [company, currentTime]);

  if (!trialMetrics) {
    return null;
  }

  const {
    isExpired,
    daysRemaining,
    hoursRemaining,
    currentDayNumber,
    totalTrialDays,
    progressPercentage,
    formattedEndDate,
    planName,
  } = trialMetrics;

  // Determine urgency tier for styling
  const isUrgent = isExpired || daysRemaining <= 3;
  const isCritical = isExpired || daysRemaining <= 1;

  return (
    <div 
      id="trial-evaluation-indicator-container"
      className={`w-full transition-all duration-200 ${className}`}
    >
      <div 
        className={`rounded-2xl border shadow-sm transition-all overflow-hidden ${
          isCritical 
            ? "bg-rose-50/90 border-rose-200 text-rose-950" 
            : isUrgent 
            ? "bg-amber-50/90 border-amber-200 text-amber-950" 
            : "bg-gradient-to-r from-blue-50/95 via-indigo-50/80 to-slate-50 border-blue-200 text-slate-900"
        }`}
      >
        {/* Top Minimal Strip (Always visible or toggled) */}
        <div className="px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Badge & Live Countdown */}
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className={`p-2 rounded-xl flex items-center justify-center flex-shrink-0 shadow-3xs ${
                isCritical 
                  ? "bg-rose-600 text-white animate-pulse" 
                  : isUrgent 
                  ? "bg-amber-500 text-white" 
                  : "bg-blue-600 text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border ${
                    isCritical
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : isUrgent
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-blue-100 text-blue-700 border-blue-200"
                  }`}
                >
                  14-Day Free Evaluation
                </span>

                <span className="text-xs font-black tracking-tight text-slate-800 flex items-center gap-1.5">
                  {isExpired ? (
                    <span className="text-rose-600 font-extrabold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Evaluation Period Concluded
                    </span>
                  ) : daysRemaining === 1 ? (
                    <span className="text-amber-700 font-extrabold">
                      Last Day Remaining ({hoursRemaining}h left)
                    </span>
                  ) : (
                    <span className="font-extrabold">
                      <strong className="text-blue-700 font-black text-sm">{daysRemaining} Days</strong> Remaining
                    </span>
                  )}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">
                Evaluating <strong className="text-slate-700 font-semibold">{planName}</strong> with full enterprise access until {formattedEndDate}.
              </p>
            </div>
          </div>

          {/* Right: Actions & Collapse Toggle */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {onContactSupport && (
              <button
                type="button"
                id="btn-trial-contact-support"
                onClick={onContactSupport}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer shadow-3xs"
                title="Quick inquiries regarding your evaluation"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Need Help?</span>
              </button>
            )}

            {onUpgradeClick && (
              <button
                type="button"
                id="btn-trial-upgrade-plan"
                onClick={onUpgradeClick}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl transition cursor-pointer shadow-sm text-white ${
                  isCritical 
                    ? "bg-rose-600 hover:bg-rose-700" 
                    : isUrgent 
                    ? "bg-amber-600 hover:bg-amber-700" 
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isExpired ? "Activate License" : "Upgrade Plan"}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              id="btn-trial-collapse-toggle"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-lg transition cursor-pointer"
              title={isCollapsed ? "Expand trial progress details" : "Collapse trial banner"}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Detailed Expandable Section with Progress Bar */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 pb-3.5 pt-1 border-t border-slate-200/60"
            >
              <div className="space-y-2">
                {/* Visual Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600 flex items-center gap-1">
                      <span>Day {currentDayNumber} of {totalTrialDays}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 font-normal">All modules unlocked (Sales, HR, Ledger, Projects, Inventory)</span>
                    </span>
                    <span className="text-slate-700 font-extrabold">{progressPercentage}% Elapsed</span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCritical 
                          ? "bg-rose-500" 
                          : isUrgent 
                          ? "bg-amber-500" 
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Subtext info */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                    <span>No upfront payment required during evaluation. Your ledgers and team records persist automatically.</span>
                  </span>

                  <span className="text-slate-400 font-medium">
                    Questions? Reach our enterprise desk anytime via the floating support button.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
