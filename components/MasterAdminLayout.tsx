'use client';

import { useState, useEffect } from "react";
import { useUserStore } from "../lib/store";
import { logout } from "../lib/firebase";
import { LayoutDashboard, Users, Building2, ShieldAlert, LogOut, FileText, ShieldCheck, X, ShoppingCart, ChevronRight } from "lucide-react";
import LoadingSkeleton from "./LoadingSkeleton";
import MasterAdminDashboard from "./MasterAdminDashboard";
import UserManagement from "./UserManagement";
import AuditLogs from "./AuditLogs";
import CompanyCreation from "./CompanyCreation";
import CompaniesTable from "./CompaniesTable";
import SecurityOperations from "./SecurityOperations";
import POSHub from "./POSHub";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export default function MasterAdminLayout() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Offline' | 'Syncing'>('Syncing');
  const { currentUser, setViewMode } = useUserStore();

  useEffect(() => {
    // Initial sync simulation
    const timer = setTimeout(() => {
      setConnectionStatus(navigator.onLine ? 'Connected' : 'Offline');
    }, 2000);

    const handleOnline = () => setConnectionStatus('Connected');
    const handleOffline = () => setConnectionStatus('Offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const StatusIndicator = () => (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-full text-[9px] font-bold text-slate-600">
      <span className={`h-1.5 w-1.5 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-500' : connectionStatus === 'Syncing' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
      {connectionStatus}
    </div>
  );

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "users", label: "User Management", icon: Users },
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "createCompany", label: "Create Company", icon: FileText },
    { id: "logs", label: "Audit Logs", icon: ShieldAlert },
    { id: "security", label: "Cyber Security Shield", icon: ShieldCheck },
    { id: "pos", label: "POS System", icon: ShoppingCart },
  ];

  const NavItem = ({ tab }: { tab: typeof navItems[0] }) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition ${
          isActive
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
        {tab.label}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-950 tracking-tighter">Mira Admin</span>
              <StatusIndicator />
            </div>
          </div>
          {/* Omni-Tenant Workspace Switcher */}
          <WorkspaceSwitcher
            currentCompany={null}
            currentUser={currentUser}
            userAuthId={currentUser?.id}
            userEmail={currentUser?.email}
            onSwitchWorkspace={(companyId) => {
              if (typeof window !== "undefined") {
                localStorage.setItem("mira_active_workspace_id", companyId);
              }
              if (currentUser) {
                useUserStore.getState().setCurrentUser({
                  ...currentUser,
                  companyId,
                  businessId: companyId,
                  lastActiveCompanyId: companyId,
                });
              }
              setViewMode("COMPANY");
            }}
            className="w-full"
          />
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((tab) => (
            <NavItem key={tab.id} tab={tab} />
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            type="button"
            id="btn-switch-to-tenant-portal"
            onClick={() => setViewMode("COMPANY")}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/70 text-indigo-950 text-xs font-bold transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <span>Enter Tenant Portal</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/45">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Admin Account</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800 truncate">{currentUser?.email}</p>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="bg-white border-b border-slate-200 py-2.5 px-3 flex items-center justify-between md:hidden flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              aria-label="Toggle Navigation drawer"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
            <span className="text-xs font-extrabold text-[#0B1329] uppercase tracking-wider">Admin</span>
          </div>

          {/* Mobile Workspace Switcher */}
          <WorkspaceSwitcher
            currentCompany={null}
            currentUser={currentUser}
            userAuthId={currentUser?.id}
            userEmail={currentUser?.email}
            onSwitchWorkspace={(companyId) => {
              if (typeof window !== "undefined") {
                localStorage.setItem("mira_active_workspace_id", companyId);
              }
              if (currentUser) {
                useUserStore.getState().setCurrentUser({
                  ...currentUser,
                  companyId,
                  businessId: companyId,
                  lastActiveCompanyId: companyId,
                });
              }
              setViewMode("COMPANY");
            }}
            isMobile
            className="flex-1 max-w-[170px]"
          />

          {/* Mobile Direct Sign Out Button */}
          <button
            onClick={handleLogout}
            className="p-1.5 border border-red-100 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex flex-col w-60 bg-white h-full shadow-2xl border-r border-slate-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 tracking-wider">Mira Admin</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-md transition text-slate-500">
                   <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
                {navItems.map((tab) => {
                   const Icon = tab.icon;
                   const isActive = activeTab === tab.id;
                   return (
                     <button
                       key={tab.id}
                       onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                       className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold ${isActive ? "bg-slate-100 text-[#0F172A]" : "text-slate-500"}`}
                     >
                       <Icon className="h-4 w-4" /> {tab.label}
                     </button>
                   );
                })}
              </nav>

              <div className="p-4 border-t border-slate-100 bg-slate-50/45 mt-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Account</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800 truncate">{currentUser?.email}</p>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-4 overflow-y-auto">
          {activeTab === "dashboard" && <MasterAdminDashboard />}
          {activeTab === "users" && <UserManagement />}
          {activeTab === "companies" && <CompaniesTable />}
          {activeTab === "createCompany" && <CompanyCreation />}
          {activeTab === "logs" && <AuditLogs />}
          {activeTab === "security" && <SecurityOperations />}
          {activeTab === "pos" && <POSHub />}
        </main>
      </div>
    </div>
  );
}

