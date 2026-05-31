"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, FileText } from "lucide-react";

export default function FinanceDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI Cards */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Total Revenue</h3>
            <p className="text-2xl font-bold text-green-600">$0.00</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Total Expenses</h3>
            <p className="text-2xl font-bold text-red-600">$0.00</p>
        </div>
        {/* ... more cards */}
      </div>
    </div>
  );
}
