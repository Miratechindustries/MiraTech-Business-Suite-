"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, DollarSign, PieChart, Percent, ArrowUpRight, ArrowDownLeft, FileCheck, Landmark, Printer, Download } from "lucide-react";
import { auth } from "../lib/firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MetricRow {
  quarter: string;
  billings: number;
  invoices: number;
  expenses: number;
  netProfit: number;
}

export default function ReportsAnalytics() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);

  useEffect(() => {
    // Dynamically retrieve values or seed corporate metrics
    const user = auth.currentUser;
    const cacheKey = user ? `miratech_financials_${user.uid}` : "miratech_financials_guest";
    const txKey = user ? `miratech_transactions_${user.uid}` : "miratech_transactions_guest";
    
    const cached = localStorage.getItem(cacheKey);
    const txCache = JSON.parse(localStorage.getItem(txKey) || "[]");

    if (cached) {
      setMetrics(JSON.parse(cached));
    } else {
      const initial: MetricRow[] = [
        { quarter: "Q1 - Winter", billings: 45000, invoices: 32000, expenses: 14000, netProfit: 18000 },
        { quarter: "Q2 - Spring", billings: 58000, invoices: 40500, expenses: 18500, netProfit: 22000 },
        { quarter: "Q3 - Summer", billings: 69000, invoices: 48000, expenses: 21000, netProfit: 27000 },
        { quarter: "Q4 - Autumn", billings: 81000, invoices: 59000, expenses: 25000, netProfit: 34000 },
      ];
      setMetrics(initial);
      localStorage.setItem(cacheKey, JSON.stringify(initial));
    }

    // Process Transaction Data for Chart
    const monthlyData: Record<string, number> = {};
    txCache.forEach((t: any) => {
        if (t.type === 'Inflow') {
            const month = t.date.substring(0, 7); // YYYY-MM
            monthlyData[month] = (monthlyData[month] || 0) + t.amount;
        }
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    setChartData(sortedMonths.map(month => ({ month, revenue: monthlyData[month] })));
    
  }, []);

  const totalBillings = metrics.reduce((sum, r) => sum + r.billings, 0);
  const totalInvoices = metrics.reduce((sum, r) => sum + r.invoices, 0);
  const totalExpenses = metrics.reduce((sum, r) => sum + r.expenses, 0);
  const totalProfit = totalInvoices - totalExpenses;
  const marginPercentage = totalInvoices > 0 ? ((totalProfit / totalInvoices) * 105).toFixed(1) : "0.0";

  // Calculate coordinates for pure SVG charts (Scale factor helper)
  const maxVal = Math.max(...metrics.map(m => Math.max(m.billings, m.invoices, m.expenses))) || 100000;
  const chartHeight = 140;
  const chartWidth = 360;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Reports & Analytics</h1>
          <p className="text-[11px] text-slate-500 font-medium">Consolidated audit indexes, quarterly margins, and margin analysis metrics.</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition"
          >
            <Printer className="h-3 w-3" /> Print Executive PDF
          </button>
        </div>
      </div>

      {/* KPI Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Contract Value</span>
            <span className="p-1 bg-blue-50 text-blue-600 rounded-md">
              <BarChart3 className="h-3 w-3" />
            </span>
          </div>
          <h3 className="text-base font-extrabold font-mono text-slate-800 mt-1">${totalBillings.toLocaleString()}</h3>
          <div className="flex items-center gap-1 text-[8px] text-green-600 mt-0.5 font-bold">
            <ArrowUpRight className="h-2.5 w-2.5" /> <span>+24.5% vs previous fiscal term</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operating Revenue</span>
            <span className="p-1 bg-green-50 text-green-600 rounded-md">
              <DollarSign className="h-3 w-3" />
            </span>
          </div>
          <h3 className="text-base font-extrabold font-mono text-green-700 mt-1">${totalInvoices.toLocaleString()}</h3>
          <div className="flex items-center gap-1 text-[8px] text-green-600 mt-0.5 font-bold">
            <ArrowUpRight className="h-2.5 w-2.5" /> <span>+18.9% collection rate</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operational Profit Margin</span>
            <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
              <Percent className="h-3 w-3" />
            </span>
          </div>
          <h3 className="text-base font-extrabold font-mono text-indigo-700 mt-1">{marginPercentage}%</h3>
          <div className="flex items-center gap-1 text-[8px] text-indigo-600 mt-0.5 font-bold">
            <FileCheck className="h-2.5 w-2.5" /> <span>Adjusted for outlays</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* SVG Interactive Charting Card */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-lg shadow-3xs md:col-span-8 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Financial Position Trend</h4>
              <p className="text-[10px] text-slate-400">Quarterly progression tracking core activities</p>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Billings</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Invoiced Revenue</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400"></span> Expenses</span>
            </div>
          </div>

          {/* Recharts Monthly Revenue Trend */}
          <div className="relative pt-2 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '10px'}} />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 text-[9px] text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span>Graph assets compile automatically based on invoices, receipts, and custom expense entries.</span>
          </div>
        </div>

        {/* Breakdown Analyzer Card */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-lg shadow-3xs md:col-span-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Liquidity Health Index</h4>
            <p className="text-[10px] text-slate-450 mb-3 block">Ratio analysis matching expenses against collection profiles</p>

            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Gross Contract value:</span>
                <span className="font-mono text-slate-700 font-bold">${totalBillings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Billed Assets:</span>
                <span className="font-mono text-slate-700 font-bold">${totalInvoices.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Cash Flow Outlays (Est.):</span>
                <span className="font-mono text-red-500 font-bold">-${totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 font-bold text-slate-900">
                <span>Active Operating Profit:</span>
                <span className="font-mono text-emerald-700">${totalProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-2 bg-indigo-50/50 rounded-md border border-indigo-100/50 text-[10px] text-indigo-700 leading-relaxed mt-4">
            <strong>Reconciliation Index:</strong> Good. Cash assets exceed core operating expenses by <strong>{((totalProfit / totalExpenses) * 100).toFixed(0)}%</strong>. Capital reserves are stable.
          </div>
        </div>
      </div>

      {/* Structured Ledger metrics table row */}
      <div className="bg-white border border-slate-200/80 rounded-lg shadow-3xs p-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-3">Structured Report Metrics</h4>
        <div className="overflow-x-auto">
          <table className="high-density-table w-full text-left">
            <thead>
              <tr>
                <th>Quarter Term</th>
                <th>Quotations Drafted</th>
                <th>Invoices Issued</th>
                <th>Operating Expenses</th>
                <th>Operating Margins Ratio</th>
                <th className="text-right">Net Operating Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {metrics.map((r, idx) => {
                const margin = ((r.invoices - r.expenses) / r.invoices) * 100;
                return (
                  <tr key={idx} className="hover:bg-slate-50/40">
                    <td className="font-bold text-slate-800">{r.quarter}</td>
                    <td className="font-mono text-slate-500">${r.billings.toLocaleString()}</td>
                    <td className="font-mono text-slate-700 font-bold">${r.invoices.toLocaleString()}</td>
                    <td className="font-mono text-red-500">-${r.expenses.toLocaleString()}</td>
                    <td className="font-mono text-indigo-700 font-bold">{margin.toFixed(1)}%</td>
                    <td className="font-mono text-right font-extrabold text-green-700">${(r.invoices - r.expenses).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
