'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ArrowRight, 
  Building2, 
  Mail, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  Check, 
  Layers, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

interface ProvisioningSuccessModalProps {
  isOpen: boolean;
  onComplete: () => void;
  companyName?: string;
  accountEmail?: string;
  planName?: string;
  modulesCount?: number;
  staffCount?: number;
  currency?: string;
}

export default function ProvisioningSuccessModal({
  isOpen,
  onComplete,
  companyName = 'Corporate Organization',
  accountEmail = '',
  planName = 'Enterprise Tier',
  modulesCount = 4,
  staffCount = 0,
  currency = 'USD'
}: ProvisioningSuccessModalProps) {
  const [countdown, setCountdown] = useState(6);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-redirect timer with countdown
  useEffect(() => {
    if (!isOpen || isPaused) return;

    if (countdown <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown, isPaused, onComplete]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(6);
      setIsPaused(false);
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyDetails = async () => {
    const details = `Organization: ${companyName}\nAdmin: ${accountEmail}\nPlan: ${planName}\nWorkspace URL: ${typeof window !== 'undefined' ? window.location.origin + '/dashboard' : 'https://miratechsuite.com/dashboard'}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(details);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (_) {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="provisioning-success-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
        >
          <motion.div
            id="provisioning-success-card"
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden"
          >
            {/* Top celebratory ambient glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Icon & Title Header */}
            <div className="text-center space-y-3">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.15, 
                  type: 'spring', 
                  stiffness: 260, 
                  damping: 18 
                }}
                className="relative w-20 h-20 mx-auto"
              >
                <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, type: 'spring' }}
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </motion.div>
              </motion.div>

              <div className="space-y-1">
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Tenant Ready & Active
                </motion.span>
                <motion.h2 
                  id="success-modal-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-2xl font-black text-slate-900 tracking-tight"
                >
                  Workspace Provisioned!
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs text-slate-600 max-w-sm mx-auto"
                >
                  Your enterprise tenant database, security roles, and admin authority have been initialized successfully.
                </motion.p>
              </div>
            </div>

            {/* Tenant Metadata Summary Card */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-none">{companyName}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Primary Organization</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {planName}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate" title={accountEmail}>{accountEmail || 'Administrator'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{modulesCount} Core Modules Active</span>
                </div>
              </div>
            </motion.div>

            {/* Auto-Redirect Countdown Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>
                    {isPaused 
                      ? 'Auto-launch paused' 
                      : `Redirecting to dashboard in ${countdown}s...`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
                >
                  {isPaused ? 'Resume auto-launch' : 'Pause'}
                </button>
              </div>

              {/* Progress bar tracking countdown */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: isPaused ? `${(countdown / 6) * 100}%` : '0%' }}
                  transition={{ duration: isPaused ? 0 : countdown, ease: 'linear' }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="space-y-2.5 pt-1"
            >
              <motion.button
                id="btn-enter-workspace"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={onComplete}
                className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition cursor-pointer"
              >
                <span>Enter Workspace Now</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              <button
                type="button"
                onClick={handleCopyDetails}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Workspace Details Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Workspace Access Details</span>
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
