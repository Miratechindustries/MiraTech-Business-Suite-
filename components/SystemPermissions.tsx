"use client";

import { useState, useEffect } from "react";
import { 
  Bell, 
  HardDrive, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  ChevronRight,
  ShieldAlert, 
  Database,
  RefreshCw,
  Sparkles
} from "lucide-react";

export default function SystemPermissions() {
  const [notificationStatus, setNotificationStatus] = useState<"granted" | "denied" | "prompt" | "default">("default");
  const [isStandalone, setIsStandalone] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [storageQuota, setStorageQuota] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [browserType, setBrowserType] = useState({ isChrome: false, isSafari: false, isIOS: false, isAndroid: false });
  const [activeTestAlert, setActiveTestAlert] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect browser environment
    const ua = navigator.userAgent.toLowerCase();
    const isChrome = /chrome|crios/i.test(ua) && !/edg/i.test(ua) && !/opr/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios/i.test(ua);
    const isIOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    
    setBrowserType({ isChrome, isSafari, isIOS, isAndroid });

    // Detect PWA Mode
    const isStandAloneMode = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandAloneMode);

    // Read Notification Permission
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }

    // Read Storage Persist and Quote Status
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((persisted) => {
        setStoragePersisted(persisted);
      });
    }

    updateStorageEstimates();
  }, []);

  const updateStorageEstimates = () => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setStorageQuota({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      });
    }
  };

  // Request Notification Permissions
  const handleRequestNotifications = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support standard push notifications.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === "granted") {
        new Notification("MiraTech Workspace", {
          body: "Push notification authorization secured! Offline alerts are now live.",
          icon: "/icon.png",
          badge: "/icon.png"
        });
      }
    } catch (err) {
      console.error("Notification authorization request failed:", err);
    }
  };

  // Trigger immediate user demo notification
  const handleSendTestNotification = () => {
    if (notificationStatus !== "granted") {
      alert("Please authorize Push Notifications first.");
      return;
    }

    setActiveTestAlert(true);
    setTimeout(() => setActiveTestAlert(false), 2500);

    const quotes = [
      "LEDGER OUTFLOW: Safe payout of transaction has cleared successfully.",
      "SYSTEM ALIGNMENT: Active Google Sheets synchronization finished.",
      "BUSINESS SYNC: Workspace ledger cache secured securely to disk.",
      "SECURITY COMPLIANCE: Standalone application offline token verified."
    ];
    const randomBody = quotes[Math.floor(Math.random() * quotes.length)];

    new Notification("MiraTech Live", {
      body: randomBody,
      icon: "/icon.png",
      tag: "miratech-test-sync",
      badge: "/icon.png",
    });
  };

  // Request Persistent browser storage
  const handleRequestStoragePersistence = async () => {
    if (!navigator.storage || !navigator.storage.persist) {
      alert("Your browser does not support customizable localized storage persistence.");
      return;
    }

    try {
      const persisted = await navigator.storage.persist();
      setStoragePersisted(persisted);
      updateStorageEstimates();
      
      if (persisted) {
        alert("Success! Storage persistency locked. Your offline transactions and ledger databases are fully protected from browser cache cleanups.");
      } else {
        alert("The system was registered as transient. Persistent storage has been deferred, usually due to low local disk space or not being installed yet.");
      }
    } catch (err) {
      console.error("Storage persistence registration failed:", err);
    }
  };

  // Helpers to calculate visual size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mbs = bytes / (1024 * 1024);
    if (mbs < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mbs.toFixed(1)} MB`;
  };

  const usagePercent = storageQuota.quota > 0 
    ? ((storageQuota.usage / storageQuota.quota) * 100).toFixed(4) 
    : "0";

  return (
    <div id="system-integration-component" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-xl mx-auto mt-6">
      
      {/* Visual Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Database className="h-4.5 w-4.5 text-blue-600" />
          Native Mobile & Workspace Integration
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Lock offline database storage and request live notification privileges for installed and standalone clients.
        </p>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Dynamic Platform Installation Guidance Panel */}
        <div className="p-4 border border-blue-100 bg-blue-50/30 rounded-xl space-y-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] font-black tracking-widest text-blue-700 uppercase block leading-none">
                Launcher Status
              </span>
              <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                {isStandalone ? "Running via Home Screen Standalone App" : "Running inside Web Browser Container"}
              </h3>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 leading-relaxed font-semibold">
            {isStandalone ? (
              <p className="text-emerald-700 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> High-frequency standalone process locked. App runs natively like a mobile/desktop client with active cache persistence.
              </p>
            ) : (
              <div className="space-y-2">
                <p>Enjoy offline tracking, fullscreen landscape modes, and zero URL header distractions by saving MiraTech natively:</p>
                <div className="p-2.5 bg-white border border-blue-50 rounded-lg text-[10px] space-y-1 text-slate-500 font-mono">
                  {browserType.isIOS ? (
                    <div>
                      <span className="text-indigo-600 font-bold block">iOS Safari Installation:</span>
                      1. Tap the Share button (<strong className="px-1 text-slate-800">⎙</strong>) in your safari taskbar.<br />
                      2. Choose <strong className="text-slate-800">&ldquo;Add to Home Screen&rdquo;</strong>.<br />
                      3. Launch directly from your app dock!
                    </div>
                  ) : browserType.isAndroid || browserType.isChrome ? (
                    <div>
                      <span className="text-indigo-600 font-bold block">Chrome & Android Installation:</span>
                      1. Click the <strong className="text-slate-800">&ldquo;...&rdquo; (Three Dots)</strong> or top app menu.<br />
                      2. Choose <strong className="text-slate-800">&ldquo;Save Web App&rdquo;</strong> or <strong className="text-slate-800">&ldquo;Install Application&rdquo;</strong>.<br />
                      3. Active shortcut added instantly.
                    </div>
                  ) : (
                    <div>
                      <span className="text-indigo-600 font-bold block">Universal Client Shortcut:</span>
                      Open this workspace on your Mobile Chrome or Apple Safari browser to unleash native home screen shortcuts.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Push Notifications */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border border-slate-100 p-4 rounded-xl bg-slate-50/25">
          <div className="space-y-1 flex-1">
            <span className="text-[9px] font-black tracking-widest text-[#2563EB] uppercase block">
              High Priority Alerts
            </span>
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-slate-500" />
              Desktop & Phone Push Notifications
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium max-w-sm">
              Permits system warnings, quotation triggers, sync errors and ledger changes to instantly notify you even if the tab is hidden.
            </p>
            
            {/* Status indicators */}
            <div className="pt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                notificationStatus === "granted" 
                  ? "bg-emerald-50 text-emerald-700" 
                  : notificationStatus === "denied"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
              }`}>
                {notificationStatus === "granted" && "Active Alerts Authorized"}
                {notificationStatus === "denied" && "Alerts Denied (Reset in browser Settings)"}
                {notificationStatus === "default" && "Action needed: Click to Request"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full sm:w-auto md:w-40">
            <button
              onClick={handleRequestNotifications}
              disabled={notificationStatus === "granted"}
              className="py-1.5 px-3 bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 text-[11px] font-bold tracking-wide rounded-lg cursor-pointer transition text-center shadow-3xs"
            >
              {notificationStatus === "granted" ? "Alerts Enabled" : "Authorize Push"}
            </button>
            {notificationStatus === "granted" && (
              <button
                onClick={handleSendTestNotification}
                className="py-1.5 px-3 border border-slate-200 hover:bg-white text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition flex items-center justify-center gap-1"
              >
                <Sparkles className="h-3 w-3 text-yellow-500 shrink-0" />
                {activeTestAlert ? "Sending..." : "Test Notification"}
              </button>
            )}
          </div>
        </div>

        {/* Section 3: Storage Access & Persistence */}
        <div className="space-y-4 border border-slate-100 p-4 rounded-xl bg-slate-50/25">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1 flex-1">
              <span className="text-[9px] font-black tracking-widest text-[#2563EB] uppercase block">
                Local Enterprise Vault
              </span>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <HardDrive className="h-4 w-4 text-slate-500" />
                Safe Persistent Storage Authorization
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium max-w-sm">
                Locks down local IndexedDB and Firestore cache allocations so other system tools can never automatically clear offline documents.
              </p>
              
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                  storagePersisted 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {storagePersisted ? "Offline Persistence Guaranteed" : "Transient Memory Mode"}
                </span>
              </div>
            </div>

            <button
              onClick={handleRequestStoragePersistence}
              disabled={storagePersisted}
              className="py-1.5 px-3 bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 text-[11px] font-bold tracking-wide mt-1 rounded-lg cursor-pointer transition w-full sm:w-auto md:w-40 text-center shrink-0 shadow-3xs"
            >
              {storagePersisted ? "Locked Secured" : "Lock offline cache"}
            </button>
          </div>

          {/* Storage Quota Usage Estimates Box */}
          <div className="p-3 bg-white border border-slate-150 rounded-lg space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                Total Browser Allocation Estimate
              </span>
              <span>
                {formatBytes(storageQuota.usage)} Used
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, Math.min(100, (storageQuota.usage / (storageQuota.quota || 1)) * 100))}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[9px] font-semibold text-slate-400">
              <span>Limit: {formatBytes(storageQuota.quota) || "512 MB"}</span>
              <button 
                onClick={updateStorageEstimates}
                className="flex items-center gap-0.5 hover:text-slate-600 cursor-pointer pr-0.5"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Refresh Analytics
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
