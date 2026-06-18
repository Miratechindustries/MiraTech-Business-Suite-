"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { User } from "firebase/auth";
import { googleSignIn, logout, auth, initAuth, emailSignIn, handleFirestoreError, OperationType } from "../lib/firebase";
import { getDoc, doc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { 
  LayoutDashboard, 
  Box, 
  Users, 
  FileText, 
  Receipt, 
  CheckSquare, 
  Landmark, 
  BarChart3, 
  ShieldAlert, 
  ShieldCheck, 
  Settings, 
  Search, 
  Bell, 
  ChevronLeft, 
  LogOut, 
  Key, 
  Loader2,
  Building2,
  Menu,
  X,
  Mail,
  Lock,
  UserCog,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Coins
} from "lucide-react";

// Subcomponents
import Dashboard from "./Dashboard";
import AuditCenter from "./finance/AuditCenter";
import Quotations from "./Quotations";
import Invoices from "./Invoices";
import Receipts from "./Receipts";
import CompanyProfile from "./CompanyProfile";
import ToastContainer from "./ToastContainer";
import Inventory from "./Inventory";
import Customers from "./Customers";
import Transactions from "./Transactions";
import ReportsAnalytics from "./ReportsAnalytics";
import AuditLogs from "./AuditLogs";
import MasterAdminDashboard from "./MasterAdminDashboard";
import MasterAdminLayout from "./MasterAdminLayout";
import PayrollAndHR from "./PayrollAndHR";

interface CompanyData {
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
  inactivityTimeout?: number;
  lockedFeatures?: string[];
}

interface DashboardLayoutProps {
  defaultTab?: string;
}

export default function DashboardLayout({ defaultTab = "dashboard" }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab ] = useState(defaultTab);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [authError, setAuthError] = useState("");

  // Inactivity auto-logout states
  const [isWarningShown, setIsWarningShown] = useState(false);
  const [remainingTime, setRemainingTime] = useState(60);

  const lastActivityRef = useRef<number>(Date.now());
  const companyUnsubscribeRef = useRef<(() => void) | null>(null);
  const isWarningShownRef = useRef<boolean>(false);

  const { setCurrentUser, currentUser } = useUserStore();

  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const desktopBellRef = useRef<HTMLDivElement>(null);
  const mobileBellRef = useRef<HTMLDivElement>(null);

  // Real-time notifications listener
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const tenantId = currentUser?.companyId || currentUser?.businessId || user?.uid;
    if (!tenantId) return;

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("businessId", "==", tenantId),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setNotifications(list);
    }, (err) => {
      console.warn("[DashboardLayout Info] Notifications lookup transition pattern:", err.message);
    });

    return () => unsubscribe();
  }, [user, currentUser]);

  // Click outside detector
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        (desktopBellRef.current && !desktopBellRef.current.contains(event.target as Node)) &&
        (mobileBellRef.current && !mobileBellRef.current.contains(event.target as Node))
      ) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      const promises = unread.map(n => updateDoc(doc(db, "notifications", n.id), { read: true }));
      await Promise.all(promises);
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const handleMarkRead = async (id: string, read: boolean) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read });
    } catch (err) {
      console.error("Update notification failed:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Delete notification failed:", err);
    }
  };

  const handleGenerateTestNotification = async () => {
    const tenantId = currentUser?.companyId || currentUser?.businessId || user?.uid;
    if (!tenantId) return;
    try {
      const alertTypes: Array<"success" | "info" | "warning" | "error"> = ["success", "info", "warning", "error"];
      const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      let message = "This is an automated system notification.";
      let title = "Test System Alert";

      if (type === "success") {
        title = "Payment Confirmed";
        message = "Invoice #INV-2049 has been successfully processed.";
      } else if (type === "warning") {
        title = "Inventory Alert";
        message = "Minimal stock remaining for modern laptop bags.";
      } else if (type === "error") {
        title = "Backup Failure";
        message = "Automated data recovery checkpoint was cancelled.";
      } else {
        title = "Security Checkpoint";
        message = "Authorized personnel logged in from a new IP Address.";
      }

      await addDoc(collection(db, "notifications"), {
        businessId: tenantId,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
        type
      });
    } catch (err) {
      console.error("Failed to generate test notification:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotificationsDropdown = (isMobile: boolean) => {
    return (
      <div 
        id="notification-dropdown-panel"
        className={`absolute z-100 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden text-slate-705 font-sans transition-all duration-200 ease-out p-1
          ${isMobile 
            ? "right-0 top-10 origin-top-right" 
            : "right-0 origin-top-right"
          }`}
      >
        {/* Title */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[#0B1329] text-xs uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-white bg-red-500">
                {unreadCount} new
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={handleGenerateTestNotification}
            className="text-[9px] font-extrabold px-2 py-1 text-slate-500 hover:text-blue-600 border border-slate-200 rounded-md hover:bg-slate-100 transition duration-150 cursor-pointer"
          >
            + Test Alert
          </button>
        </div>

        {/* Scrollable list */}
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <Bell className="h-8 w-8 text-slate-300 mb-2 animate-pulse" />
              <p className="text-xs font-bold text-slate-500">All caught up!</p>
              <p className="text-[10px] text-slate-400 mt-0.5">There are no recent alerts for your organization.</p>
            </div>
          ) : (
            notifications.map((n) => {
              let Icon = Info;
              let iconColor = "text-blue-500 bg-blue-50 border-blue-100";
              if (n.type === "success") {
                Icon = CheckCircle2;
                iconColor = "text-emerald-500 bg-emerald-50 border-emerald-100";
              } else if (n.type === "warning") {
                Icon = AlertTriangle;
                iconColor = "text-amber-500 bg-amber-50 border-amber-100";
              } else if (n.type === "error") {
                Icon = ShieldAlert;
                iconColor = "text-rose-500 bg-rose-55 border-rose-100";
              }

              return (
                <div 
                  key={n.id} 
                  className={`p-3 text-left transition select-none flex gap-3 relative hover:bg-slate-50/70 ${!n.read ? 'bg-blue-50/20' : ''}`}
                >
                  {/* Status Indicator Bar */}
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: company?.primaryColor || '#2563EB' }}></div>
                  )}

                  {/* Level Icon */}
                  <div className={`p-1.5 h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-extrabold text-slate-800 leading-tight mb-0.5 flex items-center gap-1.5">
                      {n.title}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal">{n.message}</p>
                    <span className="text-[8px] text-slate-400 font-bold tracking-wider uppercase mt-1.5 block">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Action Panel */}
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    {!n.read ? (
                      <button 
                        type="button"
                        onClick={() => handleMarkRead(n.id, true)}
                        className="p-1 text-slate-400 hover:text-[#0B1329] hover:bg-slate-100 rounded-md transition cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleMarkRead(n.id, false)}
                        className="p-1 text-slate-400 hover:text-[#0B1329] hover:bg-slate-100 rounded-md transition cursor-pointer"
                        title="Mark as unread"
                      >
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => handleDeleteNotification(n.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Bar */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button 
              type="button"
              onClick={handleMarkAllRead}
              className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 px-2 py-1 flex items-center gap-1 cursor-pointer"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider px-2">
              Showing last 20 events
            </span>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    // Listen for auth state transitions
    const unsubscribe = initAuth(
      async (currentUser, token) => {
        setUser(currentUser);
        const cachedToken = typeof window !== "undefined" ? sessionStorage.getItem("google_access_token") : null;
        setGoogleToken(token || cachedToken);
        if (currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            let userData: any;

            const isGoogleUser = currentUser.providerData?.some(p => p.providerId === 'google.com') || false;
            
            if (!userDoc.exists()) {
              // If user profile is not saved in Firestore at all (meaning no company is assigned either),
              // we auto-register them as a STAFF user with empty companyId so they appear in User Management roster.
              const isMaster = currentUser.email?.toLowerCase() === 'miratechindustries@gmail.com';
              const newUserPayload = {
                email: currentUser.email || '',
                role: isMaster ? 'MASTER_ADMIN' : 'STAFF',
                companyId: '',
                businessId: '',
                isGoogleUser,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', currentUser.uid), newUserPayload);
              userData = { id: currentUser.uid, ...newUserPayload };
              console.log("DEBUG: Auto-registered user in Firestore:", userData);
            } else {
              userData = { id: userDoc.id, ...userDoc.data() };
              // Support legacy businessId mapping
              if (!userData.companyId && userData.businessId) {
                userData.companyId = userData.businessId;
              }
            }
            
            if (currentUser.email?.toLowerCase() === 'miratechindustries@gmail.com') {
              userData = { ...userData, role: 'MASTER_ADMIN' };
              console.log("DEBUG: Email matched, role updated to MASTER_ADMIN:", userData);
            } else {
              console.log("DEBUG: Email did not match, role remains:", userData.role);
            }
            setCurrentUser(userData);
            console.log("DEBUG: setCurrentUser called with:", userData);

            // Dynamically listen to company profile to populate sidebar / branding in real time
            const targetCompanyId = userData.companyId || userData.businessId || currentUser.uid;
            if (companyUnsubscribeRef.current) {
              companyUnsubscribeRef.current();
              companyUnsubscribeRef.current = null;
            }
            if (targetCompanyId) {
              companyUnsubscribeRef.current = onSnapshot(doc(db, "companies", targetCompanyId), (compSnap) => {
                if (compSnap.exists()) {
                  const data = compSnap.data() as CompanyData;
                  setCompany(data);
                  if (typeof data.inactivityTimeout === "number") {
                    localStorage.setItem("mira_inactivity_timeout", String(data.inactivityTimeout));
                  }
                } else {
                  // Fallback to businesses
                  const unsubBiz = onSnapshot(doc(db, "businesses", targetCompanyId), (bizSnap) => {
                    if (bizSnap.exists()) {
                      const data = bizSnap.data() as CompanyData;
                      setCompany(data);
                      if (typeof data.inactivityTimeout === "number") {
                        localStorage.setItem("mira_inactivity_timeout", String(data.inactivityTimeout));
                      }
                    } else {
                      setCompany(null);
                    }
                  }, (err) => {
                    console.warn("[DashboardLayout Info] Reading business profile locally or waiting for replication:", err.message);
                  });
                  companyUnsubscribeRef.current = unsubBiz;
                }
              }, (err) => {
                console.warn("[DashboardLayout Info] Reading company profile locally or waiting for replication:", err.message);
              });
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
            // Fallback user data in case of error
            setCurrentUser({ id: currentUser.uid, email: currentUser.email || '', role: 'STAFF', companyId: '' } as any);
          }
        } else {
          setCurrentUser(null);
          setCompany(null);
        }
        setAuthLoading(false);
      },
      () => {
        setUser(auth.currentUser);
        setAuthLoading(false);
      }
    );
    return () => {
      unsubscribe();
      if (companyUnsubscribeRef.current) {
        companyUnsubscribeRef.current();
      }
    };
  }, [setCurrentUser]);

  useEffect(() => {
    isWarningShownRef.current = isWarningShown;
  }, [isWarningShown]);

  useEffect(() => {
    if (!user) {
      setIsWarningShown(false);
      return;
    }

    const getLimit = () => {
      if (typeof window === "undefined") return 900;
      if (company && typeof company.inactivityTimeout === "number") {
        const timeout = company.inactivityTimeout;
        localStorage.setItem("mira_inactivity_timeout", String(timeout));
        return timeout;
      }
      const stored = localStorage.getItem("mira_inactivity_timeout");
      return stored ? Number(stored) : 900; // default 15 minutes
    };

    const handleUserActivity = () => {
      // Avoid resetting current timers if warning is currently active
      if (!isWarningShownRef.current) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ["mousemove", "mousedown", "keypress", "touchmove", "scroll", "click"];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity));

    const checkInterval = setInterval(() => {
      const limit = getLimit();
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const warningDuration = limit <= 30 ? 10 : 60;
      const threshold = limit - warningDuration;

      if (elapsed >= limit) {
        clearInterval(checkInterval);
        setIsWarningShown(false);
        handleLogout();
      } else if (elapsed >= threshold) {
        setIsWarningShown(true);
        setRemainingTime(limit - elapsed);
      } else {
        if (isWarningShownRef.current) {
          setIsWarningShown(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [user]);

  const keepSessionAlive = () => {
    lastActivityRef.current = Date.now();
    setIsWarningShown(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err) {
      console.error("Sign-in process disrupted:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      setAuthLoading(true);
      await emailSignIn(emailValue, passwordValue);
    } catch (err: any) {
      console.error("Email sign-in failed:", err);
      if (err.code === 'auth/network-request-failed') {
        setAuthError("Network error. Please ensure Email/Password authentication is enabled and the current domain is added to the 'Authorized domains' list in your Firebase Authentication settings.");
      } else if (err.code === 'auth/invalid-credential') {
        setAuthError("Invalid email or password. Please check your credentials and try again.");
      } else {
        setAuthError(err.message || "Failed to sign in. Please check your credentials.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    await logout();
    setUser(null);
    setGoogleToken(null);
    setAuthLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50/20">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-500 tracking-wider">Verifying identity & active workspace...</p>
        </div>
      </div>
    );
  }

  // Not authenticated landing screen
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50/20 p-6">
        <div className="max-w-md w-full bg-white border border-blue-100 rounded-xl shadow-xs p-8 text-center space-y-5">
          <div className="space-y-2">
            <span className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full mb-1 border border-blue-100/30">
              <Landmark className="h-7 w-7" />
            </span>
            <h1 className="text-lg font-extrabold font-sans text-slate-900 tracking-tight">
              MiraTech Report & Ledger Engine
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Draft official quotations, bill invoices, compile payments, and synchronize reports with Google Workspace active sheets.
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg text-left text-[11px] text-amber-700 leading-relaxed border border-amber-100/40">
            <strong>Security Notice:</strong> Logging in establishes active OAuth requests for Google Sheets & Google Drive capabilities in this full-stack sandbox environment.
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="email"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="Email Address"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
                  required
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
                  required
                />
              </div>
            </div>
            {authError && (
              <p className="text-[10px] text-red-500 bg-red-50 p-2 rounded-md border border-red-100">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#0F172A] text-white hover:bg-slate-900 font-bold text-xs rounded-lg shadow-xs transition duration-200 cursor-pointer"
            >
              Sign In with Email
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400 uppercase font-bold">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-bold text-xs rounded-lg shadow-xs transition duration-200 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.3-4.74 3.3-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const isMasterAdmin = currentUser?.role?.toUpperCase() === 'MASTER_ADMIN' || user?.email?.toLowerCase() === 'miratechindustries@gmail.com';

  console.log("DEBUG: Rendering Business Dashboard, currentUser:", currentUser);
  return (
    <>
      {isMasterAdmin ? (
        <MasterAdminLayout />
      ) : (
        <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between max-w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 font-sans">
            <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase truncate" style={{ color: company?.primaryColor || '#0F172A' }}>
              {company?.name || "Mira Suite"}
            </span>
          </div>
          <button className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "inventory", label: "Inventory", icon: Box },
            { id: "clients", label: "Clients", icon: Users },
            { id: "payroll", label: "HR and Payroll", icon: Coins },
            { id: "quotations", label: "Quotations", icon: FileText },
            { id: "invoices", label: "Invoices", icon: Receipt },
            { id: "receipts", label: "Receipts", icon: CheckSquare },
            { id: "transactions", label: "Transactions", icon: Landmark },
            { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
            { id: "audit_center", label: "Audit Center", icon: ShieldCheck },
            { id: "audit", label: "Audit Logs", icon: ShieldAlert },
            ...(currentUser?.role?.toUpperCase() === 'MASTER_ADMIN' ? [{ id: "admin", label: "Master Admin", icon: UserCog }] : []),
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold tracking-wide transition capitalize cursor-pointer ${
                  isActive
                    ? "bg-slate-100"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/70"
                }`}
                style={isActive ? { 
                  borderLeft: `2.5px solid ${company?.primaryColor || '#2563EB'}`, 
                  color: company?.primaryColor || '#0F172A' 
                } : {}}
              >
                <Icon className="h-4 w-4" style={{ color: isActive ? (company?.primaryColor || '#2563EB') : '#94A3B8' }} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* User Identity Footer block */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/45 space-y-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {user.photoURL ? (
              <Image src={user.photoURL} alt="User profile symbol" width={28} height={28} className="h-7 w-7 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center border border-blue-200/50">
                {(user.displayName || "M").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-slate-800 truncate leading-none mb-0.5">{user.displayName || "Manager"}</p>
              <p className="text-[9px] text-slate-400 truncate leading-none">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1 py-1.5 border border-red-100 text-red-500 hover:text-red-650 hover:bg-red-50 text-[10px] font-bold rounded-md cursor-pointer transition"
          >
            <LogOut className="h-3 w-3" /> Sign Out from Gateway
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header bar matches screenshot */}
        <header className="bg-white border-b border-slate-200 h-14 px-5 hidden md:flex items-center justify-between flex-shrink-0">
          {/* Quick Search Bar */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Quick search..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50/40 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden transition"
            />
          </div>

          {/* Right identity layout */}
          <div className="flex items-center gap-3">
            <div className="text-right flex flex-col justify-center items-end max-w-[150px] overflow-hidden">
              <span className="text-xs font-extrabold text-slate-800 tracking-wide font-sans leading-tight uppercase truncate w-full" style={{ color: company?.primaryColor || '#1E293B' }}>
                {company?.name || "MIRA SUITE"}
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">STAFF ACCESS</span>
            </div>

            {/* Notification Icon */}
            <div className="relative" ref={desktopBellRef}>
              <button 
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-4 w-4 animate-none" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center border border-white animate-pulse" style={{ backgroundColor: '#EF4444' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && renderNotificationsDropdown(false)}
            </div>

            {/* User Profile circle */}
            <div 
              onClick={() => setActiveTab("settings")}
              className="h-8 w-8 rounded-full text-white font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-3xs transition hover:opacity-90"
              style={{ backgroundColor: company?.primaryColor || '#0066FF' }}
              title={user.displayName || "Manager"}
            >
              {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Mobile Header navigation bar with Hamburger */}
        <header className="bg-white border-b border-slate-200 py-3 px-4 flex items-center justify-between md:hidden flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 px-2 border border-slate-200 text-slate-605 rounded-md hover:bg-slate-50 transition cursor-pointer flex-shrink-0"
              aria-label="Toggle Navigation drawer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 ml-1 min-w-0">
              <Landmark className="h-4 w-4 flex-shrink-0" style={{ color: company?.primaryColor || '#2563EB' }} />
              <span className="text-xs font-extrabold text-[#0B1329] uppercase tracking-wider truncate" style={{ color: company?.primaryColor || '#0B1329' }}>
                {company?.name || "MIRA SUITE"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mobile Notification Bell */}
            <div className="relative" ref={mobileBellRef}>
              <button 
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-1.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-full transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center border border-white animate-pulse" style={{ backgroundColor: '#EF4444' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && renderNotificationsDropdown(true)}
            </div>

            <div 
              onClick={() => setActiveTab("settings")}
              className="h-7 w-7 rounded-full text-white font-extrabold text-[10px] flex items-center justify-center cursor-pointer shadow-3xs transition hover:opacity-90"
              style={{ backgroundColor: company?.primaryColor || '#0066FF' }}
              title={user.displayName || "Manager"}
            >
              {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Mobile Drawer Slideout Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs transition-opacity duration-300"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slideout Content */}
            <div className="relative flex flex-col w-60 max-w-sm bg-white h-full shadow-2xl transition-transform duration-300 ease-in-out border-r border-slate-200">
              {/* Header inside drawer */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4.5 w-4.5 text-blue-600" />
                  <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase font-sans">Mira Suite</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
                {[
                  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { id: "inventory", label: "Inventory", icon: Box },
                  { id: "clients", label: "Clients", icon: Users },
                  { id: "payroll", label: "HR and Payroll", icon: Coins },
                  { id: "quotations", label: "Quotations", icon: FileText },
                  { id: "invoices", label: "Invoices", icon: Receipt },
                  { id: "receipts", label: "Receipts", icon: CheckSquare },
                  { id: "transactions", label: "Transactions", icon: Landmark },
                  { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
                  { id: "audit_center", label: "Audit Center", icon: ShieldCheck },
                  { id: "audit", label: "Audit Logs", icon: ShieldAlert },
                  ...(currentUser?.role?.toUpperCase() === 'MASTER_ADMIN' ? [{ id: "admin", label: "Master Admin", icon: UserCog }] : []),
                  { id: "settings", label: "Settings", icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold tracking-wide transition capitalize cursor-pointer ${
                        isActive
                          ? "bg-slate-100"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/70"
                      }`}
                      style={isActive ? { 
                        borderLeft: `2.5px solid ${company?.primaryColor || '#2563EB'}`, 
                        color: company?.primaryColor || '#0F172A' 
                      } : {}}
                    >
                      <Icon className="h-4 w-4" style={{ color: isActive ? (company?.primaryColor || '#2563EB') : '#94A3B8' }} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* User Identity Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50/45 space-y-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {user.photoURL ? (
                    <Image src={user.photoURL} alt="User profile" width={28} height={28} className="h-7 w-7 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center border border-blue-200/50">
                      {(user.displayName || "M").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 font-sans">
                    <p className="text-[11px] font-extrabold text-slate-800 truncate leading-none mb-0.5">{user.displayName || "Manager"}</p>
                    <p className="text-[9px] text-slate-400 truncate leading-none">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1 py-1.5 border border-red-100 text-red-500 hover:text-red-650 hover:bg-red-50 text-[10px] font-bold rounded-md cursor-pointer transition"
                >
                  <LogOut className="h-3 w-3" /> Sign Out from Gateway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Body pane */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-4 overflow-y-auto">
          {/* Active Workspace Block */}
          {!company && activeTab !== "settings" ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] h-full text-center p-6 space-y-4 max-w-sm mx-auto">
              <div className="p-3 bg-blue-50 text-blue-605 rounded-full border border-blue-100 animate-pulse">
                <Landmark className="h-8 w-8 text-blue-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                  No business associated with your account.
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  You must customize your branding credentials under Settings to draft official corporate ledgers.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("settings")}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition duration-200 cursor-pointer"
              >
                Configure Settings Now
              </button>
            </div>
          ) : (
            <div className="relative">
              {company?.lockedFeatures?.includes(activeTab) && !isMasterAdmin && (
                <div className="absolute inset-x-0 top-0 bottom-0 min-h-[450px] bg-sky-550/10 backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center p-8 text-center z-30 border border-blue-200/50 shadow-md animate-fade-in">
                  <div className="p-4 bg-blue-600 text-white rounded-full border-4 border-white shadow-xl mb-4 animate-pulse flex items-center justify-center">
                    <Lock className="h-8 w-8" />
                  </div>
                  <div className="max-w-md space-y-3">
                    <h3 className="text-lg font-extrabold text-blue-900 tracking-tight font-sans">
                      This page has been locked.
                    </h3>
                    <p className="text-xs text-blue-800 font-semibold leading-relaxed bg-blue-50/90 py-2.5 px-4 rounded-xl border border-blue-150">
                      Please request <strong className="text-blue-950 font-bold underline">MiraTech Admin</strong> for assistance with unlocking your packages.
                    </p>
                  </div>
                </div>
              )}

              <div className={company?.lockedFeatures?.includes(activeTab) && !isMasterAdmin ? "blur-md pointer-events-none select-none transition-all duration-300" : ""}>
                {/* Render Active View Tab */}
                {activeTab === "dashboard" && (
                  <Dashboard
                    googleToken={googleToken}
                    onGoogleSignInNeeded={handleGoogleLogin}
                  />
                )}

                {activeTab === "inventory" && <Inventory />}

                {activeTab === "clients" && <Customers />}

                {activeTab === "payroll" && <PayrollAndHR />}

                {activeTab === "quotations" && <Quotations />}

                {activeTab === "invoices" && <Invoices />}

                {activeTab === "receipts" && <Receipts />}

                {activeTab === "transactions" && <Transactions />}

                {activeTab === "reports" && <ReportsAnalytics />}

                {activeTab === "audit_center" && <AuditCenter />}

                {activeTab === "audit" && <AuditLogs />}
                {activeTab === "admin" && <MasterAdminDashboard />}

                {activeTab === "settings" && (
                   <CompanyProfile onCompanyLoaded={(data) => setCompany(data)} />
                 )}
              </div>
            </div>
          )}
         </main>
       </div>
     </div>
      )}

      {/* Dynamic Security Inactivity Warning Overlay */}
      {isWarningShown && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 animate-bounce">
              <ShieldAlert className="h-6 w-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
                Corporate Inactivity warning
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Your session is about to expire due to enterprise compliance standards. Inactive users are logged out of the Mira Suite automatically.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-150 py-3 px-4 rounded-xl">
              <span className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase block mb-1">
                Security Countdown
              </span>
              <span className="font-mono text-3xl font-extrabold text-indigo-700 tracking-tighter">
                {remainingTime}s
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={keepSessionAlive}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
              >
                Keep Session Active
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </>
  );
}
