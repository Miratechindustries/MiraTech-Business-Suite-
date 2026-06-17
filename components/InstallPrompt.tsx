"use client";

import { useState, useEffect } from "react";
import { 
  Bell, 
  Smartphone, 
  X, 
  CheckCircle2, 
  HardDrive, 
  ShieldAlert, 
  Sparkles, 
  TrendingUp, 
  ArrowRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function InstallPrompt() {
  const [isChrome, setIsChrome] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installedStatus, setInstalledStatus] = useState(false);
  
  // Permissions State
  const [notificationStatus, setNotificationStatus] = useState<PermissionState | "default">("default");
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [storageQuota, setStorageQuota] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [step, setStep] = useState<"onboarding" | "completed">("onboarding");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if running on Google Chrome browser
    const ua = navigator.userAgent;
    const isChromeBrowser = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua);
    setIsChrome(isChromeBrowser);

    // Detect standalone PWA mode
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setInstalledStatus(true);
    }

    // Read initial Notification Permission
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }

    // Read Storage Persisted Status
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((persisted) => {
        setStoragePersisted(persisted);
      });
    }

    // Load static storage estimates
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setStorageQuota({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      });
    }

    // Capture Chrome's native beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-display panel if we are on Chrome of any kind and not standalone launched
      if (isChromeBrowser && !isStandalone) {
        const dismissed = sessionStorage.getItem("mira_install_dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Fade in gracefully after 2 seconds for a smoother initial brand loading feel
    const timer = setTimeout(() => {
      if (isChromeBrowser && !isStandalone) {
        const dismissed = sessionStorage.getItem("mira_install_dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  // Request notifications
  const handleRequestNotifications = async () => {
    if (!("Notification" in window)) {
      alert("This browser workspace layout does not support native push notification triggers.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === "granted") {
        new Notification("Install notifications", {
          body: "Secure alerts are successfully activated! You will receive transaction, document, and sync reminders in real-time.",
          icon: "/icon.png",
          badge: "/icon.png"
        });
      }
    } catch (err) {
      console.error("Notifications solicitation failed:", err);
    }
  };

  // Request storage persistence
  const handleRequestStorage = async () => {
    if (!navigator.storage || !navigator.storage.persist) {
      alert("Local storage query control is restricted in this environment.");
      return;
    }

    try {
      const status = await navigator.storage.persist();
      setStoragePersisted(status);
      if (status) {
        alert("Persistence locked! Workspace cache won't be cleared automatically by the browser.");
      } else {
        alert("Persistence requested. Browser has noted preference, final caching status will load on system activity.");
      }
    } catch (err) {
      console.error("Storage persistence lock failed:", err);
    }
  };

  // Trigger Chrome Install Prompt Flow
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalledStatus(true);
        setStep("completed");
        // Automatically fetch notifications and storage settings post-installation
        await handleRequestNotifications();
        await handleRequestStorage();
      }
      setDeferredPrompt(null);
    } else {
      // Manual backup alert explanation
      alert(
        "To save MiraTech directly as an app on your computer or mobile screen:\n\n1. Click Chrome's top-right custom action menu (icon of three dots or a direct download arrow in your url tab).\n2. Tap 'Save as app' or 'Cast, save and share' -> 'Install app'.\n3. Push notifications & persistent local storage locks will enable instantly upon launch!"
      );
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("mira_install_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        id="chrome-onboarding-panel-outer"
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="fixed bottom-6 right-6 z-[9999] max-w-md w-11/12 sm:w-full bg-slate-900 border border-[#38BDF8]/40 text-white rounded-2xl shadow-[0_20px_50px_rgba(56,189,248,0.15)] flex flex-col font-sans"
      >
        {/* Subtle Decorative Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-[#38BDF8] rounded-t-2xl" />

        <div className="p-4 sm:p-5">
          {/* Header row */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 flex-shrink-0 bg-slate-800 border border-[#38BDF8]/30 rounded-xl flex items-center justify-center">
                <span className="absolute inset-0 bg-[#38BDF8]/10 animate-ping rounded-xl duration-1000" />
                <Bell className="h-4.5 w-4.5 text-[#38BDF8]" />
              </div>
              <div>
                <span className="text-[9px] font-black tracking-widest text-[#38BDF8] uppercase block">
                  Chrome Workstation
                </span>
                <h3 className="text-xs font-bold text-white uppercase mt-0.5 tracking-wider">
                  Install notifications
                </h3>
              </div>
            </div>
            
            <button 
              onClick={handleDismiss}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition duration-150"
              aria-label="Dismiss panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="mt-3.5 space-y-3">
            <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
              Activate real-time push alerts and persistent local storage cache. Saving MiraTech on your desktop or mobile Chrome secures offline ledger tables automatically.
            </p>

            {/* Quick Interactive Status Badges with Call to Actions */}
            <div className="space-y-2 pt-1">
              
              {/* Row 1: Push Alerts */}
              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-blue-400" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-200 block">Push Live Alerts</span>
                    <span className="text-[9px] text-slate-400 block leading-none">Instant desktop / mobile notices</span>
                  </div>
                </div>
                {notificationStatus === "granted" ? (
                  <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Authorized
                  </span>
                ) : (
                  <button 
                    onClick={handleRequestNotifications}
                    className="text-[9px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 py-1 px-2.5 rounded-md cursor-pointer transition"
                  >
                    Allow
                  </button>
                )}
              </div>

              {/* Row 2: Persistent Storage */}
              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-200 block">Safe Storage Access</span>
                    <span className="text-[9px] text-slate-400 block leading-none">Locks browser db cash limits</span>
                  </div>
                </div>
                {storagePersisted ? (
                  <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Persisted
                  </span>
                ) : (
                  <button 
                    onClick={handleRequestStorage}
                    className="text-[9px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 py-1 px-2.5 rounded-md cursor-pointer transition"
                  >
                    Grant
                  </button>
                )}
              </div>

            </div>

            {/* Quick Chrome Install Notice Info Footer */}
            <div className="p-2.5 bg-slate-950 border border-[#38BDF8]/15 rounded-lg flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-400 leading-normal">
                To complete client integration, click the button below to add to home screen stand-alone app.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="mt-4 flex gap-2 pt-0.5">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-blue-500 to-[#38BDF8] hover:from-blue-600 hover:to-sky-400 text-slate-950 text-[10px] font-black uppercase tracking-wider py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                Install Web App
              </button>
              <button
                onClick={handleDismiss}
                className="bg-transparent hover:bg-white/15 border border-slate-700 hover:border-slate-500 text-slate-300 text-[10px] p-2 rounded-lg font-bold transition duration-200"
              >
                Later
              </button>
            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
