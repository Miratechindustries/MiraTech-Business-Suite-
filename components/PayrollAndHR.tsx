"use client";

import { useState } from "react";
import { Users, Building2, CalendarDays, ClipboardList, BookOpen, ShieldCheck, FileSpreadsheet, Send, TrendingUp, Calculator, Clock } from "lucide-react";
import Payroll from "./Payroll"; // Reuse existing payroll logic

// Simple HR sub-components placeholders for structure
const HRManagement = () => (
  <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center">
    <h3 className="text-lg font-bold text-slate-800">HR Operations</h3>
    <p className="text-slate-500 text-sm mt-2">Manage all HR functions: Departments, Attendance, Leave, Performance & Contracts.</p>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
      {[
        { label: "Attendance", icon: Clock },
        { label: "Leave Requests", icon: CalendarDays },
        { label: "Performance", icon: ClipboardList },
        { label: "Contracts", icon: BookOpen },
        { label: "Departments", icon: Building2 },
      ].map(item => (
        <div key={item.label} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex items-center gap-3">
          <item.icon className="w-5 h-5 text-indigo-600" />
          <span className="font-bold text-sm tracking-tight">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function PayrollAndHR() {
  const [activeModule, setActiveModule] = useState<"payroll" | "hr">("payroll");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <button
          onClick={() => setActiveModule("payroll")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${activeModule === 'payroll' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          <Calculator className="w-4 h-4" />
          Payroll
        </button>
        <button
          onClick={() => setActiveModule("hr")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${activeModule === 'hr' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          <Users className="w-4 h-4" />
          HR
        </button>
      </div>

      <div>
        {activeModule === "payroll" ? <Payroll /> : <HRManagement />}
      </div>
    </div>
  );
}
