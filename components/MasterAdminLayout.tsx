'use client';

import { useState } from "react";
import { useUserStore } from "../lib/store";
import { logout } from "../lib/firebase";
import { LayoutDashboard, Users, LogOut, ChevronLeft } from "lucide-react";
import MasterAdminDashboard from "./MasterAdminDashboard";
import UserManagement from "./UserManagement";

export default function MasterAdminLayout() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { currentUser } = useUserStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase font-sans">Mira Admin</span>
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "users", label: "User Management", icon: Users },
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

        <div className="p-3 border-t border-slate-200 bg-slate-50/45 space-y-2">
          <p className="text-[11px] font-extrabold text-slate-800 truncate leading-none mb-0.5">{currentUser?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1 py-1.5 border border-red-100 text-red-500 hover:text-red-650 hover:bg-red-50 text-[10px] font-bold rounded-md cursor-pointer transition"
          >
            <LogOut className="h-3 w-3" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-4 overflow-y-auto">
        {activeTab === "dashboard" && <MasterAdminDashboard />}
        {activeTab === "users" && <UserManagement />}
      </main>
    </div>
  );
}
