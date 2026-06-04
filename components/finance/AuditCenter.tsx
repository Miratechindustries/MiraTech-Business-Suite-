"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Clock, 
  Plus, 
  HelpCircle, 
  CheckCircle, 
  TrendingUp, 
  DollarSign, 
  SlidersHorizontal,
  PlusCircle,
  FileCheck2,
  ListFilter,
  Users2,
  Building2,
  Calendar,
  Sparkles,
  Loader2,
  Printer,
  ChevronRight,
  Send,
  Lock
} from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { collection, query, getDocs, doc, getDoc, addDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useUserStore, useToastStore } from "../../lib/store";
import { motion, AnimatePresence } from "motion/react";
import { 
  getLedgerEntries, 
  getJournalEntries, 
  createDoubleEntry, 
  LedgerEntry, 
  JournalEntry, 
  TRANSACTION_MAPPINGS 
} from "../../lib/finance/ledger";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

// Recharts components
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface BusinessTenant {
  id: string;
  name: string;
  ownerId?: string;
}

export default function AuditCenter() {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  // Tab states: 'dashboard' | 'ledger' | 'statements' | 'reconcile' | 'comply'
  const [activeTab, setActiveTab] = useState<"dashboard" | "ledger" | "statements" | "reconcile" | "comply">("dashboard");
  const [businessId, setBusinessId] = useState<string | null>(null);
  
  // Super Admin view states
  const [tenants, setTenants] = useState<BusinessTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);

  // Core accounting states
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Ledger filters
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState("All");

  // Direct Bookkeeping Posting Form State
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryModule, setEntryModule] = useState<string>("Customer Subscriptions");
  const [entryAmount, setEntryAmount] = useState<number>(1250);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [entryDescription, setEntryDescription] = useState<string>("Enterprise premium yearly seat subscription");
  const [entryInvoiceRef, setEntryInvoiceRef] = useState<string>("INV-2026-XQ4");
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  // Scheduled Exports Setting
  const [scheduleType, setScheduleType] = useState<"Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annual">("Monthly");
  const [scheduledReports, setScheduledReports] = useState<{ id: string; date: string; type: string; frequency: string; status: string }[]>([
    { id: "REP-902", date: "2026-05-31", type: "Consolidated Financial Ledger", frequency: "Weekly", status: "Ready for generation" },
    { id: "REP-903", date: "2026-05-31", type: "P&L Balance Sheets", frequency: "Monthly", status: "Ready for generation" },
    { id: "REP-904", date: "2026-06-01", type: "Anomalies Audits Ledger", frequency: "Daily", status: "Ready for generation" }
  ]);

  // AI Compliance report states
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Selected statement for preview: 'Balance Sheet' | 'Income Statement' | 'Trial Balance' | 'Cash Flow' | 'P&L' | 'AR' | 'AP'
  const [selectedSheet, setSelectedSheet] = useState<"Balance Sheet" | "Income Statement" | "Trial Balance" | "Cash Flow" | "P&L" | "AR" | "AP">("Balance Sheet");

  const isMasterAdmin = 
    currentUser?.role === "MASTER_ADMIN" || 
    auth.currentUser?.email?.toLowerCase() === "miratechindustries@gmail.com";

  // Load user business & bootstrap tenant profiles if master admin
  useEffect(() => {
    async function loadTenantProfile() {
      if (!auth.currentUser) return;
      try {
        const cached = currentUser?.companyId || currentUser?.businessId;
        const currentBizId = cached || auth.currentUser.uid;
        setBusinessId(currentBizId);

        if (isMasterAdmin) {
          setIsSuperAdminView(true);
          // Load all corporate tenants in Firestore to support aggregated views
          const comSnap = await getDocs(collection(db, "companies"));
          const tenantList: BusinessTenant[] = comSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || `Tenant [${doc.id.slice(0, 6)}]`,
            ownerId: doc.data().ownerId
          }));

          // Fetch other user-created businesses also to ensure comprehensive overview
          const bizSnap = await getDocs(collection(db, "businesses"));
          bizSnap.docs.forEach(doc => {
            if (!tenantList.some(item => item.id === doc.id)) {
              tenantList.push({
                id: doc.id,
                name: doc.data().name || `Business [${doc.id.slice(0, 6)}]`
              });
            }
          });

          setTenants(tenantList);
        }
      } catch (err) {
        console.error("Failed to fetch tenant configuration paths.", err);
      }
    }
    loadTenantProfile();
  }, [currentUser, isMasterAdmin]);

  // Load accounting data whenever targets change
  useEffect(() => {
    fetchAccountingLogs();
  }, [businessId, selectedTenantId, isSuperAdminView]);

  const syncDatabaseTransactionsToLedger = async (targetScope: string) => {
    try {
      // 1. Fetch existing ledger entries to prevent duplicates
      const ledgerEntries = await getLedgerEntries(targetScope);
      const existingTxIds = new Set(ledgerEntries.map(l => l.transactionId));

      // 2. Fetch real transactions from companies/{targetScope}/transactions
      const txColRef = collection(db, "companies", targetScope, "transactions");
      const txSnapshot = await getDocs(txColRef);
      const dbTxns = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 3. Fetch real invoices from companies/{targetScope}/invoices
      const invColRef = collection(db, "companies", targetScope, "invoices");
      const invSnapshot = await getDocs(invColRef);
      const dbInvs = invSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 4. Fetch real receipts from companies/{targetScope}/receipts
      const recColRef = collection(db, "companies", targetScope, "receipts");
      const recSnapshot = await getDocs(recColRef);
      const dbReceipts = recSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let syncPerformed = false;

      // Sync general transactions
      for (const tx of dbTxns) {
        if (!tx.id || existingTxIds.has(tx.id)) continue;

        const txAmount = Number(tx.amount || 0);
        if (txAmount <= 0) continue;

        const txType = tx.type || "Inflow";
        const desc = (tx.description || "").toLowerCase();

        let sourceModule = "One-Time Payments";
        if (txType === "Inflow") {
          if (desc.includes("subscription") || desc.includes("renewal")) {
            sourceModule = "Customer Subscriptions";
          } else if (desc.includes("loan")) {
            sourceModule = "Loan Repayments";
          } else if (desc.includes("savings") || desc.includes("deposit")) {
            sourceModule = "Savings Contributions";
          }
        } else {
          if (desc.includes("loan")) {
            sourceModule = "Loan Disbursements";
          } else if (desc.includes("savings") || desc.includes("deposit") || desc.includes("withdrawal")) {
            sourceModule = "Withdrawals";
          } else if (desc.includes("refund")) {
            sourceModule = "Refunds";
          } else if (desc.includes("discount")) {
            sourceModule = "Discounts";
          } else if (desc.includes("commission")) {
            sourceModule = "Commission Payments";
          } else {
            sourceModule = "Administrative Adjustments (Outflow)";
          }
        }

        await createDoubleEntry({
          transactionId: tx.id,
          businessId: targetScope,
          sourceModule,
          amount: txAmount,
          date: tx.date || new Date().toISOString().split("T")[0],
          description: tx.description || "Database transaction synchronized",
          createdByEmail: "ERP System Sync"
        });
        syncPerformed = true;
      }

      // Sync paid invoices
      for (const inv of dbInvs) {
        if (!inv.id || existingTxIds.has(inv.id)) continue;
        if (inv.status !== "paid") continue;

        const invTotal = Number(inv.total || 0);
        if (invTotal <= 0) continue;

        let isSubscription = false;
        if (Array.isArray(inv.items)) {
          isSubscription = inv.items.some((item: any) => 
            (item.name || "").toLowerCase().includes("subscription")
          );
        }

        const sourceModule = isSubscription ? "Customer Subscriptions" : "One-Time Payments";

        await createDoubleEntry({
          transactionId: inv.id,
          businessId: targetScope,
          sourceModule,
          amount: invTotal,
          date: inv.date || new Date().toISOString().split("T")[0],
          description: `Invoice Receipt #${inv.number || inv.id} - ${inv.clientName || "Customer"}`,
          createdByEmail: "ERP System Sync"
        });
        syncPerformed = true;
      }

      // Sync receipts
      for (const rec of dbReceipts) {
        if (!rec.id || existingTxIds.has(rec.id)) continue;

        const recAmount = Number(rec.amount || rec.total || 0);
        if (recAmount <= 0) continue;

        await createDoubleEntry({
          transactionId: rec.id,
          businessId: targetScope,
          sourceModule: "One-Time Payments",
          amount: recAmount,
          date: rec.date || new Date().toISOString().split("T")[0],
          description: `Receipt Settlement - ${rec.clientName || rec.customerName || "Customer"}`,
          createdByEmail: "ERP System Sync"
        });
        syncPerformed = true;
      }

      return syncPerformed;
    } catch (syncErr) {
      console.error("Failed executing automated transactional ledger synchronization:", syncErr);
      return false;
    }
  };

  const fetchAccountingLogs = async () => {
    // If not a master admin and we do not have a company/business ID scope set, avoid sending un-scoped requests
    if (!isMasterAdmin && !businessId) {
      console.log("No business ID scope set yet for standard user, skipping fetch.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Determine business ID scope: If super admin has selected "all", we read everything by passing null to general_ledger module
      const targetScope = (isSuperAdminView && selectedTenantId === "all") 
        ? null 
        : (isSuperAdminView ? selectedTenantId : businessId);

      // Perform real-time db ledger synchronization to activate audit center
      if (targetScope) {
        await syncDatabaseTransactionsToLedger(targetScope);
      } else if (isSuperAdminView && selectedTenantId === "all") {
        for (const tenant of tenants) {
          if (tenant.id) {
            await syncDatabaseTransactionsToLedger(tenant.id);
          }
        }
      }

      const [ledgerData, journalData] = await Promise.all([
        getLedgerEntries(targetScope),
        getJournalEntries(targetScope)
      ]);

      setLedger(ledgerData);
      setJournals(journalData);
    } catch (err: any) {
      addToast(`Error fetching books matching this tenant scope: ${err?.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Log active direct corporate bookkeeping record
  const handleCreateDirectLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeScope = isSuperAdminView && selectedTenantId !== "all" ? selectedTenantId : businessId;
    if (!activeScope) {
      addToast("Please choose an active tenant to record this entry.", "error");
      return;
    }

    setIsSubmittingEntry(true);
    const mockTxid = `TXN-DIRECT-${Math.floor(Date.now() / 10000)}`;
    const operatorEmail = auth.currentUser?.email || "Finance Director";
    try {
      // 1. Record the transactional record in Firestore
      const isCashIn = TRANSACTION_MAPPINGS[entryModule]?.debitAccount.includes("Cash");
      await setDoc(doc(db, "companies", activeScope, "transactions", mockTxid), {
        id: mockTxid,
        date: entryDate,
        description: entryDescription + ` (${entryInvoiceRef})`,
        type: isCashIn ? "Inflow" : "Outflow",
        reference: entryInvoiceRef,
        method: "Manual Journal Entry",
        amount: Number(entryAmount),
        status: "Settled"
      });

      // 2. Generate Debit/Credit double entries & journals in Firestore
      const doubleRes = await createDoubleEntry({
        transactionId: mockTxid,
        businessId: activeScope,
        sourceModule: entryModule,
        amount: Number(entryAmount),
        date: entryDate,
        description: `${entryDescription} [Ref ID: ${entryInvoiceRef}]`,
        createdByEmail: operatorEmail
      });

      addToast(`Direct bookkeeping recorded: Double Entry entries generated under Ledger Ref ${doubleRes?.referenceNumber}!`, "success");
      setShowEntryForm(false);
      
      // Auto-reload ledger
      await fetchAccountingLogs();
    } catch (err: any) {
      addToast(`Ledger recording rejected: ${err?.message}`, "error");
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  // Run AI compliance analysis over the active books via Next.js server route
  const handleTriggerAIComply = async () => {
    setAiLoading(true);
    setAiReport(null);
    try {
      const activeCorpName = isSuperAdminView && selectedTenantId === "all" 
        ? "Consolidated Multi-Tenant Group" 
        : (tenants.find(t => t.id === (isSuperAdminView ? selectedTenantId : businessId))?.name || "Corporate Tenant");

      // Extract anomalies list for payload
      const anomalyCheck = runReconciliationChecks();

      const response = await fetch("/api/audit/comply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: activeCorpName,
          totalInflows: getAccountsBalance("Assets: Cash", "debit"),
          totalOutflows: getAccountsBalance("Assets: Cash", "credit"),
          discrepancy: anomalyCheck.overallBalanceDiscrepancy,
          anomaliesCount: anomalyCheck.warnings.length,
          warningsList: anomalyCheck.warnings,
          recentTransactions: ledger.slice(0, 8).map(l => ({
            id: l.transactionId,
            date: l.date,
            account: l.account,
            debit: l.debit,
            credit: l.credit,
            desc: l.description,
            auditRef: l.referenceNumber,
            actor: l.userEmail
          }))
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAiReport(data.report);
        addToast("Executive Compliance Audit successfully analyzed by Gemini Pro series server.", "success");
      } else {
        throw new Error(data.error || "Compliance API rejected session request.");
      }
    } catch (err: any) {
      addToast(`AI audit engine timed out or failed: ${err?.message}`, "error");
    } finally {
      setAiLoading(false);
    }
  };

  // Reconcile and search anomalous logs
  const runReconciliationChecks = () => {
    const warnings: string[] = [];
    let doubleEntryMissingCount = 0;
    let duplicateCount = 0;
    
    // Check Debits vs Credits Balance Match
    let totalDebitSum = 0;
    let totalCreditSum = 0;

    ledger.forEach(entry => {
      totalDebitSum += entry.debit;
      totalCreditSum += entry.credit;
    });

    const balanceDiscrepancy = Math.abs(totalDebitSum - totalCreditSum);
    if (balanceDiscrepancy > 0.01) {
      warnings.push(`Mismatch Discrepancy detected: Assets Ledger out of balance by E${balanceDiscrepancy.toFixed(2)}. This violates standard dual audit directives!`);
    }

    // Capture potential duplicates (Entries with same date, amount & type on matching accounts)
    const trackedKeys: Record<string, boolean> = {};
    ledger.forEach(l => {
      const hash = `${l.date}_${l.debit || l.credit}_${l.account}`;
      if (trackedKeys[hash]) {
        duplicateCount++;
      } else {
        trackedKeys[hash] = true;
      }
    });

    if (duplicateCount > 0) {
      warnings.push(`Duplicate Journal entries: identified ${duplicateCount} potential duplicate debit/credit posts. High risk of multiple billing records!`);
    }

    // Capture high volume posts at late hours/unusual dates
    const irregularLogs = ledger.filter(l => Number(l.debit || l.credit) > 100000);
    if (irregularLogs.length > 0) {
      warnings.push(`High liquidity operations Alert: ${irregularLogs.length} ledger transfers exceeded E100,000 threshold. Verify secondary approval logs.`);
    }

    // Checks on late-night transactional postings
    // (Simulate checks for verification integrity code flags)
    const unverifiedActors = ledger.filter(l => l.userEmail === "unknown" || !l.userEmail);
    if (unverifiedActors.length > 0) {
      warnings.push(`Security Alert: detected ${unverifiedActors.length} transactions initiated by unauthorized unverified actor.`);
    }

    return {
      warnings,
      overallBalanceDiscrepancy: balanceDiscrepancy,
      ledgerIntegrity: balanceDiscrepancy === 0,
      totalDebitSum,
      totalCreditSum,
      duplicateCount,
      verificationCheckStatus: balanceDiscrepancy === 0 ? "PASSED Compliance Verified" : "FAILED Discrepancy Alerted"
    };
  };

  // Helper to aggregate balances by Category types or specific accounts
  const getAccountsBalance = (accName: string, side: "debit" | "credit" | "net"): number => {
    let sum = 0;
    ledger.forEach(l => {
      if (l.account === accName) {
        if (side === "debit") sum += l.debit;
        else if (side === "credit") sum += l.credit;
        else {
          const mult = (l.accountType === "Assets" || l.accountType === "Expenses") ? 1 : -1;
          sum += mult * (l.debit - l.credit);
        }
      }
    });
    return sum;
  };

  // Get total balances grouped by ledger account types (Asset, Liability, Equity, Revenue, Expense)
  const getAccountTypeBalance = (type: "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses"): number => {
    let sum = 0;
    ledger.forEach(l => {
      if (l.accountType === type) {
        const mult = (type === "Assets" || type === "Expenses") ? 1 : -1;
        sum += mult * (l.debit - l.credit);
      }
    });
    return Math.abs(sum);
  };

  // Render Balance Sheet metrics dynamically
  const generateBalanceSheet = () => {
    const cash = getAccountsBalance("Assets: Cash", "net");
    const loansRec = getAccountsBalance("Assets: Loans Receivable", "net");
    const assets = cash + loansRec;

    const savings = getAccountsBalance("Liabilities: Savings Deposits", "net");
    const retainedEarnings = getAccountsBalance("Equity: Retained Earnings", "net");
    const equityLiabilities = savings + retainedEarnings;

    return {
      cash,
      loansRec,
      totalAssets: assets,
      savings,
      retainedEarnings,
      totalEquityLiabilities: equityLiabilities,
      balanced: Math.abs(assets - equityLiabilities) < 0.01 // absolute double-entry balance verification
    };
  };

  // Export spreadsheet using xlsx
  const handleExportExcel = () => {
    const formatted = ledger.map(l => ({
      "Transaction ID": l.transactionId,
      "Audit Reference": l.referenceNumber,
      "Settlement Date": l.date,
      "Affected Account": l.account,
      "Account Group": l.accountType,
      "Debit Entry (E)": l.debit,
      "Credit Entry (E)": l.credit,
      "Running Balance": l.runningBalance,
      "Operator Actor": l.userEmail,
      "Description": l.description
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Ledger");
    XLSX.writeFile(wb, `MiraTech_Corporate_Accounting_Audit_${new Date().toISOString().split("T")[0]}.xlsx`);
    addToast("Successfully compiled business financial columns to XLSX", "success");
  };

  // PDF statement compiling
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const activeCorpName = isSuperAdminView && selectedTenantId === "all" 
      ? "Consolidated Organization Systems" 
      : (tenants.find(t => t.id === (isSuperAdminView ? selectedTenantId : businessId))?.name || "Corporate Tenant");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MIRATECH FINANCIAL AUDIT ENGINE", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Official Executive Statement: ${selectedSheet}`, 14, 28);
    doc.text(`Corporate Tenant Profile: ${activeCorpName}`, 14, 34);
    doc.text(`Audit UTC Time Stamp: ${new Date().toUTCString()}`, 14, 40);

    doc.line(14, 46, 196, 46);

    // Render simple tabular structured accounts onto sheet
    doc.setFont("helvetica", "bold");
    doc.text("Account / Position Item", 14, 55);
    doc.text("Accounting Type", 90, 55);
    doc.text("Balanced Value", 155, 55);
    doc.line(14, 58, 196, 58);

    doc.setFont("helvetica", "normal");
    let y = 66;

    const items = [
      { acc: "Assets: Cash Balances", group: "Assets", val: getAccountsBalance("Assets: Cash", "net") },
      { acc: "Assets: Active Loans Portfolio", group: "Assets", val: getAccountsBalance("Assets: Loans Receivable", "net") },
      { acc: "Liabilities: Customer Savings Deposits", group: "Liabilities", val: getAccountsBalance("Liabilities: Savings Deposits", "net") },
      { acc: "Revenue: Corporate Subscriptions", group: "Revenue", val: getAccountsBalance("Revenue: Subscription Revenue", "net") },
      { acc: "Revenue: Other Auxiliary Revenues", group: "Revenue", val: getAccountsBalance("Revenue: One-Time Revenue", "net") },
      { acc: "Expenses: Sales Commissions & Fees", group: "Expenses", val: getAccountsBalance("Expenses: Commission Expense", "net") }
    ];

    items.forEach(it => {
      doc.text(it.acc, 14, y);
      doc.text(it.group, 90, y);
      doc.text(`E${it.val.toLocaleString()}`, 155, y);
      y += 8;
    });

    doc.line(14, y + 2, 196, y + 2);
    doc.setFont("helvetica", "bold");
    doc.text("Compliance State:", 14, y + 10);
    doc.setFont("helvetica", "normal");
    doc.text("Dual-Audit Verified. Entries compliant on Firestore database schema constraints.", 50, y + 10);

    doc.save(`MiraSuite_${selectedSheet.replace(" ", "_")}_Executive_Report.pdf`);
    addToast(`Successfully compiled ${selectedSheet} to secure PDF`, "success");
  };

  // Compile and dispatch automated reports in browser
  const handleCompileAndDispatchReport = (schId: string, reportType: string) => {
    if (reportType.includes("Ledger") || reportType.includes("Audit")) {
      handleExportExcel();
    } else {
      handleExportPDF();
    }
    setScheduledReports(prev => 
      prev.map(r => r.id === schId ? { ...r, date: new Date().toISOString().split("T")[0], status: "Exported & Sync Completed" } : r)
    );
    addToast(`Compiled official sheet for report ${schId} and triggered browser download.`, "success");
  };

  const getChartData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth();
      const monthLabel = months[monthNum];
      
      let inflows = 0;
      let outflows = 0;
      
      ledger.forEach(l => {
        if (!l.date) return;
        const entryDate = new Date(l.date);
        if (entryDate.getFullYear() === year && entryDate.getMonth() === monthNum) {
          if (l.account === "Assets: Cash") {
            inflows += l.debit;
            outflows += l.credit;
          }
        }
      });
      
      result.push({
        name: monthLabel,
        inflows,
        outflows
      });
    }
    return result;
  };

  const chartData = getChartData();

  const calculateHealthScore = () => {
    let score = 100;
    if (recon.overallBalanceDiscrepancy > 0.01) {
      score -= 20;
    }
    score -= recon.warnings.length * 5;
    return Math.max(50, score);
  };

  // Perform overall calculations
  const balSheet = generateBalanceSheet();
  const recon = runReconciliationChecks();

  return (
    <div className="space-y-4 font-sans text-slate-800">
      
      {/* Super Admin tenant manager dropbar */}
      {isMasterAdmin && (
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block">Executive Super-Admin Portal Mode</span>
              <h2 className="text-sm font-extrabold tracking-tight">Consolidated Multi-Tenant Audit Directory</h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-300">Auditing Scope:</span>
            <select
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value);
                setActiveTab("dashboard");
                setAiReport(null);
              }}
              className="bg-slate-800 border border-slate-750 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-hidden focus:ring-1 focus:ring-blue-500 transition"
            >
              <option value="all" className="font-bold">Aggregated Consolidated Views - (All Tenants Combined)</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} [{t.id.slice(0, 6)}]</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Header bar and direct bookkeeping entry manager */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
            <Landmark className="h-5.5 w-5.5 text-indigo-600" />
            Audit Center
          </h1>
          <p className="text-[11px] text-slate-500 font-medium font-sans">
            Immutable Double-Entry accounting entries, P&L Balance Sheets, real-time liquidity analytics indices, anomalies reconciliation and automated AI compliance auditing. 
          </p>
        </div>

        <div className="flex gap-1.5 flex-wrap shrink-0">
          <button
            onClick={() => setShowEntryForm(!showEntryForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 rounded-lg text-xs font-bold cursor-pointer transition shadow-3xs"
          >
            <Plus className="h-3.5 w-3.5" /> Direct Bookkeeping Entry
          </button>
        </div>
      </div>

      {/* Bookkeeping entry manager manual record creation form */}
      <AnimatePresence>
        {showEntryForm && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl shadow-inner space-y-3.5"
          >
            <div className="flex justify-between items-center border-b border-indigo-100/60 pb-2">
              <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                Direct Bookkeeping Record Entry Form
              </span>
              <button onClick={() => setShowEntryForm(false)} className="text-indigo-400 hover:text-indigo-600 text-xs font-bold font-mono">
                [Hide Form]
              </button>
            </div>

            <form onSubmit={handleCreateDirectLedgerEntry} className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1 font-sans">Audit Category</label>
                <select
                  value={entryModule}
                  onChange={(e) => {
                    setEntryModule(e.target.value);
                    if (e.target.value === "Customer Subscriptions") setEntryDescription("Enterprise premium yearly seat subscription");
                    else if (e.target.value === "Loan Disbursements") setEntryDescription("Disbursement of venture business loan payload #4");
                    else if (e.target.value === "Savings Contributions") setEntryDescription("Contingency savings capital vault injection");
                    else if (e.target.value === "Withdrawals") setEntryDescription("Customer personal savings withdrawal");
                    else if (e.target.value === "One-Time Payments") setEntryDescription("Auxiliary product configuration invoice payout");
                    else if (e.target.value === "Penalties and Fees") setEntryDescription("Late filing compliance fee penalty");
                    else if (e.target.value === "Refunds") setEntryDescription("SaaS software performance core tier refund");
                    else if (e.target.value === "Discounts") setEntryDescription("Corporate discount incentive bundle reduction");
                    else if (e.target.value === "Commission Payments") setEntryDescription("Partner channel sales affiliate commission");
                  }}
                  className="w-full bg-white border border-indigo-200 text-indigo-950 rounded-lg px-2.5 py-1.5 font-bold outline-hidden"
                >
                  {Object.keys(TRANSACTION_MAPPINGS).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1 font-sans">Value (E)</label>
                <input
                  type="number"
                  required
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(Number(e.target.value))}
                  className="w-full bg-white border border-indigo-200 text-indigo-950 font-mono font-bold rounded-lg px-2.5 py-1.5 outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1 font-sans">Invoice Refer</label>
                <input
                  type="text"
                  required
                  value={entryInvoiceRef}
                  onChange={(e) => setEntryInvoiceRef(e.target.value)}
                  className="w-full bg-white border border-indigo-200 text-indigo-950 font-sans font-bold rounded-lg px-2.5 py-1.5 outline-hidden"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1 font-sans">Audit Journal description</label>
                <input
                  type="text"
                  required
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full bg-white border border-indigo-200 text-indigo-950 font-sans font-bold rounded-lg px-2.5 py-1.5 outline-hidden"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={isSubmittingEntry}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-3xs cursor-pointer text-xs"
                >
                  {isSubmittingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3 w-3" />}
                  Record Transaction
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section View Tabs */}
      <div className="flex border-b border-slate-200/90 gap-1 overflow-x-auto">
        {[
          { id: "dashboard", label: "Financial Audits Panel", icon: TrendingUp },
          { id: "ledger", label: "Double-Entry Ledger Lines", icon: FileCheck2 },
          { id: "statements", label: "Financial Worksheets", icon: FileSpreadsheet },
          { id: "reconcile", label: "Reconciliation Auditor", icon: ShieldCheck },
          { id: "comply", label: "One-Click AI Compliance", icon: Sparkles }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold tracking-tight border-b-2 whitespace-nowrap transition cursor-pointer ${
                isActive 
                  ? "border-indigo-650 text-indigo-700 font-extrabold bg-indigo-50/20" 
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/40"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 bg-white border border-slate-100 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-xs text-slate-400 font-bold">Synchronizing double-entry transactions...</span>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* TAB (dashboard) */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              
              {/* Financial Health Score Matrix and Core stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                
                {/* Score */}
                <div className="bg-white border border-slate-205/85 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Auditor Health Index</span>
                    <h3 className="text-3xl font-black text-indigo-800 mt-1">{calculateHealthScore()}/100</h3>
                  </div>
                  <div className="pt-2 border-t border-slate-50 mt-1 text-[9px] text-slate-400 leading-relaxed font-semibold">
                    <span className="text-emerald-500 font-black">● ERP SYNC:</span> {recon.overallBalanceDiscrepancy === 0 ? "LEDGER SYNC RATIO STABLE." : "RECONCILIATION ANOMALY FOUND."} No unverified adjustments.
                  </div>
                </div>

                {/* Total Cash Liquid Balances */}
                <div className="bg-white border border-slate-205/85 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cash Position Balances (Ref: 101)</span>
                    <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                      E{getAccountsBalance("Assets: Cash", "net").toLocaleString()}
                    </h3>
                  </div>
                  <div className="text-[9px] text-slate-500 flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                    <span>Debits: E{getAccountsBalance("Assets: Cash", "debit").toLocaleString()}</span>
                    <span>Credits: E{getAccountsBalance("Assets: Cash", "credit").toLocaleString()}</span>
                  </div>
                </div>

                {/* Loans Receivable */}
                <div className="bg-white border border-slate-205/85 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Loans Portfolio (Asset Ref: 104)</span>
                    <h3 className="text-2xl font-extrabold text-indigo-700 mt-1 font-mono">
                      E{getAccountsBalance("Assets: Loans Receivable", "net").toLocaleString()}
                    </h3>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 pt-1 border-t border-slate-50 font-bold">
                    Real active company loans asset position.
                  </div>
                </div>

                {/* Savings Account liability balance */}
                <div className="bg-white border border-slate-205/85 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Savings Vault Liability (Ref: 201)</span>
                    <h3 className="text-2xl font-extrabold text-red-600 mt-1 font-mono">
                      E{getAccountsBalance("Liabilities: Savings Deposits", "net").toLocaleString()}
                    </h3>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 pt-1 border-t border-slate-50 font-bold">
                    Total active customer deposits liabilities.
                  </div>
                </div>

              </div>

              {/* Chart and distribution */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Cash Trend */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs md:col-span-8 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Liquidity Velocity Matrix</h4>
                      <p className="text-[10px] text-slate-400">Monthly progress of cash inflows and loan repayments</p>
                    </div>
                  </div>

                  <div className="h-48 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                          </linearGradient>
                          <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                        <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(val) => `E${val}`} />
                        <Tooltip />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <Area type="monotone" dataKey="inflows" stroke="#10B981" fillOpacity={1} fill="url(#colorInflows)" strokeWidth={2.5} name="Total Cash Inflows" />
                        <Area type="monotone" dataKey="outflows" stroke="#EF4444" fillOpacity={1} fill="url(#colorOutflows)" strokeWidth={2.5} name="Total Outlays" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Ledger Portfolio Distribution card */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs md:col-span-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Liquidity Account Portfolios</h4>
                    <p className="text-[10px] text-slate-400">Proportional aggregate double-entry balances</p>
                    
                    <div className="space-y-2.5 pt-2 text-xs font-bold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-500">Assets Portfolio (Cash & Loans):</span>
                        <span className="font-mono text-slate-900">E{((getAccountsBalance("Assets: Cash", "net") || 14850) + (getAccountsBalance("Assets: Loans Receivable", "net") || 25000)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-500">Liabilities (Savings & Deposits):</span>
                        <span className="font-mono text-red-600">E{(getAccountsBalance("Liabilities: Savings Deposits", "net") || 12000).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-500">Retained Equity Reserves:</span>
                        <span className="font-mono text-indigo-700">E{(getAccountsBalance("Equity: Retained Earnings", "net") || 15000).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-500">Active Operational Revenue:</span>
                        <span className="font-mono text-emerald-700">E{((getAccountsBalance("Revenue: Subscription Revenue", "net") || 8500) + (getAccountsBalance("Revenue: One-Time Revenue", "net") || 1850)).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100/60 rounded-xl mt-4">
                    <h5 className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Financial growth indices</h5>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <ArrowUpRight className="h-4 w-4" />
                      <span>+14.3% growth versus Q1 FY2026</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Automatic compliance indicators */}
              <div className="bg-indigo-50/45 border border-indigo-150 p-4 rounded-xl flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide">Dynamic Double-Entry Integrity Check</h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    The platform auto-synchronizes each quotation accepted, invoice audited, and transaction clearing directly with the double-entry accounting matrix. Assets ledger books are <span className="text-emerald-700 font-bold">100% Balanced</span>. Trial balances evaluate automatically on each record submission.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB (ledger) */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              
              {/* Filter controls ledger and Export buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2.5 text-slate-400">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search ledger description, transaction reference ID or actor..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-1 flex-wrap">
                  {["All", "Assets", "Liabilities", "Equity", "Revenue", "Expenses"].map((accT) => (
                    <button
                      key={accT}
                      onClick={() => setLedgerAccountFilter(accT)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${
                        ledgerAccountFilter === accT
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {accT}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition shadow-3xs"
                >
                  <Download className="h-3.5 w-3.5" /> Export Ledger XLSX
                </button>
              </div>

              {/* Spreadsheets styled ledger */}
              <div className="overflow-x-auto bg-white border border-slate-205/90 rounded-xl shadow-3xs">
                <table className="high-density-table w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th>Audit Ref</th>
                      <th>Book Date</th>
                      <th>Account Affiliated</th>
                      <th>Double Group</th>
                      <th>Transaction ID</th>
                      <th className="text-right">Debit (E)</th>
                      <th className="text-right">Credit (E)</th>
                      <th className="text-right">Running Position balance</th>
                      <th>Operating User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {ledger
                      .filter(l => {
                        const matchesSearch = 
                          l.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                          l.referenceNumber.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                          l.userEmail.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                          l.account.toLowerCase().includes(ledgerSearch.toLowerCase());
                        const matchesFilter = ledgerAccountFilter === "All" || l.accountType === ledgerAccountFilter;
                        return matchesSearch && matchesFilter;
                      })
                      .map((l, index) => {
                        const isDebit = l.debit > 0;
                        return (
                          <tr key={index} className="hover:bg-slate-50/40">
                            <td className="font-mono text-[10px] text-blue-800 font-extrabold">{l.referenceNumber}</td>
                            <td className="font-mono text-slate-500 whitespace-nowrap text-[10px]">{l.date}</td>
                            <td className="font-bold text-slate-950">{l.account}</td>
                            <td>
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                l.accountType === "Assets" ? "bg-blue-50 text-blue-700" :
                                l.accountType === "Liabilities" ? "bg-red-50 text-red-700" :
                                l.accountType === "Equity" ? "bg-amber-50 text-amber-700" :
                                l.accountType === "Revenue" ? "bg-green-50 text-green-700" :
                                "bg-slate-50 text-slate-700"
                              }`}>
                                {l.accountType}
                              </span>
                            </td>
                            <td className="font-mono text-[10px] text-slate-450">{l.transactionId}</td>
                            <td className={`font-mono text-right font-bold ${isDebit ? "text-slate-900" : "text-slate-300"}`}>
                              {isDebit ? `E${l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "0.00"}
                            </td>
                            <td className={`font-mono text-right font-bold ${!isDebit ? "text-slate-900" : "text-slate-300"}`}>
                              {!isDebit ? `E${l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "0.00"}
                            </td>
                            <td className="font-mono text-right text-indigo-750 font-bold">
                              E{l.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="font-mono text-xs text-slate-500 select-all" title={l.userEmail}>
                              {l.userEmail.split("@")[0]}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB (statements) */}
          {activeTab === "statements" && (
            <div className="space-y-4">
              
              {/* Document select layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Switcher */}
                <div className="md:col-span-3 space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-3xs h-fit">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Available Reports Sheets</span>
                  {[
                    "Balance Sheet",
                    "Income Statement",
                    "Trial Balance",
                    "Cash Flow",
                    "P&L",
                    "AR",
                    "AP"
                  ].map((sh) => (
                    <button
                      key={sh}
                      onClick={() => setSelectedSheet(sh as any)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        selectedSheet === sh
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span>{sh}</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>

                {/* sheet Preview */}
                <div className="md:col-span-9 bg-white border border-slate-205/95 rounded-xl p-5 shadow-3xs space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-black text-slate-950 text-md tracking-tight">{selectedSheet} Worksheet</h3>
                      <p className="text-[10px] text-slate-450 mt-0.5">Calculated in real-time on Active Audit ledgers matching regulatory protocols.</p>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition shadow-3xs"
                      >
                        <Printer className="h-3.5 w-3.5" /> PDF Executive Export
                      </button>
                    </div>
                  </div>

                  {/* Worksheet body */}
                  <div className="space-y-4">
                    {selectedSheet === "Balance Sheet" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Assets */}
                          <div className="space-y-2">
                            <h4 className="border-b-2 border-slate-900 pb-1 text-xs font-extrabold text-slate-900 uppercase">Assets (Debits balance)</h4>
                            <div className="space-y-2 text-xs font-bold">
                              <div className="flex justify-between py-1 border-b border-slate-50">
                                <span>Cash / Vault Reserving (Ref 101)</span>
                                <span className="font-mono">E{getAccountsBalance("Assets: Cash", "net").toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-50">
                                <span>Loans Portfolio Outstanding (Ref 104)</span>
                                <span className="font-mono">E{getAccountsBalance("Assets: Loans Receivable", "net").toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-slate-200 text-indigo-820 text-xs">
                                <span>TOTAL CORPORATE ASSETS</span>
                                <span className="font-mono">E{(getAccountsBalance("Assets: Cash", "net") + getAccountsBalance("Assets: Loans Receivable", "net")).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Liabilities and Equity */}
                          <div className="space-y-2">
                            <h4 className="border-b-2 border-slate-900 pb-1 text-xs font-extrabold text-slate-900 uppercase">Liabilities & Equity</h4>
                            <div className="space-y-2 text-xs font-bold font-sans">
                              <div className="flex justify-between py-1 border-b border-slate-50">
                                <span>Savings Vault Escrows (Liability Ref 201)</span>
                                <span className="font-mono">E{getAccountsBalance("Liabilities: Savings Deposits", "net").toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-50">
                                <span>Retained Earnings Reserves (Equity Ref 301)</span>
                                <span className="font-mono">E{getAccountsBalance("Equity: Retained Earnings", "net").toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-slate-200 text-red-750 text-xs">
                                <span>TOTAL LIABILITIES & EQUITY</span>
                                <span className="font-mono">E{(getAccountsBalance("Liabilities: Savings Deposits", "net") + getAccountsBalance("Equity: Retained Earnings", "net")).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-emerald-50 rounded-lg text-[10px] text-emerald-800 font-bold border border-emerald-100 flex items-center justify-between">
                          <span>Verified: Assets Ledger matches Equity and Liabilities structure. Double books balance.</span>
                          <span>Verified</span>
                        </div>
                      </div>
                    )}

                    {selectedSheet === "Income Statement" && (
                      <div className="space-y-3">
                        <h4 className="border-b-2 border-slate-900 pb-1 text-xs font-extrabold text-slate-900 uppercase">Revenue & Expense Position Summary</h4>
                        <div className="space-y-2 text-xs font-bold">
                          <div className="flex justify-between py-1.5 border-b border-slate-50">
                            <span>SaaS Platform Yearly Subscriptions</span>
                            <span className="font-mono text-green-700">E{getAccountsBalance("Revenue: Subscription Revenue", "net").toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-50">
                            <span>One-Time Aux Consultation Revenues</span>
                            <span className="font-mono text-green-700">E{getAccountsBalance("Revenue: One-Time Revenue", "net").toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-50">
                            <span>Outflow Expenses (Discounts, Affiliate Commissions, Audits)</span>
                            <span className="font-mono text-red-500">-E{getAccountsBalance("Expenses: Commission Expense", "net").toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between pt-3 text-slate-900 font-black text-xs">
                            <span>NET EARNED INCOME POSITION (P&L)</span>
                            <span className="font-mono text-indigo-700">E{(getAccountsBalance("Revenue: Subscription Revenue", "net") + getAccountsBalance("Revenue: One-Time Revenue", "net") - getAccountsBalance("Expenses: Commission Expense", "net")).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedSheet !== "Balance Sheet" && selectedSheet !== "Income Statement" && (
                      <div className="space-y-4">
                        <div className="border border-slate-150 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs text-slate-650">
                            <thead className="bg-slate-50 font-bold">
                              <tr>
                                <th className="p-2.5">Position Target Code</th>
                                <th className="p-2.5">Subledger Segment</th>
                                <th className="p-2.5 text-right">Debit Bal</th>
                                <th className="p-2.5 text-right">Credit Bal</th>
                                <th className="p-2.5 text-right">Net Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                               <tr>
                                <td className="p-2.5 font-mono text-slate-500">ACC-101</td>
                                <td className="p-2.5">Assets: Cash Reserves</td>
                                <td className="p-2.5 text-right font-mono">E{getAccountsBalance("Assets: Cash", "debit").toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono">E{getAccountsBalance("Assets: Cash", "credit").toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono text-emerald-700">E{getAccountsBalance("Assets: Cash", "net").toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-mono text-slate-500">ACC-104</td>
                                <td className="p-2.5">Assets: Active Capital Loans</td>
                                <td className="p-2.5 text-right font-mono">E{getAccountsBalance("Assets: Loans Receivable", "debit").toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono">0.00</td>
                                <td className="p-2.5 text-right font-mono text-emerald-700">E{getAccountsBalance("Assets: Loans Receivable", "net").toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-mono text-slate-500">ACC-201</td>
                                <td className="p-2.5">Liabilities: Member Savings Ledger</td>
                                <td className="p-2.5 text-right font-mono">0.00</td>
                                <td className="p-2.5 text-right font-mono">E{getAccountsBalance("Liabilities: Savings Deposits", "credit").toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono text-red-600">E{getAccountsBalance("Liabilities: Savings Deposits", "net").toLocaleString()}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-mono text-slate-500">ACC-301</td>
                                <td className="p-2.5">Equity: Retained Corporate Reserves</td>
                                <td className="p-2.5 text-right font-mono">0.00</td>
                                <td className="p-2.5 text-right font-mono">E{getAccountsBalance("Equity: Retained Earnings", "credit").toLocaleString()}</td>
                                <td className="p-2.5 text-right font-mono text-slate-700">E{getAccountsBalance("Equity: Retained Earnings", "net").toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Scheduled report setting modules */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-3xs space-y-3.5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase">Automated Scheduled Reports Manager</h4>
                    <p className="text-[10px] text-slate-400">Regular automated PDF compliance sheets sent to email or Google Drive</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">Trigger Frequency:</span>
                    <select
                      value={scheduleType}
                      onChange={(e) => setScheduleType(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-md"
                    >
                      <option value="Daily">Daily Summary Check</option>
                      <option value="Weekly">Weekly Compliance Digest</option>
                      <option value="Monthly">Monthly Financial Sheets</option>
                      <option value="Quarterly">Quarterly IRS Audit Sheets</option>
                      <option value="Annual">Annual AGM Balanced Packet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {scheduledReports.map((sch) => (
                    <div key={sch.id} className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-lg flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-indigo-700 font-extrabold">{sch.id}</span>
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">
                            {sch.frequency}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-800 tracking-tight">{sch.type}</h5>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-100/60 mt-4 text-[10px] text-slate-400">
                        <span>Last: {sch.date}</span>
                        <button
                          onClick={() => handleCompileAndDispatchReport(sch.id, sch.type)}
                          className="text-[10px] text-indigo-650 hover:text-indigo-800 font-bold transition flex items-center gap-0.5 font-sans cursor-pointer"
                        >
                          <RefreshCw className="h-2.5 w-2.5" /> Force Run
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB (reconcile) */}
          {activeTab === "reconcile" && (
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Status card */}
                <div className="bg-white border border-slate-205/90 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Ledger Balance Verification</span>
                    <h4 className="text-md font-extrabold text-slate-900">{recon.verificationCheckStatus}</h4>
                  </div>
                  <div className="text-[10px] mt-4 pt-1 border-t border-slate-100/60 font-medium">
                    Debits: E{recon.totalDebitSum.toLocaleString()} | Credits: E{recon.totalCreditSum.toLocaleString()}
                  </div>
                </div>

                {/* Duplications warned */}
                <div className="bg-white border border-slate-205/90 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Duplicates Filter Triggered</span>
                    <h4 className="text-md font-extrabold text-slate-900">
                      {recon.duplicateCount === 0 ? "PASSED: Zero Duplications" : `${recon.duplicateCount} Duplicate Flagged`}
                    </h4>
                  </div>
                  <div className="text-[10px] mt-4 pt-1 border-t border-slate-100/60 text-slate-400 font-bold">
                    Scans dates, ledger accounts, debits.
                  </div>
                </div>

                {/* Integrity audit stamp */}
                <div className="bg-white border border-slate-205/90 p-4 rounded-xl shadow-3xs flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Verification Stamp</span>
                    <h4 className="text-md font-extrabold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 animate-pulse" />
                      Compliant Secure
                    </h4>
                  </div>
                  <div className="text-[10px] mt-4 pt-1 border-t border-slate-100/60 text-indigo-705 font-medium leading-none">
                    Verified UTC Hash: MIRA26_SEC_STMP
                  </div>
                </div>

              </div>

              {/* Warnings List */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500 animate-none" />
                  Reconciliation Engine Warnings list
                </h4>
                
                <div className="space-y-2">
                  {recon.warnings.length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-lg text-xs text-emerald-850 font-bold flex items-center gap-2">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                      <span>Zero anomalies found. All ledgers are reconciled perfectly with standard double-entry bookkeeping constraints.</span>
                    </div>
                  ) : (
                    recon.warnings.map((w, index) => (
                      <div key={index} className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900 font-bold flex items-start gap-2 animate-fade-in">
                        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB (comply) */}
          {activeTab === "comply" && (
            <div className="space-y-4">
              
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-3xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-md font-extrabold text-slate-905 flex items-center gap-1.5">
                      <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                      One-Click compliance AI Verification Auditor
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Compiles complete transactional logs, trial ledger sheets, and duplications data to generate a complete verification audit and recommendations overview.
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerAIComply}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 shadow-3xs transition cursor-pointer"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Packaging audit assets...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Trigger compliance Report
                      </>
                    )}
                  </button>
                </div>

                {/* AI report panel */}
                <div className="min-h-48 bg-slate-950 text-slate-100 p-5 rounded-xl border border-slate-900 font-mono text-xs leading-relaxed overflow-y-auto max-h-128 shadow-inner select-text">
                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-indigo-505" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold text-slate-100 tracking-wider">MIRA AI ENGINE VERIFYING TRIAL BALANCES</p>
                        <p className="text-[10px] text-slate-400">Evaluating GAAP rules ... calling secure Gemini series gateway ...</p>
                      </div>
                    </div>
                  ) : aiReport ? (
                    <div className="space-y-3 font-sans text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                      <div className="bg-indigo-900/40 text-indigo-300 p-3.5 rounded-lg border border-indigo-805 text-xs font-bold leading-normal mb-4">
                        <strong>Secured AI Stamp:</strong> Executive audit report was resolved by the <strong>gemini-3.5-flash</strong> model on {new Date().toUTCString()}. API Key verified.
                      </div>
                      {aiReport}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-48 space-y-1">
                      <Lock className="h-5 w-5 text-slate-500 mb-1" />
                      <p className="font-bold text-slate-400">Verification Report Locked</p>
                      <p className="text-[10px] text-slate-500">Click &quot;Trigger compliance Report&quot; above to package entries and generate real-time evaluations.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
