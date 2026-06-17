"use client";

import { useState, useEffect } from "react";
import { Bell, Smartphone, X, Check, Laptop } from "lucide-react";

export default function InstallPrompt() {
  const [isChrome, setIsChrome] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installedStatus, setInstalledStatus] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if running on Google Chrome browser
    const ua = navigator.userAgent;
    const isChromeBrowser = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua);
    
    // Detect standalone PWA mode
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;

    setIsChrome(isChromeBrowser);

    // If already launched inside PWA standalone mode
    if (isStandalone) {
      setInstalledStatus(true);
      return;
    }

    // Capture the PWA install event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-display if on Chrome
      if (isChromeBrowser) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // As a backup, if it is Chrome browser and not standalone, show the prompt to guide users
    // We can show it after a tiny 1.5s delay for a smoother loading feel.
    const timer = setTimeout(() => {
      if (isChromeBrowser && !isStandalone) {
        // Verify user didn't previously dismiss it in this session
        const dismissed = sessionStorage.getItem("mira_install_dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger the official Chrome prompt flow
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalledStatus(true);
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions modal or guide for adding to home screen
      alert(
        "To install on Chrome:\n\n1. Click the '...' (three dots) menu in the top right corner.\n2. Tap 'Save as app' or 'Add to Home screen'.\n3. Enjoy offline workspace access and faster alerts!"
      );
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("mira_install_dismissed", "true");
  };

  if (!showPrompt || installedStatus) return null;

  return (
    <div 
      id="chrome-install-notification-wrapper"
      className="fixed bottom-6 right-6 z-100 max-w-sm w-full bg-[#0F172A]/95 text-white border border-[#38BDF8]/40 backdrop-blur-md rounded-2xl shadow-2xl p-4 md:p-5 font-sans animate-fade-in transition-all duration-300"
      style={{ boxShadow: "0 10px 25px -5px rgba(56, 189, 248, 0.25)" }}
    >
      <div className="flex gap-4">
        {/* Pulsing Neon Icon Box */}
        <div className="relative flex-shrink-0 h-10 w-10 bg-[#0F172A] border border-[#38BDF8]/50 rounded-xl flex items-center justify-center">
          <span className="absolute inset-0 rounded-xl bg-[#38BDF8]/20 animate-ping" />
          <Bell className="h-5 w-5 text-[#38BDF8]" />
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="text-xs font-black tracking-wider text-[#38BDF8] uppercase">
              Install notifications
            </h4>
            <button 
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-md transition duration-150"
              aria-label="Dismiss panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] font-bold text-slate-205 leading-relaxed mt-1">
            Install the MiraTech Business suite to get push notifications, ledger alerts, and active home screen status on Chrome!
          </p>
          
          <div className="mt-3.5 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 px-3 bg-[#38BDF8] hover:bg-[#0EA5E9] text-slate-950 rounded-lg shadow-sm transition duration-150 text-center cursor-pointer flex items-center justify-center gap-1"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Add to Screen
            </button>
            <button
              onClick={handleDismiss}
              className="text-[10px] font-bold py-1.5 px-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-lg transition duration-200"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
