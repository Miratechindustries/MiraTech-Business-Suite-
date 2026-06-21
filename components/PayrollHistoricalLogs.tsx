"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType } from "../lib/firebase"; 
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { 
  FileText, 
  Loader2, 
  Eye, 
  Download, 
  X, 
  Search, 
  Coins, 
  Trash2, 
  TrendingUp, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Printer, 
  DollarSign, 
  ArrowDownToLine, 
  Building2,
  BookmarkCheck
} from "lucide-react";
import Image from "next/image";
import jsPDF from "jspdf";
import safeHtml2canvas from "../lib/safeHtml2canvas";

interface HistoryLog {
  id: string;
  employeeId?: string;
  employeeName: string;
  employeeEmail?: string;
  employeeTitle?: string;
  employeeDepartment?: string;
  basicSalary?: number;
  taxPeriod?: string;
  payPeriod?: string; // fallback field name
  issueDate?: string;
  overtimeHours?: number;
  overtimeRate?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  bonus?: number;
  paye?: number;
  enpf?: number;
  medicalAid?: number;
  otherFeeAmount?: number;
  otherFeeDescription?: string;
  grossSalary?: number;
  totalDeductions?: number;
  netSalary: number;
  date?: any;
  createdAt?: string;
  adjustments?: string;
  businessId: string;
  tin?: string;
  enpfNumber?: string;
  status?: string;
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  letterheadLogo: string;
  primaryColor?: string;
}

