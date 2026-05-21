"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { googleSignIn, logout, auth, initAuth } from "../lib/firebase";
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
  Settings, 
  Search, 
  Bell, 
  ChevronLeft, 
  LogOut, 
  Key, 
  Loader2,
  Building2,
  Menu,
  X
} from "lucide-react";

// Subcomponents
import Dashboard from "./Dashboard";
import Quotations from "./Quotations";
import Invoices from "./Invoices";
import Receipts from "./Receipts";
import CompanyProfile from "./CompanyProfile";
import Inventory from "./Inventory";
import Customers from "./Customers";
import Transactions from "./Transactions";
import ReportsAnalytics from "./ReportsAnalytics";
import AuditLogs from "./AuditLogs";

interface CompanyData {
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
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

  useEffect(() => {
    // Listen for auth state transitions
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setGoogleToken(token);
        setAuthLoading(false);
      },
      () => {
        setUser(auth.currentUser);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

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

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs rounded-lg shadow-xs transition duration-200 cursor-pointer"
          >
            <Key className="h-3.5 w-3.5" /> Authenticate With Google Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase font-sans">Mira Suite</span>
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
            { id: "quotations", label: "Quotations", icon: FileText },
            { id: "invoices", label: "Invoices", icon: Receipt },
            { id: "receipts", label: "Receipts", icon: CheckSquare },
            { id: "transactions", label: "Transactions", icon: Landmark },
            { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
            { id: "audit", label: "Audit Logs", icon: ShieldAlert },
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
                    ? "bg-slate-100 text-[#0F172A] border-l-2 border-blue-605"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/70"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* User Identity Footer block */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/45 space-y-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User profile symbol" className="h-7 w-7 rounded-full border border-slate-200" />
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
            <div className="text-right flex flex-col justify-center">
              <span className="text-xs font-extrabold text-slate-800 tracking-wide font-sans leading-tight">MIRA SUITE</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">STAFF ACCESS</span>
            </div>

            {/* Notification Icon */}
            <button className="relative p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer">
              <Bell className="h-4 w-4 animate-none" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-blue-600 rounded-full border border-white"></span>
            </button>

            {/* User Profile circle */}
            <div 
              onClick={() => setActiveTab("settings")}
              className="h-8 w-8 rounded-full bg-[#0066FF] hover:bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-3xs transition"
              title={user.displayName || "Manager"}
            >
              {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Mobile Header navigation bar with Hamburger */}
        <header className="bg-white border-b border-slate-200 py-3 px-4 flex items-center justify-between md:hidden flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 px-2 border border-slate-200 text-slate-605 rounded-md hover:bg-slate-50 transition cursor-pointer"
              aria-label="Toggle Navigation drawer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 ml-1">
              <Landmark className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-extrabold text-[#0B1329] uppercase tracking-wider">MIRA SUITE</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div 
              onClick={() => setActiveTab("settings")}
              className="h-7 w-7 rounded-full bg-[#0066FF] hover:bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center cursor-pointer shadow-3xs transition"
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
                  { id: "quotations", label: "Quotations", icon: FileText },
                  { id: "invoices", label: "Invoices", icon: Receipt },
                  { id: "receipts", label: "Receipts", icon: CheckSquare },
                  { id: "transactions", label: "Transactions", icon: Landmark },
                  { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
                  { id: "audit", label: "Audit Logs", icon: ShieldAlert },
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
                          ? "bg-slate-100 text-[#0F172A] border-l-2 border-blue-605"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/70"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* User Identity Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50/45 space-y-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User profile" className="h-7 w-7 rounded-full border border-slate-200" />
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
            <>
              {/* Render Active View Tab */}
              {activeTab === "dashboard" && (
                <Dashboard
                  googleToken={googleToken}
                  onGoogleSignInNeeded={handleGoogleLogin}
                />
              )}

              {activeTab === "inventory" && <Inventory />}

              {activeTab === "clients" && <Customers />}

              {activeTab === "quotations" && <Quotations />}

              {activeTab === "invoices" && <Invoices />}

              {activeTab === "receipts" && <Receipts />}

              {activeTab === "transactions" && <Transactions />}

              {activeTab === "reports" && <ReportsAnalytics />}

              {activeTab === "audit" && <AuditLogs />}

              {activeTab === "settings" && (
                <CompanyProfile onCompanyLoaded={(data) => setCompany(data)} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
