"use client";

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { syncToGoogleSheets, uploadToGoogleDrive, LedgerMetric } from "../lib/googleApi";
import { BarChart3, TrendingUp, DollarSign, Wallet2, FileSpreadsheet, Download, CloudLightning, Loader2, CheckSquare, ShieldCheck, AlertCircle } from "lucide-react";
import Image from "next/image";
import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";
import LoadingSkeleton from "./LoadingSkeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Invoice {
  total: number;
  status: "unpaid" | "paid" | "overdue";
  date?: string;
  number?: string;
}

interface Quotation {
  total: number;
  status: "pending" | "accepted" | "declined";
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
}

interface DashboardProps {
  googleToken: string | null;
  onGoogleSignInNeeded?: () => void;
}

export default function Dashboard({ googleToken, onGoogleSignInNeeded }: DashboardProps) {
  const { currentUser } = useUserStore();

  // Local auth shadowing to redirect all queries to the correct shared company workspace
  const auth = {
    ...importAuth,
    get currentUser() {
      const liveUser = importAuth.currentUser;
      if (!liveUser) return null;
      const companyId = currentUser?.companyId || currentUser?.businessId || liveUser.uid;
      return {
        ...liveUser,
        uid: companyId,
        getIdToken: (forceRefresh?: boolean) => liveUser.getIdToken(forceRefresh),
        getIdTokenResult: (forceRefresh?: boolean) => liveUser.getIdTokenResult(forceRefresh),
      } as any;
    }
  };

  const [loading, setLoading] = useState(true);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);

  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Expense controller for dynamically calculating net profit margins
  const [expenses, setExpenses] = useState<number>(1500);

  const pdfDashboardRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    
    try {
      // 1. Get User's BusinessId (Ensure clean raw auth UID is used to query the own user profile)
      const rawUser = importAuth.currentUser;
      let businessId = currentUser?.companyId || currentUser?.businessId;
      if (rawUser && !businessId) {
        const userSnap = await getDoc(doc(db, "users", rawUser.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          businessId = userData?.businessId || userData?.companyId || null;
        }
      }
      if (!businessId && rawUser) {
        businessId = rawUser.uid; // Fallback to raw UID
      }

      // 2. Fetch Business (was Companies)
      if (businessId) {
        const compSnap = await getDoc(doc(db, "businesses", businessId));
        if (compSnap.exists()) {
          const compData = compSnap.data() as CompanyDetails;
          setCompany(compData);
          localStorage.setItem(`miratech_offline_company_${businessId}`, JSON.stringify(compData));
        } else {
          const cachedCompany = localStorage.getItem(`miratech_offline_company_${businessId}`);
          if (cachedCompany) setCompany(JSON.parse(cachedCompany));
        }
      }

      // 3. Fetch Quotations (tenant-scoped nested subcollection)
      const qList: Quotation[] = [];
      if (businessId) {
        const qRef = collection(db, "companies", businessId, "quotations");
        const qSnap = await getDocs(qRef);
        qSnap.forEach((docSnap) => {
          qList.push({ id: docSnap.id, ...docSnap.data() } as Quotation);
        });
        // Sort by number descending
        qList.sort((a, b) => (b.number || "").localeCompare(a.number || ""));
        setQuotations(qList);
        localStorage.setItem(`miratech_offline_quotations_${businessId}`, JSON.stringify(qList));
      }

      // 4. Fetch Invoices (tenant-scoped nested subcollection)
      const iList: Invoice[] = [];
      if (businessId) {
        const iRef = collection(db, "companies", businessId, "invoices");
        const iSnap = await getDocs(iRef);
        iSnap.forEach((docSnap) => {
          iList.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
        });
        // Sort by number descending
        iList.sort((a, b) => (b.number || "").localeCompare(a.number || ""));
        setInvoices(iList);
        localStorage.setItem(`miratech_offline_invoices_${businessId}`, JSON.stringify(iList));
      }
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Dashboard Offline Fallback] Loading from cache.");
      } else {
        console.error("Error loading dashboard data:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats
  const totalQuotationsVal = quotations.reduce((acc, q) => acc + q.total, 0);
  const totalInvoicesVal = invoices.reduce((acc, i) => acc + i.total, 0);
  const collectedRevenue = invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.total, 0);
  const netProfit = Math.max(0, collectedRevenue - expenses);
  const profitMargin = collectedRevenue > 0 ? ((netProfit / collectedRevenue) * 100).toFixed(1) : "0.0";

  // Past 12 Months Revenue and Invoiced Trends
  const trendData = (() => {
    const months = [];
    let baseDate = new Date();
    // Anchor at May 2026 for consistent presentation in demo database, else use current year.
    if (baseDate.getFullYear() < 2026) {
      baseDate = new Date(2026, 4, 31); // 4 = May
    }
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthSelect = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'short' });
      months.push({
        key: `${year}-${monthSelect}`,
        month: `${label} '${String(year).slice(-2)}`,
        revenue: 0,
        invoiced: 0,
      });
    }

    invoices.forEach((inv) => {
      const invMonth = (inv.date || "").substring(0, 7); // "YYYY-MM"
      const match = months.find((m) => m.key === invMonth);
      if (match) {
        if (inv.status === "paid") {
          match.revenue += Number(inv.total || 0);
        }
        match.invoiced += Number(inv.total || 0);
      }
    });

    return months;
  })();

  const getMetricsList = (): LedgerMetric[] => {
    return [
      { name: "Total Quotations Scope", value: `$${totalQuotationsVal.toLocaleString()}`, category: "Forecast" },
      { name: "Total Revenue Invoiced", value: `$${totalInvoicesVal.toLocaleString()}`, category: "Invoices" },
      { name: "Cleared Payment Revenue", value: `$${collectedRevenue.toLocaleString()}`, category: "Receipts" },
      { name: "Operating Expenses", value: `$${expenses.toLocaleString()}`, category: "Expenses" },
      { name: "Net Profit Earnings", value: `$${netProfit.toLocaleString()}`, category: "Profitability" },
      { name: "Operational Profit Margin", value: `${profitMargin}%`, category: "Profitability" },
    ];
  };

  // 1. Export Report to CSV with company metadata
  const handleExportCSV = () => {
    const metrics = getMetricsList();
    const rows = [
      ["MiraTech Executive Ledger Summary Report"],
      ["Company Name", company?.name || "Unregistered"],
      ["Generated Date", new Date().toLocaleString()],
      [],
      ["Metric Category", "Description", "Value"],
    ];

    metrics.forEach((m) => {
      rows.push([m.category, m.name, String(m.value)]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MiraTech_Executive_Report_${company?.name || "Ledger"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Export Executive Report A4 PDF with Corporate Letterhead
  const handleExportPDF = async () => {
    if (!pdfDashboardRef.current) return;
    try {
      const element = pdfDashboardRef.current;
      const canvas = await safeHtml2Canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Ledger_Executive_Report_${company?.name || "Company"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  // 3. Sync to Google Sheets
  const handleSheetsSync = async () => {
    if (!googleToken) {
      if (onGoogleSignInNeeded) onGoogleSignInNeeded();
      return;
    }

    setSyncingSheets(true);
    setSheetId(null);
    setErrorWord(null);

    try {
      const metrics = getMetricsList();
      const id = await syncToGoogleSheets(googleToken, company?.name || "MiraTech Client", metrics);
      setSheetId(id);
    } catch (err) {
      setErrorWord("Could not sync to Google Sheets. Please confirm if Google Workspace permissions are enabled.");
    } finally {
      setSyncingSheets(false);
    }
  };

  // 4. Backup PDF Report to Google Drive folder
  const handleDriveBackup = async () => {
    if (!googleToken) {
      if (onGoogleSignInNeeded) onGoogleSignInNeeded();
      return;
    }

    setUploadingDrive(true);
    setDriveFileId(null);
    setErrorWord(null);

    try {
      // 1. Generate PDF blob snapshot dynamically from the offscreen element
      if (!pdfDashboardRef.current) throw new Error("A4 Element target missing");
      const element = pdfDashboardRef.current;
      const canvas = await safeHtml2Canvas(element, { scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);

      // 2. Create raw base64 data matching sheets API format
      const rawPdfString = pdf.output("datauristring").split(",")[1];

      // 3. Upload direct using Google API
      const fileId = await uploadToGoogleDrive(
        googleToken,
        `Executive_Executive_Report_${company?.name || "MiraTech"}_${new Date().toLocaleDateString()}.pdf`,
        rawPdfString
      );

      setDriveFileId(fileId);
    } catch (err) {
      setErrorWord("Could not upload backup file to Google Drive. Please confirm Workspace app authorization is approved.");
    } finally {
      setUploadingDrive(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-800">C-Suite Executive Dashboard</h1>
          <p className="text-[11px] text-slate-500">Real-time enterprise balance spreadsheets, expenses, and Google Sync.</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-100 hover:bg-blue-50/50 text-blue-700 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition"
          >
            <Download className="h-3.5 w-3.5" /> CSV Report
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-blue-100 hover:bg-blue-50/50 text-blue-700 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition"
          >
            <Download className="h-3.5 w-3.5" /> A4 Report PDF
          </button>

          <button
            onClick={handleSheetsSync}
            disabled={syncingSheets}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100 text-[11px] font-bold cursor-pointer shadow-3xs transition disabled:opacity-50"
          >
            {syncingSheets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Google Sheets Sync
          </button>

          <button
            onClick={handleDriveBackup}
            disabled={uploadingDrive}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-150 hover:bg-blue-100 text-[11px] font-bold cursor-pointer shadow-3xs transition disabled:opacity-50"
          >
            {uploadingDrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudLightning className="h-3.5 w-3.5" />}
            Backup Active PDF
          </button>
        </div>
      </div>

      {errorWord && (
        <div className="p-2.5 text-[11px] bg-red-50 text-red-600 border border-red-100 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorWord}
        </div>
      )}

      {/* Sync Success Messages */}
      {(sheetId || driveFileId) && (
        <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-lg text-[11px] space-y-1.5">
          {sheetId && (
            <p className="text-emerald-850 font-bold flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
              Direct sync complete! Spreadsheet created:
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-emerald-950 font-mono text-[10px] break-all ml-1"
              >
                https://docs.google.com/spreadsheets/d/{sheetId}
              </a>
            </p>
          )}
          {driveFileId && (
            <p className="text-blue-850 font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              File successfully uploaded on your personal Google Drive! File ID:
              <span className="font-mono text-[9px] text-blue-950 bg-blue-100 py-0.5 px-1.5 rounded-sm ml-1 break-all">
                {driveFileId}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition">
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Billings Drafted</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-slate-800">${totalQuotationsVal.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-400">Quotations listed scope</p>
        </div>

        <div className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition">
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoiced Receivables</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-slate-800">${totalInvoicesVal.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-400">Across issued invoices</p>
        </div>

        <div className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition">
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operating Revenue</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100/40">
              <Wallet2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-emerald-700">${collectedRevenue.toLocaleString()}</h2>
          <p className="text-[9px] text-emerald-500">Cash collected via invoices</p>
        </div>

        <div className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition">
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operating Profit Margin</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-blue-700">{profitMargin}%</h2>
          <p className="text-[9px] text-blue-500">Adjusted dynamically below</p>
        </div>
      </div>

      {/* Monthly Revenue Trend Line Chart */}
      <div className="bg-white border border-blue-100/70 p-5 rounded-lg shadow-3xs hover:border-blue-200 transition">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5" style={{ color: company?.primaryColor || '#1E293B' }}>
              <TrendingUp className="h-4 w-4" style={{ color: company?.primaryColor || '#3B82F6' }} />
              Monthly Revenue Performance & Receivables Trend
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Cleared cash collections vs. total invoiced targets over the past 12 months.</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company?.primaryColor || '#3b82f6' }}></span> 
              Cleared Cash Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company?.secondaryColor || '#10b981' }}></span> 
              Invoiced Receivables
            </span>
          </div>
        </div>
        <div className="h-60 pt-2 text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="month" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                stroke="#64748B"
                dy={6}
              />
              <YAxis 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                stroke="#64748B"
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                dx={-6}
              />
              <Tooltip 
                contentStyle={{ 
                  fontSize: '11px', 
                  borderRadius: '8px', 
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0', 
                  boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' 
                }} 
                formatter={(value: any) => [`$${Number(value).toLocaleString()}`]}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                name="Cleared Cash Revenue"
                stroke={company?.primaryColor || "#3b82f6"} 
                strokeWidth={2.5}
                activeDot={{ r: 6 }} 
                dot={{ r: 3, strokeWidth: 1.5 }}
              />
              <Line 
                type="monotone" 
                dataKey="invoiced" 
                name="Invoiced Receivables"
                stroke={company?.secondaryColor || "#10b981"} 
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-1">
        {/* Dynamic Profit Adjuster Tool */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-3xs lg:col-span-4 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1.5">
              Profitability Margin Config
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Provide corporate operating expensing details to calculate exact net revenues.
            </p>

            <div className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-blue-950 uppercase mb-1.5">
                  Operating Expenses ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={expenses}
                  onChange={(e) => setExpenses(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-mono bg-slate-50/20 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="p-2.5 bg-blue-50/30 border border-blue-100/60 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Gross Cleared Revenue:</span>
                  <span className="font-bold font-mono text-slate-700">${collectedRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Operating Outlays:</span>
                  <span className="font-bold font-mono text-red-500">-${expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-blue-100/80 pt-1.5 text-slate-800 font-bold text-[11px]">
                  <span>Net Ledger Profit:</span>
                  <span className="font-mono text-emerald-700">${netProfit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
            * Local cache secure sync
          </div>
        </div>

        {/* Ledgers metrics data list / previewer target */}
        <div className="bg-white border border-blue-100 rounded-lg p-4 shadow-3xs lg:col-span-8 space-y-3">
          <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Report Metrics Summary Table</h3>
          <div className="overflow-x-auto border border-blue-50/70 rounded-md">
            <table className="high-density-table w-full text-left text-xs text-slate-600">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description Metric Key</th>
                  <th className="text-right">Reported Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {getMetricsList().map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20">
                    <td className="font-bold uppercase text-[9px] text-slate-400">{item.category}</td>
                    <td className="text-slate-800 font-bold">{item.name}</td>
                    <td className="text-right font-mono font-bold text-slate-900">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OFFSCREEN PRINTABLE A4 REPORT CONTAINER - EXTREMELY HIGH FIDELITY DESIGN */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div
          ref={pdfDashboardRef}
          style={{ width: "210mm", minHeight: "297mm" }}
          className="bg-white p-[20mm] text-slate-800 font-sans"
        >
          {/* Company Letterhead Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-8">
            <div>
              {company?.letterheadLogo ? (
                <Image
                  src={company.letterheadLogo}
                  alt="Corporate Letterhead Logo"
                  width={200}
                  height={80}
                  className="max-h-20 object-contain mb-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-lg font-extrabold text-slate-900 uppercase tracking-tight">
                  {company?.name || "Corporate Ledger"}
                </span>
              )}
              <h1 className="text-2xl font-black text-slate-900 tracking-wider">EXECUTIVE REPORT SUMMARY</h1>
            </div>

            <div className="text-right text-[11px] text-slate-500 space-y-0.5">
              <p className="font-bold text-slate-800">{company?.name || "MiraTech Client"}</p>
              <p>{company?.email}</p>
              <p>{company?.phone}</p>
              <p className="whitespace-pre-line max-w-[200px]">{company?.address}</p>
            </div>
          </div>

          <div className="mb-6">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              REPORT METADATA DETAILS
            </span>
            <div className="grid grid-cols-2 text-xs border border-slate-200 rounded-lg p-3.5 bg-slate-50">
              <div>
                <p>
                  <strong>Prepared For:</strong> MiraTech Executive Board
                </p>
                <p>
                  <strong>Registered Company:</strong> {company?.name || "Ledger client"}
                </p>
              </div>
              <div className="text-right">
                <p>
                  <strong>Report Date:</strong> {new Date().toLocaleString()}
                </p>
                <p>
                  <strong>Status Ledger:</strong> Cleared Accounts Only
                </p>
              </div>
            </div>
          </div>

          {/* Primary Metrics Grid in PDF */}
          <div className="grid grid-cols-3 gap-3.5 mb-8">
            <div className="border border-slate-250 p-4 rounded-xl text-center">
              <span className="text-[9px] text-slate-400 uppercase font-black block">Total Invoiced</span>
              <strong className="text-md font-bold tracking-tight text-slate-800 font-mono mt-1 block">
                ${totalInvoicesVal.toLocaleString()}
              </strong>
            </div>
            <div className="border border-slate-250 p-4 rounded-xl text-center">
              <span className="text-[9px] text-emerald-550 uppercase font-black block">Operating Revenue</span>
              <strong className="text-md font-bold tracking-tight text-emerald-700 font-mono mt-1 block">
                ${collectedRevenue.toLocaleString()}
              </strong>
            </div>
            <div className="border border-slate-250 p-4 rounded-xl text-center">
              <span className="text-[9px] text-blue-550 uppercase font-black block">Net Profit Earnings</span>
              <strong className="text-md font-bold tracking-tight text-blue-700 font-mono mt-1 block">
                ${netProfit.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* Central Summary Table */}
          <div className="mb-8">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              FINANCIAL PERFORMANCE BREAKDOWN
            </span>
            <table className="w-full text-left text-xs border border-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold uppercase text-[9px] tracking-wider">
                  <th className="py-2 px-3 border border-slate-900">Category</th>
                  <th className="py-2 px-3 border border-slate-900">Metric Description Key</th>
                  <th className="py-2 px-3 border border-slate-900 text-right">Value Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {getMetricsList().map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 border border-slate-200 uppercase text-[9px] text-slate-500 font-semibold bg-slate-50/50">
                      {item.category}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 text-slate-900 font-semibold">{item.name}</td>
                    <td className="py-2.5 px-3 border border-slate-200 text-right font-mono font-bold text-slate-900">
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-550 mt-4 leading-relaxed max-w-[500px]">
            <strong>Disclaimer:</strong> This executive spreadsheet summarizes calculations compiled under private cloud sandbox environments. Calculations are subject to expensing outlays provided dynamically.
          </p>

          <div className="absolute bottom-[20mm] left-[20mm] right-[20mm] border-t border-slate-200 pt-5 text-center text-[10px] text-slate-400 font-semibold">
            MiraTech Executive Report & Ledger Engine - {new Date().getFullYear()} All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