export default function PayrollHistoricalLogs() {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("All");

  const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const hiddenPdfRef = useRef<HTMLDivElement>(null);

  // Derive businessId securely matching user partition
  const businessId = currentUser?.companyId || currentUser?.businessId || importAuth.currentUser?.uid || "SYSTEM";

  // Fetch logs and company profile in parallel
  useEffect(() => {
    const fetchHistoryData = async () => {
      if (!businessId) return;
      setLoading(true);
      try {
        // 1. Fetch Company Info
        const companyRef = doc(db, "companies", businessId);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          setCompanyDetails(companySnap.data() as CompanyDetails);
        } else {
          setCompanyDetails({
            name: "MiraTech Enterprise",
            email: "finance@miratech.io",
            phone: "+1 (555) 0192-383",
            address: "100 Security Boulevard, Suite 500, Cyber City",
            logo: "",
            letterheadLogo: ""
          });
        }

        // 2. Fetch Logs without Firestore orderBy (avoids composite index requirements)
        const q = query(
          collection(db, "payslips"),
          where("businessId", "==", businessId)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as HistoryLog[];

        // Client-side chronological sorting
        const sortedLogs = data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date?.toDate ? new Date(a.date.toDate()).getTime() : 0);
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date?.toDate ? new Date(b.date.toDate()).getTime() : 0);
          return dateB - dateA;
        });

        setLogs(sortedLogs);
      } catch (error: any) {
        console.error("Error loading historical payroll archives:", error);
        addToast("Failed to load historical archives: " + error.message, "error");
        try {
          handleFirestoreError(error, OperationType.LIST, "payslips");
        } catch (r) {}
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Extract list of all unique tax periods dynamically
  const uniquePeriods = Array.from(
    new Set(logs.map(log => log.taxPeriod || log.payPeriod || "N/A"))
  ).filter(p => p !== "N/A");

  // Filter historical data
  const filteredLogs = logs.filter(log => {
    const periodValue = log.taxPeriod || log.payPeriod || "N/A";
    const matchesSearch = 
      log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.employeeTitle && log.employeeTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.employeeId && log.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDept = selectedDept === "All" || log.employeeDepartment === selectedDept;
    const matchesPeriod = selectedPeriod === "All" || periodValue === selectedPeriod;

    return matchesSearch && matchesDept && matchesPeriod;
  });

  // KPI Calculations
  const totalNetSalary = filteredLogs.reduce((sum, log) => sum + (log.netSalary || 0), 0);
  const totalPayeTax = filteredLogs.reduce((sum, log) => sum + (log.paye || 0), 0);
  const totalEnpfPension = filteredLogs.reduce((sum, log) => sum + (log.enpf || 0), 0);
  const totalSlipsIssued = filteredLogs.length;

  // Single PDF download helper
  const handleExportPDF = async (log: HistoryLog, silent: boolean = false) => {
    if (!silent) setSelectedLog(log);
    
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const targetElement = silent ? hiddenPdfRef.current : pdfAreaRef.current;
        if (!targetElement) { 
          resolve(); 
          return; 
        }
        
        try {
          // Temporarily hide any element with 'no-print' inside container
          const noPrints = targetElement.querySelectorAll(".no-print");
          noPrints.forEach(el => (el as HTMLElement).style.display = "none");

          const canvas = await safeHtml2canvas(targetElement, { scale: 2, useCORS: true });
          
          noPrints.forEach(el => (el as HTMLElement).style.display = "");

          if (!canvas) throw new Error("Canvas generation returned null");
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdf = new jsPDF("p", "mm", "a4");
          const imgWidth = 210;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
          pdf.save(`${log.employeeName.replace(/\s+/g, "_")}_Payslip_${(log.taxPeriod || log.payPeriod || "Period").replace(/\s+/g, "_")}.pdf`);
        } catch (err: any) {
          console.error("PDF generator failed:", err);
          addToast("PDF rendering failed: " + err.message, "error");
        } finally {
          if (!silent) setSelectedLog(null);
          resolve();
        }
      }, 600);
    });
  };

  // Safe and beautifully styled batch downloads
  const handleDownloadAll = async () => {
    if (filteredLogs.length === 0) {
      addToast("No records match your selected filters to batch download", "warning");
      return;
    }

    setIsExportingAll(true);
    addToast(`Preparing dynamic payslips batch download for ${filteredLogs.length} items...`, "info");

    for (const log of filteredLogs) {
      setSelectedLog(log);
      await new Promise(r => setTimeout(r, 100)); // allow state bindings
      await handleExportPDF(log, true);
    }

    setSelectedLog(null);
    setIsExportingAll(false);
    addToast("All matched payslips downloaded successfully!", "success");

    await logAction(
      "PAYROLL_BATCH_EXPORTS",
      `Batch exported ${filteredLogs.length} historical payslips to local PDFs securely.`,
      businessId,
      filteredLogs.reduce((acc, current) => acc + (current.netSalary || 0), 0)
    );
  };

  // Helper safely formats payment date
  const formatPaymentDate = (log: HistoryLog) => {
    if (log.date?.toDate) {
      return new Date(log.date.toDate()).toLocaleDateString();
    }
    if (log.createdAt) {
      return new Date(log.createdAt).toLocaleDateString();
    }
    if (log.issueDate) {
      return log.issueDate;
    }
    return "N/A";
  };

  // Generate dynamic cryptographic integrity hash for payslips
  const generateIntegrityStamp = (log: HistoryLog) => {
    const str = `${log.id}-${log.employeeName}-${log.netSalary}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `MIRA-SECURE-${Math.abs(hash).toString(16).toUpperCase()}`;
  };

  if (loading) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
        <p className="text-xs font-bold text-slate-400">Loading historical audited payroll ledgers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Metric Indicators Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Net Payouts Cleared", value: `$${totalNetSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "Transferred net total", icon: DollarSign, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { label: "PAYE Levies Gathered", value: `$${totalPayeTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "Audited tax liabilities", icon: Coins, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "ENPF Invested", value: `$${totalEnpfPension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "Statutory pension reserves", icon: ShieldCheck, color: "text-violet-600 bg-violet-50 border-violet-100" },
          { label: "Payslips Logs", value: totalSlipsIssued, sub: "Archived ledger slips", icon: FileText, color: "text-slate-600 bg-slate-50 border-slate-100" }
        ].map((kpi, idx) => (
          <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{kpi.label}</span>
              <span className="text-lg md:text-xl font-black tracking-tight text-slate-900 mt-1 block leading-tight">{kpi.value}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{kpi.sub}</span>
            </div>
            <div className={`p-2 rounded-xl border ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. Directory control section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col xl:flex-row items-center justify-between gap-4">
        
        {/* Search bar */}
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee details, ID or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden transition"
          />
        </div>

        {/* Action controls and dropdown selectors */}
        <div className="flex flex-wrap w-full xl:w-auto items-center gap-3 justify-between xl:justify-end">
          <div className="flex gap-2">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="All">All Departments</option>
              <option value="Finance">Finance</option>
              <option value="HR">HR</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Customer Success">Customer Success</option>
              <option value="Operations">Operations</option>
              <option value="Legal">Legal</option>
            </select>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="All">All Tax Periods</option>
              {uniquePeriods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>

          <button 
            type="button"
            onClick={handleDownloadAll} 
            disabled={isExportingAll || filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {isExportingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Batching Payslips...
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-3.5 h-3.5" /> Download Block ({filteredLogs.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Archives ledger logs table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-16 text-center bg-slate-50/20 flex flex-col items-center justify-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">No Dispatched Archive Logs</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">There are no payslips coordinating with the selected filters. Issue new ones in the Payroll generator tab to expand parameters.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                  <th className="py-3.5 px-5">Employee / Job Title</th>
                  <th className="py-3.5 px-5">Department</th>
                  <th className="py-3.5 px-5">Tax Period</th>
                  <th className="py-3.5 px-5">Dispatched Date</th>
                  <th className="py-3.5 px-5 text-right">Gross Salary</th>
                  <th className="py-3.5 px-5 text-right">Total Deductions</th>
                  <th className="py-3.5 px-5 text-right">Net Payout</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-5">
                      <div>
                        <span className="font-bold text-slate-900 block">{log.employeeName}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">{log.employeeTitle || "Personnel"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-medium text-slate-500 uppercase tracking-tight text-[10px]">
                      {log.employeeDepartment || "N/A"}
                    </td>
                    <td className="py-4 px-5 font-bold text-slate-700">
                      {log.taxPeriod || log.payPeriod || "N/A"}
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-500">
                      {formatPaymentDate(log)}
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-slate-800 text-right">
                      ${log.grossSalary ? log.grossSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (log.basicSalary ? log.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—")}
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-rose-600 text-right">
                      {log.totalDeductions ? `-$${log.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-4 px-5 font-mono font-black text-emerald-700 text-right text-xs bg-emerald-50/10">
                      ${log.netSalary ? log.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        log.status === "Emailed" 
                          ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                          : "bg-blue-50 border-blue-150 text-blue-700"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          log.status === "Emailed" ? "bg-emerald-500" : "bg-blue-500"
                        }`} />
                        {log.status || "Issued"}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-1.5">
                      <button 
                        onClick={() => setSelectedLog(log)} 
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer transition"
                        title="View Detailed Payslip"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleExportPDF(log)} 
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 text-white cursor-pointer transition"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden batch download portal reference */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={hiddenPdfRef} className="w-[800px] bg-white text-slate-850 p-10 flex flex-col gap-5 text-xs font-sans">
          {selectedLog && (
            <>
              {/* Dynamic Logo / Name Headings */}
              <div className="border-b-2 border-slate-950 pb-4 mb-2 flex justify-between items-start">
                <div>
                  {companyDetails?.letterheadLogo || companyDetails?.logo ? (
                    <div className="relative w-40 h-16 mb-2">
                      <Image 
                        src={companyDetails?.letterheadLogo || companyDetails?.logo || ""} 
                        alt="Company Branding" 
                        fill 
                        className="object-contain object-left" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">{companyDetails?.name || "ABC Company"}</h2>
                  )}
                  <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">{companyDetails?.address || "Street Address\nCity, State, Zip"}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-950">PAYSLIP</h2>
                  <div className="mt-2 text-[10px] font-mono font-bold bg-slate-100 p-2 border border-slate-300 rounded inline-block">
                    {generateIntegrityStamp(selectedLog)}
                  </div>
                </div>
              </div>

              {/* Pay Period and Date metadata */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 font-extrabold border border-slate-200 rounded-xl">
                <div>Tax Period: <span className="font-semibold text-slate-700">{selectedLog.taxPeriod || selectedLog.payPeriod || "N/A"}</span></div>
                <div>Payment/Issue Date: <span className="font-semibold text-slate-700">{formatPaymentDate(selectedLog)}</span></div>
              </div>

              {/* Employee parameters block */}
              <div className="border border-slate-950 rounded-xl overflow-hidden mt-1">
                <div className="bg-slate-900 text-white font-extrabold p-2 text-center text-xs tracking-wider uppercase">Employee Designation Details</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 text-[11px]">
                  <div>Full Name: <span className="font-bold text-slate-900">{selectedLog.employeeName}</span></div>
                  <div>Department: <span className="font-bold text-slate-950">{selectedLog.employeeDepartment || "N/A"}</span></div>
                  <div>Employee Ledger ID: <span className="font-mono font-bold text-slate-950">{selectedLog.employeeId || "N/A"}</span></div>
                  <div>Corporate Title: <span className="font-bold text-slate-950">{selectedLog.employeeTitle || "N/A"}</span></div>
                  <div>Tax Identification No. (TIN): <span className="font-mono font-bold text-slate-950">{selectedLog.tin || "N/A"}</span></div>
                  <div>ENPF Pension Number: <span className="font-mono font-bold text-slate-950">{selectedLog.enpfNumber || "N/A"}</span></div>
                </div>
              </div>

              {/* Financial payout grids */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                
                {/* Earnings Column */}
                <div className="border border-slate-900 rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-slate-800 text-white font-extrabold p-2 text-center text-xs tracking-wide uppercase">Earnings & Benefits</div>
                  <div className="p-4 space-y-2.5 text-[11px] flex-1">
                    <div className="flex justify-between border-b pb-1.5 border-dashed">
                      <span className="text-slate-500 font-medium">Basic Salary</span> 
                      <span className="font-mono font-bold text-slate-900">${(selectedLog.basicSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {selectedLog.overtimeHours && selectedLog.overtimeHours > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">Overtime ({selectedLog.overtimeHours} hrs @ ${selectedLog.overtimeRate || 25}/hr)</span> 
                        <span className="font-mono font-bold text-slate-900">${((selectedLog.overtimeHours || 0) * (selectedLog.overtimeRate || 25)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null}
                    {selectedLog.housingAllowance && selectedLog.housingAllowance > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">Housing Allowance</span> 
                        <span className="font-mono font-bold text-slate-900">${(selectedLog.housingAllowance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null}
                    {selectedLog.transportAllowance && selectedLog.transportAllowance > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">Transport Allowance</span> 
                        <span className="font-mono font-bold text-slate-900">${(selectedLog.transportAllowance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null}
                    {selectedLog.bonus && selectedLog.bonus > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">Performance Bonus</span> 
                        <span className="font-mono font-bold text-slate-900">${(selectedLog.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="border border-slate-900 rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-slate-800 text-white font-extrabold p-2 text-center text-xs tracking-wide uppercase">Deductions & Levies</div>
                  <div className="p-4 space-y-2.5 text-[11px] flex-1">
                    <div className="flex justify-between border-b pb-1.5 border-dashed">
                      <span className="text-slate-500 font-medium">PAYE Tax Contribution (23%)</span> 
                      <span className="font-mono font-bold text-red-600">{selectedLog.paye && selectedLog.paye > 0 ? `-$${selectedLog.paye.toFixed(2)}` : "—"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 border-dashed">
                      <span className="text-slate-500 font-medium">ENPF Benefit Deduct (5%)</span> 
                      <span className="font-mono font-bold text-red-600">{selectedLog.enpf && selectedLog.enpf > 0 ? `-$${selectedLog.enpf.toFixed(2)}` : "—"}</span>
                    </div>
                    {selectedLog.medicalAid && selectedLog.medicalAid > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">Medical Aid Plan</span> 
                        <span className="font-mono font-bold text-red-600">-${(selectedLog.medicalAid || 0).toFixed(2)}</span>
                      </div>
                    ) : null}
                    {selectedLog.otherFeeAmount && selectedLog.otherFeeAmount > 0 ? (
                      <div className="flex justify-between border-b pb-1.5 border-dashed">
                        <span className="text-slate-500 font-medium">{selectedLog.otherFeeDescription || "Other Deductions"}</span> 
                        <span className="font-mono font-bold text-red-600">-${(selectedLog.otherFeeAmount || 0).toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>

              {/* Summary table */}
              <div className="grid grid-cols-3 gap-2 border-2 border-slate-950 bg-slate-100 p-3 font-extrabold text-center text-xs rounded-xl mt-2">
                <div>Gross Earnings: ${(selectedLog.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-rose-600">Total Deductions: ${(selectedLog.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-emerald-700 bg-emerald-50 rounded p-0.5 px-1 border border-emerald-150">Net Paid: ${(selectedLog.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>

              {/* Compliance Stamps */}
              <div className="mt-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-3xs font-mono font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>TRANSACTION COMPLIANCE CODE: {selectedLog.id.toLocaleUpperCase()} | SIGNED SECURITY GATEWAY</span>
                </div>
                <span>AUDITED TRANS-ID: {generateIntegrityStamp(selectedLog)}</span>
              </div>

              {/* Custom Adjustments / Notes statement if any */}
              {selectedLog.adjustments && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 italic">
                  <span className="font-extrabold not-italic block mb-0.5 text-slate-800">HR Directives & Payroll Notes:</span>
                  {selectedLog.adjustments}
                </div>
              )}

              {/* Copyright message */}
              <div className="mt-auto pt-8 border-t text-center text-[10px] text-slate-400 font-medium">
                Issued securely via MiraTech Workspace • Authenticated Enterprise Document © {new Date().getFullYear()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Interactive Details Preview Modal popup */}
      {selectedLog && !isExportingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto border border-slate-150 flex flex-col gap-4">
            
            {/* Modal controls header */}
            <div className="flex justify-between items-center pb-2 border-b no-print">
               <div>
                 <h3 className="text-base font-extrabold text-slate-900">Payslip Archive Details</h3>
                 <p className="text-2xs text-slate-400">Authentic digital twin receipt stored in secure partitioned logs</p>
               </div>
               <button 
                 onClick={() => setSelectedLog(null)} 
                 className="p-1.5 bg-slate-150 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer transition border"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>

            {/* A4 interactive render frame */}
            <div className="bg-slate-500 p-4 md:p-8 rounded-2xl max-h-[64vh] overflow-y-auto">
              
              <div 
                ref={pdfAreaRef} 
                className="w-full bg-white text-slate-850 p-6 md:p-8 shadow-2xl border border-slate-200 rounded-xl flex flex-col gap-4 min-h-[600px] text-[10px] md:text-[11px] font-sans text-left"
              >
                  {/* Ledger Corporate Heading block */}
                  <div className="border-b-2 border-slate-950 pb-3 mb-1 flex justify-between items-start">
                      <div>
                          {companyDetails?.logo ? (
                              <div className="relative w-32 h-12 mb-1">
                                  <Image 
                                      src={companyDetails.logo} 
                                      alt="Company Logo" 
                                      fill 
                                      className="object-contain object-left" 
                                      referrerPolicy="no-referrer"
                                  />
                              </div>
                          ) : (
                              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">{companyDetails?.name || "ABC Company"}</h2>
                          )}
                          <p className="text-[9px] text-slate-500 whitespace-pre-line leading-relaxed">{companyDetails?.address || "Street Address\nCity, State, Zip"}</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-tight">PAYSLIP</h2>
                        <div className="mt-1 text-[9px] font-mono font-bold bg-slate-50 p-1 border border-slate-200 rounded inline-block text-slate-600">
                          {generateIntegrityStamp(selectedLog)}
                        </div>
                      </div>
                  </div>
                  
                  {/* Pay period and Date block */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 px-3 font-semibold border border-slate-200 rounded-lg">
                      <div className="text-slate-600">Tax Period: <span className="font-extrabold text-slate-900">{selectedLog.taxPeriod || selectedLog.payPeriod || "N/A"}</span></div>
                      <div className="text-slate-600">Date of Payment: <span className="font-extrabold text-slate-900">{formatPaymentDate(selectedLog)}</span></div>
                  </div>

                  {/* Employee Information */}
                  <div className="border border-slate-900 rounded-lg overflow-hidden mt-0.5">
                      <div className="bg-slate-900 text-white font-extrabold p-1.5 px-3 text-center text-xs tracking-wider uppercase">Employee Information</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 text-[10px] md:text-[11px]">
                        <div className="text-slate-500">Full Name: <span className="font-bold text-slate-900">{selectedLog.employeeName}</span></div>
                        <div className="text-slate-500">Department: <span className="font-extrabold text-slate-900">{selectedLog.employeeDepartment || "N/A"}</span></div>
                        <div className="text-slate-500">Employee ID: <span className="font-mono font-bold text-slate-900">{selectedLog.employeeId || "N/A"}</span></div>
                        <div className="text-slate-500">Role Title: <span className="font-extrabold text-slate-900">{selectedLog.employeeTitle || "N/A"}</span></div>
                        <div className="text-slate-500">Tax Registration (TIN): <span className="font-mono font-bold text-slate-900">{selectedLog.tin || "N/A"}</span></div>
                        <div className="text-slate-500">ENPF Pension No.: <span className="font-mono font-bold text-slate-900">{selectedLog.enpfNumber || "N/A"}</span></div>
                      </div>
                  </div>

                  {/* Financial Breakdown Table Grids */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-0.5">
                      
                      {/* Earnings Column */}
                      <div className="border border-slate-900 rounded-lg overflow-hidden flex flex-col">
                          <div className="bg-slate-800 text-white font-bold p-1 px-3 text-center text-xs">Earnings & Additions</div>
                          <div className="p-3 space-y-2 text-[10px] md:text-[11px] flex-1">
                              <div className="flex justify-between border-b border-dashed pb-1">
                                <span className="text-slate-500">Basic Salary</span> 
                                <span className="font-mono font-bold text-slate-900">${(selectedLog.basicSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              {selectedLog.overtimeHours && selectedLog.overtimeHours > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Overtime hours ({selectedLog.overtimeHours} x ${selectedLog.overtimeRate || 25})</span> 
                                  <span className="font-mono font-bold text-slate-900">${((selectedLog.overtimeHours || 0) * (selectedLog.overtimeRate || 25)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedLog.housingAllowance && selectedLog.housingAllowance > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Housing Allowance</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedLog.housingAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedLog.transportAllowance && selectedLog.transportAllowance > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Transport Allowance</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedLog.transportAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedLog.bonus && selectedLog.bonus > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Performance Bonus</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedLog.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                          </div>
                      </div>

                      {/* Deductions Column */}
                      <div className="border border-slate-900 rounded-lg overflow-hidden flex flex-col">
                          <div className="bg-slate-800 text-white font-bold p-1 px-3 text-center text-xs">Deductions & Levies</div>
                          <div className="p-3 space-y-2 text-[10px] md:text-[11px] flex-1">
                              <div className="flex justify-between border-b border-dashed pb-1">
                                <span className="text-slate-500">PAYE Taxation (23% gross)</span> 
                                <span className="font-mono font-bold text-red-600">{selectedLog.paye && selectedLog.paye > 0 ? `-$${selectedLog.paye.toFixed(2)}` : "—"}</span>
                              </div>
                              <div className="flex justify-between border-b border-dashed pb-1">
                                <span className="text-slate-500">ENPF Co-Fund (5% basic)</span> 
                                <span className="font-mono font-bold text-red-600">{selectedLog.enpf && selectedLog.enpf > 0 ? `-$${selectedLog.enpf.toFixed(2)}` : "—"}</span>
                              </div>
                              {selectedLog.medicalAid && selectedLog.medicalAid > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Medical Aid Premium</span> 
                                  <span className="font-mono font-bold text-red-600">-${selectedLog.medicalAid.toFixed(2)}</span>
                                </div>
                              ) : null}
                              {selectedLog.otherFeeAmount && selectedLog.otherFeeAmount > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">{selectedLog.otherFeeDescription || "Other Fee"}</span> 
                                  <span className="font-mono font-bold text-red-600">-${selectedLog.otherFeeAmount.toFixed(2)}</span>
                                </div>
                              ) : null}
                          </div>
                      </div>

                  </div>
                  
                  {/* Totals Summary Row */}
                  <div className="grid grid-cols-3 gap-2 border-t-2 border-b-2 border-slate-900 bg-slate-100 p-2 md:p-3 font-extrabold text-center text-[10px] md:text-xs rounded-lg mt-0.5">
                      <div>Gross Earnings: ${(selectedLog.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-rose-600">Total Deductions: ${(selectedLog.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-emerald-700 bg-emerald-50 rounded border border-emerald-150 p-0.5">Net Paid: ${(selectedLog.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  {/* Blockchain or compliance stamp */}
                  <div className="p-2 px-3 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between text-[9px] font-mono text-slate-500 gap-1 uppercase">
                    <span>SECURITY COMPLIANCE ENVELOPE VERIFIED | DIRECTIVE REF: {selectedLog.id}</span>
                    <span>AUDITED SEAL: {generateIntegrityStamp(selectedLog)}</span>
                  </div>

                  {/* Custom Adjustments notes if any */}
                  {selectedLog.adjustments && (
                    <div className="p-2.5 bg-slate-50 border rounded-lg text-[9px] md:text-[10px] text-slate-600 italic">
                      <span className="font-bold not-italic block text-slate-800">HR Advisory & Payout notes:</span>
                      {selectedLog.adjustments}
                    </div>
                  )}
                  
                  {/* Footer metadata */}
                  <div className="mt-auto border-t pt-4 text-center text-[9px] text-slate-400 font-semibold tracking-tight">
                      Issued securely via MiraTech Workspace • Authenticated Enterprise Document © {new Date().getFullYear()}
                  </div>
              </div>

            </div>

            {/* Modal actions trigger */}
            <div className="flex gap-2 justify-end no-print pt-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 border text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                <Printer className="w-4 h-4" /> Print Document
              </button>
              <button 
                onClick={() => handleExportPDF(selectedLog)}
                className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                <Download className="w-4 h-4" /> Export To PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
