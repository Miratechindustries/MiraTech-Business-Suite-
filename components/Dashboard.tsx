"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { syncToGoogleSheets, uploadToGoogleDrive, LedgerMetric } from "../lib/googleApi";
import { BarChart3, TrendingUp, DollarSign, Wallet2, FileSpreadsheet, Download, CloudLightning, Loader2, CheckSquare, ShieldCheck, AlertCircle, ArrowDownLeft, AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import Image from "next/image";
import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";
import LoadingSkeleton from "./LoadingSkeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { motion } from "motion/react";
import AuditLogs from "./AuditLogs";
import TrialDaysIndicator from "./TrialDaysIndicator";

interface Invoice {
  total: number;
  status: "unpaid" | "paid" | "overdue";
  date?: string;
  number?: string;
  items?: { description: string; quantity: number; price: number }[];
}

interface Quotation {
  total: number;
  status: "pending" | "accepted" | "declined";
  number?: string;
  createdAt?: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: "Inflow" | "Outflow";
  reference: string;
  method: string;
  amount: number;
  status: "Settled" | "Pending";
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
  primaryColor?: string;
  secondaryColor?: string;
  subscriptionStatus?: string;
  subscriptionPlanId?: string;
  subscriptionTrialEndsAt?: string;
  trialEndsAt?: string;
  createdAt?: string;
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

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Expense controller for dynamically calculating net profit margins
  const [expenses, setExpenses] = useState<number>(1500);

  const [activeChartTab, setActiveChartTab] = useState<"collections" | "pipeline">("collections");

  const pdfDashboardRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
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
          qList.push({ id: docSnap.id, ...docSnap.data() } as unknown as Quotation);
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
          iList.push({ id: docSnap.id, ...docSnap.data() } as unknown as Invoice);
        });
        // Sort by number descending
        iList.sort((a, b) => (b.number || "").localeCompare(a.number || ""));
        setInvoices(iList);
        localStorage.setItem(`miratech_offline_invoices_${businessId}`, JSON.stringify(iList));
      }

      // 5. Fetch Transactions (tenant-scoped nested subcollection)
      const tList: Transaction[] = [];
      if (businessId) {
        const tRef = collection(db, "companies", businessId, "transactions");
        const tSnap = await getDocs(tRef);
        tSnap.forEach((docSnap) => {
          tList.push({ id: docSnap.id, ...docSnap.data() } as unknown as Transaction);
        });
        setTransactions(tList);
        localStorage.setItem(`miratech_offline_transactions_${businessId}`, JSON.stringify(tList));
      }
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Dashboard Offline Fallback] Loading from cache.");
        // Try to load cached transactions
        const rawUser = importAuth.currentUser;
        let businessId = currentUser?.companyId || currentUser?.businessId;
        if (!businessId && rawUser) {
          businessId = rawUser.uid;
        }
        if (businessId) {
          const cachedTxStr = localStorage.getItem(`miratech_offline_transactions_${businessId}`);
          if (cachedTxStr) {
            setTransactions(JSON.parse(cachedTxStr));
          }
          const cachedInvStr = localStorage.getItem(`miratech_offline_invoices_${businessId}`);
          if (cachedInvStr) {
            setInvoices(JSON.parse(cachedInvStr));
          }
          const cachedQuotStr = localStorage.getItem(`miratech_offline_quotations_${businessId}`);
          if (cachedQuotStr) {
            setQuotations(JSON.parse(cachedQuotStr));
          }
        }
      } else {
        console.error("Error loading dashboard data:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser?.companyId, currentUser?.businessId, currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute stats
  const totalQuotationsVal = quotations.reduce((acc, q) => acc + q.total, 0);
  const totalInvoicesVal = invoices.reduce((acc, i) => acc + i.total, 0);

  // Inflows & Outflows from Transactions
  const grossInflow = transactions.filter((t) => t.type === "Inflow" && t.status === "Settled").reduce((acc, t) => acc + t.amount, 0);
  const outflow = transactions.filter((t) => t.type === "Outflow" && t.status === "Settled").reduce((acc, t) => acc + t.amount, 0);

  // Invoice received amounts (paid invoices)
  const invoiceReceived = invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.total, 0);

  // Collected Revenue includes both Invoice Received amounts and Gross Inflow
  const collectedRevenue = invoiceReceived + grossInflow;

  // Total Outlay includes Corporate Operating Expenses plus Transaction Outflows
  const totalOutflowExpenses = expenses + outflow;

  // Net pay / Profit (How much we made minus expenses)
  const netProfit = collectedRevenue - totalOutflowExpenses;
  const profitMargin = collectedRevenue > 0 ? ((netProfit / collectedRevenue) * 100).toFixed(1) : "0.0";

  // Past 12 Months Revenue and Invoiced Trends
  const trendData = (() => {
    const months: any[] = [];
    let baseDate = new Date();
    // Anchor at May 2026 for consistent presentation in demo database, else use current year.
    if (baseDate.getFullYear() < 2026) {
      baseDate = new Date(2026, 4, 31); // 4 = May
    }
    
    // Illustrative fallback if empty
    const isEmpty = invoices.length === 0;
    const demoData = [
      { revenue: 15000, invoiced: 22000, unpaidCount: 4 },
      { revenue: 18000, invoiced: 25000, unpaidCount: 5 },
      { revenue: 12000, invoiced: 18000, unpaidCount: 3 },
      { revenue: 22000, invoiced: 29000, unpaidCount: 6 },
      { revenue: 25000, invoiced: 34000, unpaidCount: 7 },
      { revenue: 21000, invoiced: 27000, unpaidCount: 4 },
      { revenue: 28000, invoiced: 38000, unpaidCount: 8 },
      { revenue: 31000, invoiced: 41000, unpaidCount: 5 },
      { revenue: 26000, invoiced: 33500, unpaidCount: 9 },
      { revenue: 34000, invoiced: 45000, unpaidCount: 6 },
      { revenue: 39000, invoiced: 48000, unpaidCount: 4 },
      { revenue: 41000, invoiced: 52000, unpaidCount: 3 },
    ];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthSelect = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'short' });
      const demoVal = demoData[11 - i];
      months.push({
        key: `${year}-${monthSelect}`,
        month: `${label} '${String(year).slice(-2)}`,
        revenue: isEmpty ? demoVal.revenue : 0,
        invoiced: isEmpty ? demoVal.invoiced : 0,
        unpaidCount: isEmpty ? demoVal.unpaidCount : 0,
      });
    }

    if (!isEmpty) {
      invoices.forEach((inv) => {
        const invMonth = (inv.date || "").substring(0, 7); // "YYYY-MM"
        const match = months.find((m) => m.key === invMonth);
        if (match) {
          if (inv.status === "paid") {
            match.revenue += Number(inv.total || 0);
          } else if (inv.status === "unpaid" || inv.status === "overdue") {
            match.unpaidCount += 1;
          }
          match.invoiced += Number(inv.total || 0);
        }
      });
    }

    return months;
  })();

  // Computed values for top-selling inventory items
  const topSellingItems = (() => {
    const counts: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    const hasItems = invoices.some(inv => inv.items && Array.isArray(inv.items) && inv.items.length > 0);

    if (hasItems) {
      invoices.forEach((inv) => {
        if (inv.items && Array.isArray(inv.items)) {
          inv.items.forEach((item) => {
            const name = item.description || "Unknown Item";
            if (!counts[name]) {
              counts[name] = { name, quantity: 0, revenue: 0 };
            }
            counts[name].quantity += Number(item.quantity || 0);
            counts[name].revenue += Number(item.quantity || 0) * Number(item.price || 0);
          });
        }
      });
      return Object.values(counts)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    } else {
      return [];
    }
  })();

  // Stats on unpaid invoices
  const unpaidInvoices = invoices.filter(i => i.status === "unpaid" || i.status === "overdue");
  const unpaidInvoicesCount = unpaidInvoices.length;
  const unpaidInvoicesAmount = unpaidInvoices.reduce((acc, i) => acc + (i.total || 0), 0);
  
  const overdueInvoices = invoices.filter(i => i.status === "overdue");
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((acc, i) => acc + (i.total || 0), 0);

  // Live values without fictitious mock amounts
  const displayUnpaidCount = unpaidInvoicesCount;
  const displayUnpaidAmount = unpaidInvoicesAmount;
  const displayOverdueCount = overdueCount;
  const displayOverdueAmount = overdueAmount;

  const generateAiInsights = async () => {
    setLoadingInsights(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company?.name || "MiraTech Client",
          totalQuotationsVal,
          totalInvoicesVal,
          collectedRevenue,
          totalOutflowExpenses,
          netProfit,
          profitMargin,
          unpaidCount: displayUnpaidCount,
          unpaidAmount: displayUnpaidAmount,
          overdueCount: displayOverdueCount,
          overdueAmount: displayOverdueAmount
        }),
      });
      const data = await response.json();
      if (data.error) {
        setAiInsights(`• **Error generating AI insights**: ${data.error}`);
      } else {
        setAiInsights(data.text);
      }
    } catch (err: any) {
      console.error("AI Insights fetch failed:", err);
      setAiInsights(`• **Error fetching insights**: ${err.message || "Unknown error"}`);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (company && !aiInsights && !loadingInsights) {
      generateAiInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, invoices]);

  // Computed values for collections pie chart
  const isCollectionsEmpty = invoices.length === 0 || invoices.reduce((acc, i) => acc + (i.total || 0), 0) === 0;
  
  const collectionsData = (() => {
    if (isCollectionsEmpty) {
      return [
        { name: "Paid", value: 38400, color: "#10B981", percent: "60.0%" },
        { name: "Unpaid", value: 16000, color: company?.primaryColor || "#3B82F6", percent: "25.0%" },
        { name: "Overdue", value: 9600, color: "#F43F5E", percent: "15.0%" },
      ];
    }
    
    const paidSum = invoices.filter(i => i.status === "paid").reduce((acc, i) => acc + (i.total || 0), 0);
    const unpaidSum = invoices.filter(i => i.status === "unpaid").reduce((acc, i) => acc + (i.total || 0), 0);
    const overdueSum = invoices.filter(i => i.status === "overdue").reduce((acc, i) => acc + (i.total || 0), 0);
    const totalSelected = paidSum + unpaidSum + overdueSum;
    
    return [
      { 
        name: "Paid", 
        value: paidSum, 
        color: "#10B981", 
        percent: totalSelected > 0 ? `${((paidSum / totalSelected) * 100).toFixed(1)}%` : "0.0%" 
      },
      { 
        name: "Unpaid", 
        value: unpaidSum, 
        color: company?.primaryColor || "#3B82F6", 
        percent: totalSelected > 0 ? `${((unpaidSum / totalSelected) * 100).toFixed(1)}%` : "0.0%" 
      },
      { 
        name: "Overdue", 
        value: overdueSum, 
        color: "#F43F5E", 
        percent: totalSelected > 0 ? `${((overdueSum / totalSelected) * 100).toFixed(1)}%` : "0.0%" 
      },
    ];
  })();

  // Computed values for pipeline performance bar chart
  const isPipelineEmpty = quotations.length === 0 || quotations.reduce((acc, q) => acc + (q.total || 0), 0) === 0;
  
  const pipelineData = (() => {
    if (isPipelineEmpty) {
      return [
        { name: "Accepted", value: 58000, color: "#10B981" },
        { name: "Pending", value: 34000, color: company?.primaryColor || "#3B82F6" },
        { name: "Declined", value: 12000, color: "#F43F5E" },
      ];
    }
    
    const acceptedSum = quotations.filter(q => q.status === "accepted").reduce((acc, q) => acc + (q.total || 0), 0);
    const pendingSum = quotations.filter(q => q.status === "pending").reduce((acc, q) => acc + (q.total || 0), 0);
    const declinedSum = quotations.filter(q => q.status === "declined").reduce((acc, q) => acc + (q.total || 0), 0);
    
    return [
      { name: "Accepted", value: acceptedSum, color: "#10B981" },
      { name: "Pending", value: pendingSum, color: company?.primaryColor || "#3B82F6" },
      { name: "Declined", value: declinedSum, color: "#F43F5E" },
    ];
  })();

  const getMetricsList = (): LedgerMetric[] => {
    return [
      { name: "Total Quotations Scope", value: `E${totalQuotationsVal.toLocaleString()}`, category: "Forecast" },
      { name: "Total Revenue Invoiced", value: `E${totalInvoicesVal.toLocaleString()}`, category: "Invoices" },
      { name: "Invoice Received Amounts", value: `E${invoiceReceived.toLocaleString()}`, category: "Receipts" },
      { name: "Gross Inflow Transactions", value: `E${grossInflow.toLocaleString()}`, category: "Inflows" },
      { name: "Outflow Transactions", value: `E${outflow.toLocaleString()}`, category: "Outflows" },
      { name: "Operating Expenses", value: `E${expenses.toLocaleString()}`, category: "Expenses" },
      { name: "Combined Operating Revenues", value: `E${collectedRevenue.toLocaleString()}`, category: "Receipts" },
      { name: "Net Pay / Profit Earnings", value: `E${netProfit.toLocaleString()}`, category: "Profitability" },
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
      {/* Dynamic 14-Day Evaluation Trial Days Indicator */}
      {company && <TrialDaysIndicator company={company as any} />}

      {/* Upper Status Bar */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
      >
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
      </motion.div>

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

      {/* Executive Command AI Advisor Card */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.02 }}
        className="bg-white border border-indigo-100 p-5 rounded-lg shadow-3xs"
        id="executive-command-ai-advisor-card"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100/40">
              <Sparkles className="h-4 w-4 animate-pulse text-indigo-500" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Executive AI Intelligence Advisor
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Automated cash flow risk audits and C-suite strategic recommendations.
              </p>
            </div>
          </div>

          <button
            onClick={generateAiInsights}
            disabled={loadingInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            {loadingInsights ? 'Analyzing Ledger...' : 'Run Intelligence Audit'}
          </button>
        </div>

        {loadingInsights ? (
          <div className="py-4 px-2 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>C-Suite Intelligence Engine running diagnostics...</span>
            </div>
            <div className="space-y-1.5 pl-6">
              <p className="text-[10px] text-slate-400 animate-pulse">✓ Parsing live general ledger receipts and invoicing pipelines</p>
              <p className="text-[10px] text-slate-400 animate-pulse delay-75">✓ Auditing operational profit margins and expense ratios</p>
              <p className="text-[10px] text-slate-400 animate-pulse delay-150">✓ Formulating tactical cash reserves recommendations</p>
            </div>
          </div>
        ) : aiInsights ? (
          <ul className="space-y-2 pl-1">
            {aiInsights.split("\n").map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("•") || trimmed.startsWith("*") || trimmed.startsWith("-")) {
                // Remove bullet symbol
                let content = trimmed;
                if (trimmed.startsWith("•")) content = trimmed.substring(1).trim();
                else if (trimmed.startsWith("*")) {
                  if (trimmed.startsWith("**") && trimmed.slice(2).includes("**")) {
                    content = trimmed;
                  } else {
                    content = trimmed.substring(1).trim();
                  }
                } else if (trimmed.startsWith("-")) content = trimmed.substring(1).trim();

                // Format bold segments
                const boldRegex = /\*\*(.*?)\*\*/g;
                const parts = [];
                let lastIndex = 0;
                let match;
                while ((match = boldRegex.exec(content)) !== null) {
                  if (match.index > lastIndex) {
                    parts.push(content.substring(lastIndex, match.index));
                  }
                  parts.push(<strong key={match.index} className="font-extrabold text-slate-900">{match[1]}</strong>);
                  lastIndex = boldRegex.lastIndex;
                }
                if (lastIndex < content.length) {
                  parts.push(content.substring(lastIndex));
                }

                return (
                  <li key={idx} className="flex items-start gap-2.5 text-slate-600 text-xs leading-relaxed">
                    <span className="text-indigo-500 font-extrabold mt-1">•</span>
                    <span className="flex-1">{parts.length > 0 ? parts : content}</span>
                  </li>
                );
              }
              
              // Non-bullet text formatting
              const boldRegex = /\*\*(.*?)\*\*/g;
              const parts = [];
              let lastIndex = 0;
              let match;
              while ((match = boldRegex.exec(trimmed)) !== null) {
                if (match.index > lastIndex) {
                  parts.push(trimmed.substring(lastIndex, match.index));
                }
                parts.push(<strong key={match.index} className="font-extrabold text-slate-900">{match[1]}</strong>);
                lastIndex = boldRegex.lastIndex;
              }
              if (lastIndex < trimmed.length) {
                parts.push(trimmed.substring(lastIndex));
              }

              return (
                <p key={idx} className="text-slate-500 text-xs leading-relaxed">
                  {parts.length > 0 ? parts : trimmed}
                </p>
              );
            })}
          </ul>
        ) : (
          <div className="py-2 text-center">
            <p className="text-xs text-slate-400">Click &quot;Run Intelligence Audit&quot; to compile your real-time advisory insights.</p>
          </div>
        )}
      </motion.div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Gross Billings Metric Card */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
          className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition"
        >
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Billings Drafted</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-slate-800">E{totalQuotationsVal.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-400">Quotations listed scope</p>
        </motion.div>

        {/* Invoiced Receivables Metric Card */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition"
        >
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoiced Receivables</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-slate-800">E{totalInvoicesVal.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-400">Across issued invoices</p>
        </motion.div>

        {/* Total Cash Inflow Metric Card */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition"
        >
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Cash Inflow</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100/40">
              <Wallet2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-emerald-700">E{collectedRevenue.toLocaleString()}</h2>
          <p className="text-[9px] text-emerald-500">
            Invoiced (E{invoiceReceived.toLocaleString()}) + Inflows (E{grossInflow.toLocaleString()})
          </p>
        </motion.div>

        {/* Combined Expenses Card */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="bg-white border border-red-100/75 p-4 rounded-lg shadow-3xs hover:border-red-200 transition"
        >
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Combined Expenses</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-md border border-red-100/45">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-red-600">E{totalOutflowExpenses.toLocaleString()}</h2>
          <p className="text-[9px] text-red-500">
            Fixed (E{expenses.toLocaleString()}) + Outflow (E{outflow.toLocaleString()})
          </p>
        </motion.div>

        {/* Net Pay/Profit Margin Metric Card */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
          className="bg-white border border-blue-100/70 p-4 rounded-lg shadow-3xs hover:border-blue-200 transition"
        >
          <div className="flex justify-between items-center text-slate-500 mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Pay & Margin</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100/40">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="text-lg font-extrabold font-mono text-blue-700">E{netProfit.toLocaleString()}</h2>
          <p className="text-[9px] text-blue-500">Margin: {profitMargin}%</p>
        </motion.div>
      </div>

      {/* Charts Display Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Revenue Trend Line Chart */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.3 }}
          className="bg-white border border-blue-100/70 p-5 rounded-lg shadow-3xs hover:border-blue-200 transition lg:col-span-7 flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5" style={{ color: company?.primaryColor || '#1E293B' }}>
                  <TrendingUp className="h-4 w-4" style={{ color: company?.primaryColor || '#3B82F6' }} />
                  Monthly Performance Trend
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Cleared cash collections, invoiced targets, and unpaid invoice counts over the past 12 months.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold pb-2 sm:pb-0">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company?.primaryColor || '#3b82f6' }}></span> 
                  Cleared Cash
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company?.secondaryColor || '#10b981' }}></span> 
                  Invoiced Receivables
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 font-mono"></span> 
                  Unpaid Invoice Count
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
                    yAxisId="left"
                    orientation="left"
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#64748B"
                    tickFormatter={(val) => `E${val.toLocaleString()}`}
                    dx={-6}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#F43F5E"
                    tickFormatter={(val) => `${val}`}
                    dx={6}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      fontSize: '11px', 
                      borderRadius: '8px', 
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0', 
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' 
                    }} 
                    formatter={(value: any, name: any) => {
                      if (name === "Unpaid Invoices Count") {
                        return [`${value} invoices`, name];
                      }
                      return [`E${Number(value).toLocaleString()}`, name];
                    }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="revenue" 
                    name="Cleared Cash Revenue"
                    stroke={company?.primaryColor || "#3b82f6"} 
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }} 
                    dot={{ r: 3, strokeWidth: 1.5 }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="invoiced" 
                    name="Invoiced Receivables"
                    stroke={company?.secondaryColor || "#10b981"} 
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="unpaidCount" 
                    name="Unpaid Invoices Count"
                    stroke="#F43F5E" 
                    strokeWidth={2}
                    activeDot={{ r: 5 }} 
                    dot={{ r: 3, stroke: "#F43F5E", fill: "#FFF" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Fulfillment & Pipeline Graphs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.35 }}
          className="bg-white border border-blue-100/70 p-5 rounded-lg shadow-3xs hover:border-blue-200 transition lg:col-span-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider" style={{ color: company?.primaryColor || '#1E293B' }}>
                  Fulfillment & Pipeline
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {activeChartTab === "collections" 
                    ? "Invoiced balance settlement ratios" 
                    : "Lead opportunities status funnel"}
                </p>
              </div>
              {/* Empirical Fallbacks Badge Indicator */}
              {((activeChartTab === "collections" && isCollectionsEmpty) || (activeChartTab === "pipeline" && isPipelineEmpty)) && (
                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  Illustrative Demo
                </span>
              )}
            </div>

            {/* Inner Switcher Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-md text-[11px] font-bold mb-4">
              <button
                onClick={() => setActiveChartTab("collections")}
                className={`flex-1 py-1 rounded text-center transition cursor-pointer font-bold ${
                  activeChartTab === "collections"
                    ? "bg-white text-slate-800 shadow-3xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Collections Fulfillment
              </button>
              <button
                onClick={() => setActiveChartTab("pipeline")}
                className={`flex-1 py-1 rounded text-center transition cursor-pointer font-bold ${
                  activeChartTab === "pipeline"
                    ? "bg-white text-slate-800 shadow-3xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Lead Pipeline
              </button>
            </div>

            {/* Render Tab Contents */}
            <div className="h-60 flex flex-col justify-center">
              {activeChartTab === "collections" ? (
                <div className="relative h-full flex flex-col justify-between pb-1">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={collectionsData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {collectionsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            fontSize: '11px',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)'
                          }}
                          formatter={(value: any, name: any, rawItem: any) => [
                            `E${Number(value).toLocaleString()} (${rawItem.payload?.percent || ""})`,
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-2.5 border-t border-slate-100/80 text-[10px] font-bold text-center">
                    {collectionsData.map((item, index) => (
                      <div key={index} className="space-y-0.5">
                        <span className="flex items-center justify-center gap-1 text-slate-400 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                          {item.name}
                        </span>
                        <strong className="block text-slate-850 font-mono text-[9px] truncate">
                          E{item.value.toLocaleString()}
                        </strong>
                        <span className="bg-slate-50 text-slate-500 border border-slate-200/50 py-0.5 px-1 rounded block text-[8px] font-mono">
                          {item.percent}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative h-full flex flex-col justify-between pb-1">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipelineData} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          stroke="#64748B"
                        />
                        <YAxis
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          stroke="#64748B"
                          tickFormatter={(val) => `E${val.toLocaleString()}`}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: '11px',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)'
                          }}
                          formatter={(value: any) => [`E${Number(value).toLocaleString()}`]}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={30}
                        >
                          {pipelineData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100/80 text-[10px] font-bold text-center">
                    {pipelineData.map((item, index) => (
                      <div key={index} className="space-y-0.5">
                        <span className="flex items-center justify-center gap-1 text-slate-400 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                          {item.name}
                        </span>
                        <strong className="block text-slate-850 font-mono text-[9px] truncate">
                          E{item.value.toLocaleString()}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enterprise Fiscal Monitoring & Inventory Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-tw-animate-css">
        {/* Top-Selling Inventory Items */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.4 }}
          className="bg-white border border-blue-100/70 p-5 rounded-lg shadow-3xs hover:border-blue-200 transition lg:col-span-7 flex flex-col justify-between"
          id="dashboard-top-selling-inventory-card"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5" style={{ color: company?.primaryColor || '#1E293B' }}>
                  <TrendingUp className="h-4 w-4" style={{ color: company?.primaryColor || '#3B82F6' }} />
                  Top-Selling Inventory & Service Items
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Strategic volume and revenue rankings across all client accounts.
                </p>
              </div>
            </div>

            {topSellingItems.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-lg my-2">
                <TrendingUp className="h-6 w-6 text-slate-300 mb-1.5" />
                <p className="text-xs font-bold text-slate-600">No Item Data Available</p>
                <p className="text-[10px] text-slate-400 max-w-xs mt-0.5">Item volume and revenue distribution will populate automatically once invoices with line items are issued.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-2">
              <div className="h-44 md:col-span-7">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topSellingItems}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" fontSize={9} stroke="#64748B" axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      fontSize={9}
                      stroke="#64748B"
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: "11px",
                        borderRadius: "8px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: any, name: any) => {
                        if (name === "Quantity Sold") return [`${value} units`, "Units Sold"];
                        if (name === "Generated Revenue") return [`E${Number(value).toLocaleString()}`, "Revenue"];
                        return [value, name];
                      }}
                    />
                    <Bar 
                      dataKey="quantity" 
                      name="Quantity Sold" 
                      fill={company?.primaryColor || "#3b82f6"} 
                      radius={[0, 4, 4, 0]} 
                      barSize={12} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="md:col-span-5 flex flex-col justify-center">
                <div className="overflow-x-auto border border-slate-100 rounded-md">
                  <table className="w-full text-left text-[10px] text-slate-600">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[8px] tracking-wider border-b border-slate-100">
                        <th className="py-1 px-2">Item Name</th>
                        <th className="py-1 px-2 text-center">Qty</th>
                        <th className="py-1 px-2 text-right border-l border-slate-100">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {topSellingItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 text-slate-800 font-semibold truncate max-w-[90px]" title={item.name}>
                            {item.name}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-slate-600 font-bold">
                            {item.quantity}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 border-l border-slate-100 font-mono">
                            E{item.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        </motion.div>

        {/* Unpaid Invoices Fiscal Risk & Volume */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.45 }}
          className="bg-white border border-blue-100/70 p-5 rounded-lg shadow-3xs hover:border-blue-200 transition lg:col-span-5 flex flex-col justify-between"
          id="dashboard-unpaid-invoices-risk-card"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5" style={{ color: company?.primaryColor || '#1E293B' }}>
                  <AlertCircle className="h-4 w-4" style={{ color: '#F43F5E' }} />
                  Outstanding Cash-Flow Monitor
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Real-time visual tracker of outstanding financial receivables.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100 text-center flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest block">Unpaid Invoice Balance</span>
                  <h4 className="text-lg font-extrabold font-mono text-rose-700 mt-1">E{displayUnpaidAmount.toLocaleString()}</h4>
                </div>
                <div className="mt-2 text-[9px] text-rose-600 bg-rose-50 border border-rose-200/50 py-0.5 px-1 rounded inline-block font-mono">
                  {displayUnpaidCount} invoices outstanding
                </div>
              </div>

              <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100 text-center flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest block">Critically Overdue Balance</span>
                  <h4 className="text-lg font-extrabold font-mono text-amber-700 mt-1">E{displayOverdueAmount.toLocaleString()}</h4>
                </div>
                <div className="mt-2 text-[9px] text-amber-600 bg-amber-50 border border-amber-200/50 py-0.5 px-1 rounded inline-block font-mono font-mono">
                  {displayOverdueCount} critically overdue
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-2.5 text-[10px] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
              <p className="leading-relaxed">
                Fiscal forecast is adjusted for <strong className="text-slate-900 font-mono">E{displayUnpaidAmount.toLocaleString()}</strong> in liquid receivables requiring prompt active follow-ups.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-1">
        {/* Profitability Config Panel */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.5 }}
          className="bg-white border border-blue-100 rounded-lg p-4 shadow-3xs lg:col-span-4 flex flex-col justify-between space-y-3"
        >
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
                  Operating Expenses (E)
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
                  <span className="font-bold font-mono text-slate-700">E{collectedRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Operating Outlays:</span>
                  <span className="font-bold font-mono text-red-500">-E{expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-blue-100/80 pt-1.5 text-slate-800 font-bold text-[11px]">
                  <span>Net Ledger Profit:</span>
                  <span className="font-mono text-emerald-700">E{netProfit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
            * Local cache secure sync
          </div>
        </motion.div>

        {/* Report Metrics Summary Spreadsheet */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.55 }}
          className="bg-white border border-blue-100 rounded-lg p-4 shadow-3xs lg:col-span-8 space-y-3"
        >
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
        </motion.div>
      </div>

      {/* Operator Session Security Trace Logs (System Session Audit Logs) */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.6 }}
        className="mt-4 space-y-2 bg-white border border-slate-205 p-5 rounded-lg shadow-3xs hover:border-slate-300 transition"
      >
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5 mb-2.5">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest text-[9px]">
            Operator Security Console (Private Session Embed Only)
          </h3>
        </div>
        <AuditLogs userLogsOnly={true} />
      </motion.div>

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
                E{totalInvoicesVal.toLocaleString()}
              </strong>
            </div>
            <div className="border border-slate-250 p-4 rounded-xl text-center">
              <span className="text-[9px] text-emerald-555 uppercase font-black block">Operating Revenue</span>
              <strong className="text-md font-bold tracking-tight text-emerald-700 font-mono mt-1 block">
                E{collectedRevenue.toLocaleString()}
              </strong>
            </div>
            <div className="border border-slate-250 p-4 rounded-xl text-center">
              <span className="text-[9px] text-blue-555 uppercase font-black block">Net Profit Earnings</span>
              <strong className="text-md font-bold tracking-tight text-blue-700 font-mono mt-1 block">
                E{netProfit.toLocaleString()}
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
            MiraTech Business Suite - {new Date().getFullYear()} All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
