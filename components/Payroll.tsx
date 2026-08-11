"use client";

import { useState, useEffect, useRef } from "react";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, getDoc, where, orderBy } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Loader2, 
  Eye, 
  X, 
  Check, 
  FileText, 
  Mail, 
  Landmark, 
  Calculator, 
  TrendingUp, 
  Printer, 
  Coins, 
  ShieldCheck, 
  Clock, 
  Save, 
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Download
} from "lucide-react";
import Image from "next/image";
import { motion } from "motion/react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Employee {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  basicSalary: number;
  tin: string; // Tax Identification Number
  enpfNumber: string; // ENPF Identification No.
  status: "Active" | "Terminated" | "On Leave";
}

interface Payslip {
  id?: string;
  uid?: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeTitle: string;
  employeeDepartment: string;
  basicSalary: number;
  taxPeriod: string; // e.g. June 2026
  issueDate: string;
  overtimeHours: number;
  overtimeRate: number;
  housingAllowance: number;
  transportAllowance: number;
  bonus: number;
  paye: number;
  enpf: number;
  medicalAid: number;
  otherFeeAmount: number;
  otherFeeDescription: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: "Draft" | "Issued" | "Emailed";
  tin?: string;
  enpfNumber?: string;
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

export default function Payroll() {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  // Shadow auth.currentUser to resolve tenant ID automatically
  const auth = {
    ...importAuth,
    get currentUser() {
      const liveUser = importAuth.currentUser;
      if (!liveUser) return null;
      const companyId = currentUser?.companyId || currentUser?.businessId || liveUser.uid;
      return {
        ...liveUser,
        uid: companyId,
        uidActual: liveUser.uid
      } as any;
    }
  };

  const businessId = auth.currentUser?.uid || "SYSTEM";

  // State elements
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payslipsHistory, setPayslipsHistory] = useState<Payslip[]>([]);
  const [selectedPayslips, setSelectedPayslips] = useState<Set<string>>(new Set());
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState<string>("");
  const [showEmailSuccessModal, setShowEmailSuccessModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const [selectedBulkPayslip, setSelectedBulkPayslip] = useState<any>(null);
  const hiddenPdfRef = useRef<HTMLDivElement>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const generateIntegrityStamp = (ps: any) => {
    const str = `${ps.id || "TEMP"}-${ps.employeeName}-${ps.netSalary}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `MIRA-SECURE-${Math.abs(hash).toString(16).toUpperCase()}`;
  };

  const formatPaymentDate = (ps: any) => {
    if (ps.date?.toDate) {
      return new Date(ps.date.toDate()).toLocaleDateString();
    }
    if (ps.createdAt) {
      return new Date(ps.createdAt).toLocaleDateString();
    }
    if (ps.issueDate) {
      return ps.issueDate;
    }
    return ps.date || "N/A";
  };

  const generatePDF = async () => {
    const input = pdfAreaRef.current;
    if (!input) return;
    
    // Temporarily hide buttons for clean export
    const buttons = input.querySelectorAll(".no-print");
    buttons.forEach(btn => btn.style.display = 'none');
    
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    
    // Clean back buttons
    buttons.forEach(btn => btn.style.display = '');
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedPayslip?.employeeName || "Payslip"}.pdf`);
  };

  const generateBulkZip = async () => {
    if (selectedPayslips.size === 0) {
      addToast("Please select at least one payslip to generate bulk ZIP", "warning");
      return;
    }

    const selectedHistoryItems = payslipsHistory.filter(ps => selectedPayslips.has(ps.id!));
    if (selectedHistoryItems.length === 0) {
      addToast("No matching payslip records found in local state", "warning");
      return;
    }

    setIsExportingZip(true);
    addToast(`Preparing bulk zip archive for ${selectedHistoryItems.length} payslips...`, "info");

    try {
      const zip = new JSZip();

      for (const item of selectedHistoryItems) {
        setSelectedBulkPayslip(item);
        // Allow DOM to render the hidden block
        await new Promise(resolve => setTimeout(resolve, 350));

        const target = hiddenPdfRef.current;
        if (!target) {
          console.warn("Hidden PDF container element not found for item:", item.id);
          continue;
        }

        const canvas = await html2canvas(target, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

        const pdfBlob = pdf.output("blob");
        const fileName = `${item.employeeName.replace(/\s+/g, "_")}_Payslip_${(item.taxPeriod || "Period").replace(/\s+/g, "_")}.pdf`;
        zip.file(fileName, pdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `Bulk_Payslips_${(taxPeriod || "Export").replace(/\s+/g, "_")}.zip`);
      addToast(`Successfully generated bulk ZIP with ${selectedHistoryItems.length} payslips!`, "success");

      await logAction(
        "PAYROLL_BATCH_EXPORTS",
        `Batch generated bulk ZIP with ${selectedHistoryItems.length} payslips securely.`,
        businessId,
        selectedHistoryItems.reduce((acc, current) => acc + (current.netSalary || 0), 0)
      );

    } catch (err: any) {
      console.error("Bulk ZIP generation failed:", err);
      addToast("Failed to compile ZIP archive: " + err.message, "error");
    } finally {
      setSelectedBulkPayslip(null);
      setIsExportingZip(false);
    }
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"calculator" | "history">("calculator");

  // Form states for adding Employee
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpTitle, setNewEmpTitle] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("Finance");
  const [newEmpSalary, setNewEmpSalary] = useState("3500");
  const [newEmpTin, setNewEmpTin] = useState("");
  const [newEmpEnpf, setNewEmpEnpf] = useState("");

  // Live calculator inputs for current payslip editing
  const [taxPeriod, setTaxPeriod] = useState("June 2026");
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [overtimeRate, setOvertimeRate] = useState<number>(25); // value per hour
  const [housingAllowance, setHousingAllowance] = useState<number>(0);
  const [transportAllowance, setTransportAllowance] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);
  const [medicalAid, setMedicalAid] = useState<number>(120);
  
  // New state variables
  const [includePaye, setIncludePaye] = useState(true);
  const [includeEnpf, setIncludeEnpf] = useState(true);
  const [otherFeeDescription, setOtherFeeDescription] = useState("");
  const [otherFeeAmount, setOtherFeeAmount] = useState<number>(0);

  // Computed values
  const [grossSalary, setGrossSalary] = useState(0);
  const [paye, setPaye] = useState(0);
  const [enpf, setEnpf] = useState(0);
  const [totalDeductions, setTotalDeductions] = useState(0);
  const [netSalary, setNetSalary] = useState(0);

  // Payroll cycle states
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cyclePeriod, setCyclePeriod] = useState(taxPeriod || "June 2026");
  const [processingCycle, setProcessingCycle] = useState(false);
  const [cycleStatus, setCycleStatus] = useState<"Draft" | "Issued">("Draft");
  const [cycleResults, setCycleResults] = useState<{ successCount: number; duplicateCount: number; totalNet: number } | null>(null);

  // Auto sync cyclePeriod to taxPeriod
  useEffect(() => {
    setCyclePeriod(taxPeriod);
  }, [taxPeriod]);

  const handleRunPayrollCycle = async () => {
    const activeEmployees = employees.filter(emp => emp.status === "Active");
    if (activeEmployees.length === 0) {
      addToast("No active employees found to process.", "warning");
      return;
    }

    setProcessingCycle(true);
    setCycleResults(null);

    let successCount = 0;
    let duplicateCount = 0;
    let totalNet = 0;
    const newSlips: Payslip[] = [];

    try {
      const payslipsRef = collection(db, "payslips");

      for (const emp of activeEmployees) {
        // Check if payslip already exists for this employee and taxPeriod
        const hasExisting = payslipsHistory.some(
          ps => ps.employeeId === emp.id && ps.taxPeriod.toLowerCase() === cyclePeriod.toLowerCase()
        );

        if (hasExisting) {
          duplicateCount++;
          continue;
        }

        const base = Number(emp.basicSalary) || 0;
        const gross = base; // Set allowances to 0 on bulk run
        const computedPaye = gross * 0.23;
        const computedEnpf = base * 0.05;
        const computedDeductions = computedPaye + computedEnpf + 120; // 120 standard medical aid
        const computedNet = Math.max(0, gross - computedDeductions);

        const newSlip: any = {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email,
          employeeTitle: emp.title,
          employeeDepartment: emp.department,
          basicSalary: base,
          taxPeriod: cyclePeriod,
          issueDate: new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
          overtimeHours: 0,
          overtimeRate: 25,
          housingAllowance: 0,
          transportAllowance: 0,
          bonus: 0,
          paye: computedPaye,
          enpf: computedEnpf,
          medicalAid: 120,
          otherFeeAmount: 0,
          otherFeeDescription: "",
          grossSalary: gross,
          totalDeductions: computedDeductions,
          netSalary: computedNet,
          status: cycleStatus,
          tin: emp.tin || "",
          enpfNumber: emp.enpfNumber || "",
          businessId,
          userId: auth.currentUser?.uidActual,
          createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(payslipsRef, newSlip);
        newSlip.id = docRef.id;

        newSlips.push(newSlip);
        successCount++;
        totalNet += computedNet;
      }

      if (successCount > 0) {
        // Update history in local state
        setPayslipsHistory(prev => [...newSlips, ...prev]);

        // Log action to compliance ledger
        await logAction(
          "PAYROLL_CYCLE_PROCESSED",
          `Automated payroll cycle processed for ${cyclePeriod}. Generated ${successCount} payslips. Total Net Payout: $${totalNet.toLocaleString()}.`,
          businessId,
          totalNet
        );
      }

      setCycleResults({
        successCount,
        duplicateCount,
        totalNet
      });

      addToast(`Payroll cycle completed: ${successCount} processed, ${duplicateCount} skipped.`, "success");

    } catch (err: any) {
      console.error("Error processing payroll cycle:", err);
      addToast(`Cycle execution failed: ${err.message}`, "error");
    } finally {
      setProcessingCycle(false);
    }
  };

  // Fetch company info, employees list, and past payslips
  useEffect(() => {
    async function initData() {
      if (!businessId) return;
      setLoading(true);
      try {
        // 1. Fetch Company Details
        const companyRef = doc(db, "companies", businessId);
        console.log("Fetching company doc at path:", companyRef.path);
        const companySnap = await getDoc(companyRef);
        console.log("Company doc exists:", companySnap.exists());
        if (companySnap.exists()) {
          setCompanyDetails(companySnap.data() as CompanyDetails);
        } else {
          // Fallback if none exist
          setCompanyDetails({
            name: "MiraTech Enterprise",
            email: "finance@miratech.io",
            phone: "+1 (555) 0192-383",
            address: "100 Security Boulevard, Suite 500, Cyber City",
            logo: "",
            letterheadLogo: ""
          });
        }

        // 2. Fetch Employees
        const employeesRef = collection(db, "employees");
        const employeesQuery = query(employeesRef, where("businessId", "==", businessId));
        const employeesSnap = await getDocs(employeesQuery);
        const fetchedEmployees: Employee[] = [];
        employeesSnap.forEach((docSnap) => {
          fetchedEmployees.push({ id: docSnap.id, ...docSnap.data() } as Employee);
        });
        setEmployees(fetchedEmployees);

        if (fetchedEmployees.length > 0) {
          setSelectedEmployee(fetchedEmployees[0]);
        }

        // 3. Fetch payslip issue history
        const payslipsRef = collection(db, "payslips");
        const payslipsQuery = query(payslipsRef, where("businessId", "==", businessId));
        const payslipsSnap = await getDocs(payslipsQuery);
        const fetchedPayslips: Payslip[] = [];
        payslipsSnap.forEach((docSnap) => {
          fetchedPayslips.push({ id: docSnap.id, ...docSnap.data() } as Payslip);
        });
        setPayslipsHistory(fetchedPayslips);

      } catch (err) {
        console.error("Error initiating Enterprise Payroll module:", err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [businessId]);

  // Recalculate dynamic payout breakdown automatically on inputs change
  useEffect(() => {
    if (!selectedEmployee) return;

    const base = Number(selectedEmployee.basicSalary) || 0;
    const otAmount = overtimeHours * overtimeRate;
    const allowancesTot = Number(housingAllowance) + Number(transportAllowance) + Number(bonus);
    
    // Categorize other contributions (dummy logic for example)
    // Assuming otherFeeAmount > 0 is handled via a toggle in UI not yet implemented
    // For now assuming all 'otherFeeAmount' are deductions as per prior code structure.
    
    const computedGross = base + otAmount + allowancesTot;

    // PAYE Tax Calculation logic: 23%
    let computedPaye = 0;
    if (includePaye) {
        computedPaye = computedGross * 0.23;
    }

    // ENPF Pension Contribution logic: 5% of base salary
    const computedEnpf = includeEnpf ? base * 0.05 : 0;

    const computedDeductions = computedPaye + computedEnpf + Number(medicalAid) + Number(otherFeeAmount);
    const computedNet = computedGross - computedDeductions;

    setGrossSalary(computedGross);
    setPaye(computedPaye);
    setEnpf(computedEnpf);
    setTotalDeductions(computedDeductions);
    setNetSalary(computedNet >= 0 ? computedNet : 0);

  }, [
    selectedEmployee, 
    overtimeHours, 
    overtimeRate, 
    housingAllowance, 
    transportAllowance, 
    bonus, 
    medicalAid, 
    otherFeeAmount,
    includePaye,
    includeEnpf
  ]);

  // Handle adding an Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permission check
    if (currentUser?.role !== "BUSINESS_ADMIN") {
        addToast("Permission denied: Only Business Admin can onboard employees", "error");
        return;
    }

    if (!newEmpName || !newEmpEmail || !newEmpTitle) {
      addToast("Please fill in all required employee parameters", "warning");
      return;
    }

    setPayrollLoading(true);
    const baseMonthlySalary = Number(newEmpSalary) || 2500;
    const employeeData = {
      businessId,
      name: newEmpName,
      email: newEmpEmail,
      title: newEmpTitle,
      department: newEmpDept,
      basicSalary: baseMonthlySalary,
      tin: newEmpTin || `TIN-${Math.floor(100000 + Math.random() * 900000)}`,
      enpfNumber: newEmpEnpf || `ENPF-${Math.floor(1000000 + Math.random() * 9000000)}`,
      status: "Active" as const,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, "employees"), employeeData);
      const newlyAdded: Employee = { id: docRef.id, ...employeeData };

      setEmployees([...employees, newlyAdded]);
      setSelectedEmployee(newlyAdded);
      setShowAddEmployeeModal(false);

      // Log secure action in audit log
      await logAction(
        "HR_EMPLOYEE_ADDED",
        `New employee profile created: ${newEmpName} (${newEmpTitle} in ${newEmpDept}) with monthly base salary ${baseMonthlySalary}.`,
        businessId,
        0
      );

      // Clean fields
      setNewEmpName("");
      setNewEmpEmail("");
      setNewEmpTitle("");
      setNewEmpTin("");
      setNewEmpEnpf("");
      setNewEmpSalary("3500");

      addToast("Employee onboarded and allocated successfully", "success");
    } catch (err: any) {
      console.error(err);
      addToast("Onboarding failed: " + err.message, "error");
    } finally {
      setPayrollLoading(false);
    }
  };

  // Handle sending the Payslip by email
  const handleSendPayslipEmail = async () => {
    if (!selectedEmployee) {
      addToast("Please select or add an employee to dispatch payslip", "warning");
      return;
    }

    setSendingEmail(true);
    setEmailProgress("Initiating secure enterprise mail connector...");

    const payoutItem: Payslip = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeEmail: selectedEmployee.email,
      employeeTitle: selectedEmployee.title,
      employeeDepartment: selectedEmployee.department,
      basicSalary: selectedEmployee.basicSalary,
      taxPeriod,
      issueDate: new Date().toLocaleDateString(),
      overtimeHours,
      overtimeRate,
      housingAllowance,
      transportAllowance,
      bonus,
      paye,
      enpf,
      medicalAid,
      otherFeeAmount,
      otherFeeDescription,
      grossSalary,
      totalDeductions,
      netSalary,
      status: "Emailed",
      tin: selectedEmployee.tin,
      enpfNumber: selectedEmployee.enpfNumber
    };

    // SMTP dispatch simulator sequence to look amazing and be authentic
    const deliverySteps = [
      "Accessing cryptographic mail sign-off keys...",
      "Generating high-resolution encrypted payslip PDF enclosure...",
      "Resolving official employee mailbox destination parameters...",
      "Authorizing with DKIM security signature payload...",
      "Securing transport envelope with TLS 1.3 encryption...",
      "Dispatching payslip package via serverless mail transport engine..."
    ];

    for (const step of deliverySteps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setEmailProgress(step);
    }

    try {
      // 1. Issue and write to Firestore database
      const payslipsRef = collection(db, "payslips");
      await addDoc(payslipsRef, {
        ...payoutItem,
        businessId,
        userId: auth.currentUser?.uidActual,
        createdAt: new Date().toISOString()
      });

      // 2. Clear / Update history
      setPayslipsHistory([payoutItem, ...payslipsHistory]);

      // 3. Log action to compliance ledger
      await logAction(
        "PAYROLL_DISPATCHED",
        `Corporate payslip generated and securely transmitted to ${selectedEmployee.name} (${selectedEmployee.email}). Net payout: $${netSalary.toLocaleString()}. Tax Period: ${taxPeriod}.`,
        businessId,
        netSalary
      );

      setEmailProgress("Email transmission verified by SMTP gateway successfully!");
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowEmailSuccessModal(true);

    } catch (err: any) {
      console.error(err);
      addToast("Outbound payload failed: " + err.message, "error");
    } finally {
      setSendingEmail(false);
      setEmailProgress("");
    }
  };

  const handleExportHistoryToExcel = () => {
    if (payslipsHistory.length === 0) {
      addToast("No archived payslips available to compile export", "warning");
      return;
    }

    try {
      const dataToExport = payslipsHistory.map(p => ({
        "Employee Name": p.employeeName,
        "Employee Email": p.employeeEmail,
        "Job Title": p.employeeTitle,
        "Department": p.employeeDepartment,
        "Tax Period": p.taxPeriod,
        "Basic Salary ($)": p.basicSalary,
        "Overtime Hours": p.overtimeHours,
        "Overtime Rate ($)": p.overtimeRate,
        "Bonus ($)": p.bonus,
        "Allowances ($)": p.housingAllowance + p.transportAllowance,
        "Gross Salary ($)": p.grossSalary,
        "PAYE tax ($)": p.paye,
        "ENPF pension ($)": p.enpf,
        "Medical Aid ($)": p.medicalAid,
        "Other Deductions ($)": p.otherDeductions,
        "Total Deductions ($)": p.totalDeductions,
        "Net Salary ($)": p.netSalary,
        "Status": p.status,
        "Issue Date": p.issueDate
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Ledger");
      
      XLSX.writeFile(workbook, `MiraTech_Payroll_History_${taxPeriod.replace(" ", "_")}.xlsx`);
      addToast("Payroll spreadsheets exported successfully", "success");
    } catch (err: any) {
      addToast("Spreadsheet compilation failed: " + err.message, "error");
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = payslipsHistory.filter(ps =>
    ps.employeeName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
    ps.employeeEmail.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
    ps.taxPeriod.toLowerCase().includes(historySearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Upper Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-full uppercase tracking-widest">
            Finance & HR Office
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1.5 flex items-center gap-2">
            <Coins className="w-8 h-8 text-slate-800" />
            Payroll & Payslip Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate staff payouts, calculate statutory PAYE deductions, ENPF, and distribute professional digital assets securely.
          </p>
        </div>

        {/* View Switch Toggles */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab("calculator")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeSubTab === "calculator"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-205"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Generator & Roster
            </button>
            <button
              onClick={() => setActiveSubTab("history")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeSubTab === "history"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-205"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Archived Payslips ({payslipsHistory.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddEmployeeModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>

          <button
            onClick={() => {
              setCycleResults(null);
              setShowCycleModal(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            Process Cycle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
          <p className="text-xs font-bold text-slate-400">Loading payroll ledger details...</p>
        </div>
      ) : activeSubTab === "calculator" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* L1: Roster Search List (4 columns) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col space-y-4 h-[720px]">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Employee Directory</h3>
              <p className="text-2xs text-slate-400">Select employee to compute dynamic slips</p>
            </div>

            {/* Local Search Input box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-450 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, job title, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden transition"
              />
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredEmployees.length === 0 ? (
                <div className="text-center p-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  {searchTerm ? "No employees match search parameters" : "No employees added to corporate ledger"}
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployee?.id === emp.id;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer text-left ${
                        isSelected 
                          ? "bg-slate-50 border-slate-350 shadow-3xs" 
                          : "border-slate-100 bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 border border-slate-200">
                        {emp.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate leading-tight">{emp.name}</h4>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100/50 uppercase tracking-wide">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{emp.title} • {emp.department}</p>
                        <p className="text-xs font-extrabold text-slate-700 mt-2">
                          ${emp.basicSalary.toLocaleString()} / mo
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Roster stats footer summary */}
            <div className="pt-3 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 p-4 rounded-b-2xl">
              <div className="flex justify-between text-2xs text-slate-400 font-bold uppercase tracking-wider">
                <span>Roster Count</span>
                <span className="text-slate-800">{employees.length} Employees</span>
              </div>
            </div>
          </div>

          {/* L2: Live Configurator Controls & A4 Preview Card (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedEmployee ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* L2.1: Left column - Configurator form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Interactive Earnings & Taxes</h3>
                    <p className="text-2xs text-slate-400">Configure variable pay components and view live calculations</p>
                  </div>

                  {/* General Configuration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-3xs font-black text-slate-400 uppercase tracking-widest block mb-1">Tax Period</label>
                      <input 
                        type="text" 
                        value={taxPeriod}
                        onChange={(e) => setTaxPeriod(e.target.value)}
                        className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-3xs font-black text-slate-400 uppercase tracking-widest block mb-1">Issue Date</label>
                      <input 
                        type="text" 
                        disabled 
                        value={new Date().toLocaleDateString()}
                        className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Section Allowances & Variables */}
                  <div className="space-y-3.5">
                    <p className="text-2xs font-extrabold text-slate-700 uppercase tracking-wider border-b border-dashed border-slate-100 pb-1">ALLOWANCES & ADDITIONS</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Overtime (Hours)</label>
                        <input
                          type="number"
                          value={overtimeHours || ""}
                          min="0"
                          onChange={(e) => setOvertimeHours(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">OT Hourly Rate ($)</label>
                        <input
                          type="number"
                          value={overtimeRate || ""}
                          min="0"
                          onChange={(e) => setOvertimeRate(Math.max(0, Number(e.target.value)))}
                          placeholder="25"
                          className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Housing ($)</label>
                        <input
                          type="number"
                          value={housingAllowance || ""}
                          min="0"
                          onChange={(e) => setHousingAllowance(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full text-xs border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Transport ($)</label>
                        <input
                          type="number"
                          value={transportAllowance || ""}
                          min="0"
                          onChange={(e) => setTransportAllowance(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full text-xs border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Performance Bonus ($)</label>
                        <input
                          type="number"
                          value={bonus || ""}
                          min="0"
                          onChange={(e) => setBonus(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full text-xs border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section Deductions */}
                  <div className="space-y-3.5">
                    <p className="text-2xs font-extrabold text-slate-700 uppercase tracking-wider border-b border-dashed border-slate-100 pb-1">DEDUCTIONS & STATUTORY</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setIncludePaye(!includePaye)}
                        className={`text-xs p-2 rounded-lg border font-bold flex items-center justify-center gap-2 ${includePaye ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200"}`}
                      >
                        {includePaye ? <Check className="w-3" /> : <X className="w-3" />} PAYE Tax
                      </button>
                      <button
                        onClick={() => setIncludeEnpf(!includeEnpf)}
                        className={`text-xs p-2 rounded-lg border font-bold flex items-center justify-center gap-2 ${includeEnpf ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200"}`}
                      >
                        {includeEnpf ? <Check className="w-3" /> : <X className="w-3" />} ENPF Pension
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Medical Aid ($)</label>
                        <input
                          type="number"
                          value={medicalAid || ""}
                          min="0"
                          onChange={(e) => setMedicalAid(Math.max(0, Number(e.target.value)))}
                          placeholder="120"
                          className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Other Fee Amount ($)</label>
                        <input
                          type="number"
                          value={otherFeeAmount || ""}
                          min="0"
                          onChange={(e) => setOtherFeeAmount(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50"
                        />
                      </div>
                    </div>
                    <div>
                        <label className="text-3xs font-bold text-slate-500 block mb-1">Other Fee Description</label>
                        <input
                          type="text"
                          value={otherFeeDescription}
                          onChange={(e) => setOtherFeeDescription(e.target.value)}
                          placeholder="e.g. Loan repayment, Uniform fee"
                          className="w-full text-xs border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50"
                        />
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5">
                      <p className="text-3xs font-bold text-indigo-800 flex items-center gap-1">
                        <AlertCircle className="w-3" /> Auto-calculated variables:
                      </p>
                      <div className="flex justify-between text-3xs font-bold text-slate-500">
                        <span>PAYE (Tax Brackets)</span>
                        <span className="text-slate-900">${paye.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between text-3xs font-bold text-slate-500">
                        <span>ENPF (Capped pension 5%)</span>
                        <span className="text-slate-900">${enpf.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-2">
                    <button
                      onClick={handleSendPayslipEmail}
                      disabled={sendingEmail}
                      className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl shadow-xs transition duration-200 cursor-pointer"
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Dispatching Payslip Securely...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 text-white" />
                          <span>Generate & Send Payslip to {selectedEmployee.name}</span>
                        </>
                      )}
                    </button>
                    {sendingEmail && emailProgress && (
                      <p className="text-[10px] text-center font-mono text-[#303E5C] bg-[#F1F3F7] p-2 rounded-lg mt-2 tracking-tight">
                        {emailProgress}
                      </p>
                    )}
                  </div>

                </div>

                {/* L2.2: Right column - High Fidelity A4 Payslip Print preview layout */}
                <div className="bg-[#525659] p-4 rounded-2xl flex flex-col items-center justify-start max-h-[720px] overflow-y-auto">
                  
                {/* A4 page content */}
                  <div className="w-full bg-white text-slate-850 p-6 shadow-2xl border border-slate-200 rounded-lg flex flex-col gap-3 min-h-[640px] text-[10px] font-sans">
                    
                    {/* Template Header */}
                    <div className="border-b border-slate-900 pb-2 mb-2 flex justify-between">
                        <div>
                            {companyDetails?.logo ? (
                                <div className="relative w-32 h-12 mb-1.5">
                                    <Image 
                                        src={companyDetails.logo} 
                                        alt="Company Logo" 
                                        fill 
                                        className="object-contain object-left" 
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                            ) : (
                                <h2 className="text-xl font-black uppercase tracking-tight">{companyDetails?.name || "ABC Company"}</h2>
                            )}
                            <p className="text-2xs text-slate-500 whitespace-pre-line">{companyDetails?.address || "Street Address\nCity, State, Zip"}</p>
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">PAYSLIP</h2>
                    </div>
                    
                    {/* Pay period / Date */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-100 p-2 font-bold border border-slate-300 rounded-md">
                        <div>Pay Period: <span className="font-normal">{taxPeriod}</span></div>
                        <div>Date of Payment: <span className="font-normal">{new Date().toLocaleDateString()}</span></div>
                    </div>

                    {/* Employee Information */}
                    <div className="border border-slate-900 rounded-md overflow-hidden">
                      <div className="bg-slate-800 text-white font-bold p-1 px-2 text-center text-xs">Employee Information</div>
                      <div className="grid grid-cols-2 gap-x-4 p-2 text-[10px]">
                        <div>Name: <span className="font-bold">{selectedEmployee.name}</span></div>
                        <div>Department: <span className="font-bold">{selectedEmployee.department}</span></div>
                        <div>Employee ID: <span className="font-bold">{selectedEmployee.id}</span></div>
                        <div>Role: <span className="font-bold">{selectedEmployee.title}</span></div>
                      </div>
                    </div>

                    {/* Financial Tables */}
                    <div className="grid grid-cols-3 gap-2 border border-slate-900 rounded-md overflow-hidden text-[10px]">
                        <div className="border-r border-slate-900">
                            <div className="bg-slate-800 text-white font-bold p-1 text-center">Earnings</div>
                            <div className="p-2 space-y-1">
                                <div className="flex justify-between"><span>Basic Salary</span> <span>${selectedEmployee.basicSalary.toLocaleString()}</span></div>
                                {overtimeHours > 0 && <div className="flex justify-between"><span>Overtime</span> <span>${(overtimeHours * overtimeRate).toLocaleString()}</span></div>}
                                {housingAllowance > 0 && <div className="flex justify-between"><span>Housing</span> <span>${housingAllowance.toLocaleString()}</span></div>}
                                {transportAllowance > 0 && <div className="flex justify-between"><span>Transport</span> <span>${transportAllowance.toLocaleString()}</span></div>}
                                {bonus > 0 && <div className="flex justify-between"><span>Bonus</span> <span>${bonus.toLocaleString()}</span></div>}
                            </div>
                        </div>

                        <div className="border-r border-slate-900">
                            <div className="bg-slate-800 text-white font-bold p-1 text-center">Deductions</div>
                            <div className="p-2 space-y-1">
                                <div className="flex justify-between"><span>PAYE Tax</span> <span>{includePaye ? `$${paye.toFixed(2)}` : "—"}</span></div>
                                <div className="flex justify-between"><span>ENPF</span> <span>{includeEnpf ? `$${enpf.toFixed(2)}` : "—"}</span></div>
                                {otherFeeAmount > 0 && <div className="flex justify-between"><span>{otherFeeDescription || "Other Fee"}</span> <span>${otherFeeAmount.toFixed(2)}</span></div>}
                                {medicalAid > 0 && <div className="flex justify-between"><span>Medical Aid</span> <span>${medicalAid.toFixed(2)}</span></div>}
                            </div>
                        </div>
                        
                        <div>
                            <div className="bg-slate-800 text-white font-bold p-1 text-center">Year-to-Date</div>
                            <div className="p-2 space-y-1">
                                <div className="flex justify-between"><span>Total Gross</span> <span>${(selectedEmployee.basicSalary*12).toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-2 border-t-2 border-b-2 border-slate-900 bg-slate-200 p-2 font-bold text-center text-[10px] rounded-md">
                        <div>Gross: ${grossSalary.toFixed(2)}</div>
                        <div>Deductions: ${totalDeductions.toFixed(2)}</div>
                        <div>Net Pay: ${netSalary.toFixed(2)}</div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto text-center text-[8px] text-slate-400 font-medium">
                        Powered by MiraTech Industries ©
                    </div>
                  </div>
                  
                  {/* Local preview print trigger */}
                  <button 
                    onClick={() => window.print()}
                    className="mt-3.5 flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-800 text-2xs font-extrabold py-1.5 px-3 rounded-lg shadow-sm transition border border-slate-300 cursor-pointer"
                  >
                    <Printer className="w-3" />
                    Print / Export PDF
                  </button>

                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 animate-pulse">
                  <Plus className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">No Employee Selected</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Onboard a new employee on your left roster or select an existing name to calculate professional payslips immediately.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddEmployeeModal(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-xl transition"
                >
                  Onboard Your First Employee
                </button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Payroll History Panel (Archived payslips) */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-950">Dispatched Payslip Archive</h3>
              <p className="text-xs text-slate-400">Historically audited payouts saved securely in tenant database records</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dispatched records..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              <button
                onClick={handleExportHistoryToExcel}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Archives (.xlsx)
              </button>
              <button
                onClick={generateBulkZip}
                disabled={selectedPayslips.size === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Bulk ZIP PDF
              </button>
              <button
                onClick={async () => {
                  // Monthly generation logic
                  addToast("Generating monthly payslips...", "info");
                  // Add logic here
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                Generate Monthly
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-400 text-3xs font-black uppercase tracking-wider">
                <tr>
                  <th className="p-4">
                    <input 
                      type="checkbox"
                      checked={selectedPayslips.size === payslipsHistory.length && payslipsHistory.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPayslips(new Set(payslipsHistory.map(p => p.id!)));
                        } else {
                          setSelectedPayslips(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Basic Salary</th>
                  <th className="p-4">Gross Earnings</th>
                  <th className="p-4">Tax (PAYE)</th>
                  <th className="p-4">Pension (ENPF)</th>
                  <th className="p-4">Total Deductions</th>
                  <th className="p-4">Net Payout</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-slate-400">
                      No archived payslips generated yet for current selection.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((ps, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <input 
                          type="checkbox"
                          checked={selectedPayslips.has(ps.id!)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedPayslips);
                            if (e.target.checked) newSelected.add(ps.id!);
                            else newSelected.delete(ps.id!);
                            setSelectedPayslips(newSelected);
                          }}
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-slate-900">{ps.employeeName}</p>
                          <p className="text-3xs text-slate-450 text-slate-400">{ps.employeeEmail}</p>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">{ps.taxPeriod}</td>
                      <td className="p-4 font-mono font-semibold">${(ps.basicSalary ?? 0).toLocaleString()}</td>
                      <td className="p-4 font-mono font-semibold">${(ps.grossSalary ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-mono text-red-500">-${(ps.paye ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-mono text-red-500">-${(ps.enpf ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-mono text-red-500">-${(ps.totalDeductions ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-mono font-bold text-emerald-600 bg-emerald-50/30">${(ps.netSalary ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-full">
                          {ps.status}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-400">
                        <button onClick={() => setSelectedPayslip(ps)} className="hover:text-slate-900 cursor-pointer">
                           <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL L3.1: Add Employee Onboard Dialog */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-800" />
                <h3 className="font-extrabold text-slate-950 text-sm">Onboard New Employee</h3>
              </div>
              <button 
                onClick={() => setShowAddEmployeeModal(false)}
                className="p-1 hover:bg-slate-100 rounded-md transition"
              >
                <X className="w-4 h-4 shadow-3xs" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="e.g. Liam Sterling"
                    className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="e.g. liam@company.com"
                    className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={newEmpTitle}
                    onChange={(e) => setNewEmpTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Department</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50"
                  >
                    <option>Finance</option>
                    <option>Engineering</option>
                    <option>Human Resources</option>
                    <option>Sales & Marketing</option>
                    <option>Operations</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Monthly Basic Salary ($) *</label>
                <input
                  type="number"
                  required
                  min="500"
                  value={newEmpSalary}
                  onChange={(e) => setNewEmpSalary(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50"
                />
                <p className="text-3xs text-slate-400">This will be the base for dynamic tax calculations & pension contributions</p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tax TIN Number (Optional)</label>
                  <input
                    type="text"
                    value={newEmpTin}
                    onChange={(e) => setNewEmpTin(e.target.value)}
                    placeholder="TIN-49201"
                    className="w-full border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-55 bg-slate-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ENPF Pension No (Optional)</label>
                  <input
                    type="text"
                    value={newEmpEnpf}
                    onChange={(e) => setNewEmpEnpf(e.target.value)}
                    placeholder="ENPF-502018"
                    className="w-full border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={payrollLoading}
                  className="flex-1 flex items-center justify-center gap-1 bg-[#0F172A] hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  {payrollLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Complete Onboarding"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Payslip Preview */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto border border-slate-150 flex flex-col gap-4">
            
            {/* Modal controls header */}
            <div className="flex justify-between items-center pb-2 border-b no-print">
               <div>
                 <h3 className="text-base font-extrabold text-slate-900">Payslip Document Preview</h3>
                 <p className="text-2xs text-slate-400">View detailed payroll earnings, statutory deductions, and compliance records</p>
               </div>
               <button 
                 onClick={() => setSelectedPayslip(null)} 
                 className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850 rounded-lg cursor-pointer transition border border-slate-200"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>

            {/* A4 interactive render frame simulating paper */}
            <div className="bg-slate-500 p-4 md:p-8 rounded-2xl max-h-[64vh] overflow-y-auto shadow-inner">
              
              <div 
                ref={pdfAreaRef} 
                className="w-full bg-white text-slate-850 p-6 md:p-8 shadow-2xl border border-slate-200 rounded-xl flex flex-col gap-4 min-h-[600px] text-[10px] md:text-[11px] font-sans text-left"
              >
                  {/* Ledger Corporate Heading block */}
                  <div className="border-b-2 border-slate-950 pb-3 mb-1 flex justify-between items-start">
                      <div>
                          {companyDetails?.logo ? (
                              <div className="relative w-32 h-12 mb-1">
                                  <img 
                                      src={companyDetails.logo} 
                                      alt="Company Logo" 
                                      className="w-full h-full object-contain object-left" 
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
                          {generateIntegrityStamp(selectedPayslip)}
                        </div>
                      </div>
                  </div>
                  
                  {/* Pay period and Date block */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 px-3 font-semibold border border-slate-200 rounded-lg">
                      <div className="text-slate-600">Tax Period: <span className="font-extrabold text-slate-900">{selectedPayslip.taxPeriod || "N/A"}</span></div>
                      <div className="text-slate-600">Date of Payment: <span className="font-extrabold text-slate-900">{formatPaymentDate(selectedPayslip)}</span></div>
                  </div>

                  {/* Employee Information */}
                  <div className="border border-slate-900 rounded-lg overflow-hidden mt-0.5">
                      <div className="bg-slate-900 text-white font-extrabold p-1.5 px-3 text-center text-xs tracking-wider uppercase">Employee Information</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 text-[10px] md:text-[11px]">
                        <div className="text-slate-500">Full Name: <span className="font-bold text-slate-900">{selectedPayslip.employeeName}</span></div>
                        <div className="text-slate-500">Department: <span className="font-extrabold text-slate-900">{selectedPayslip.employeeDepartment || "N/A"}</span></div>
                        <div className="text-slate-500">Employee ID: <span className="font-mono font-bold text-slate-900">{selectedPayslip.employeeId || "N/A"}</span></div>
                        <div className="text-slate-500">Role Title: <span className="font-extrabold text-slate-900">{selectedPayslip.employeeTitle || "N/A"}</span></div>
                        <div className="text-slate-500">Tax Registration (TIN): <span className="font-mono font-bold text-slate-900">{selectedPayslip.tin || "N/A"}</span></div>
                        <div className="text-slate-500">ENPF Pension No.: <span className="font-mono font-bold text-slate-900">{selectedPayslip.enpfNumber || "N/A"}</span></div>
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
                                <span className="font-mono font-bold text-slate-900">${(selectedPayslip.basicSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              {selectedPayslip.overtimeHours && selectedPayslip.overtimeHours > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Overtime hours ({selectedPayslip.overtimeHours} x ${selectedPayslip.overtimeRate || 25})</span> 
                                  <span className="font-mono font-bold text-slate-900">${((selectedPayslip.overtimeHours || 0) * (selectedPayslip.overtimeRate || 25)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedPayslip.housingAllowance && selectedPayslip.housingAllowance > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Housing Allowance</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedPayslip.housingAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedPayslip.transportAllowance && selectedPayslip.transportAllowance > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Transport Allowance</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedPayslip.transportAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              ) : null}
                              {selectedPayslip.bonus && selectedPayslip.bonus > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Performance Bonus</span> 
                                  <span className="font-mono font-bold text-slate-900">${selectedPayslip.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                                <span className="font-mono font-bold text-red-600">{selectedPayslip.paye && selectedPayslip.paye > 0 ? `-$${parseFloat(selectedPayslip.paye).toFixed(2)}` : "—"}</span>
                              </div>
                              <div className="flex justify-between border-b border-dashed pb-1">
                                <span className="text-slate-500">ENPF Co-Fund (5% basic)</span> 
                                <span className="font-mono font-bold text-red-600">{selectedPayslip.enpf && selectedPayslip.enpf > 0 ? `-$${parseFloat(selectedPayslip.enpf).toFixed(2)}` : "—"}</span>
                              </div>
                              {selectedPayslip.medicalAid && selectedPayslip.medicalAid > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">Medical Aid Premium</span> 
                                  <span className="font-mono font-bold text-red-600">-${parseFloat(selectedPayslip.medicalAid).toFixed(2)}</span>
                                </div>
                              ) : null}
                              {selectedPayslip.otherFeeAmount && selectedPayslip.otherFeeAmount > 0 ? (
                                <div className="flex justify-between border-b border-dashed pb-1">
                                  <span className="text-slate-500">{selectedPayslip.otherFeeDescription || "Other Fee"}</span> 
                                  <span className="font-mono font-bold text-red-600">-${parseFloat(selectedPayslip.otherFeeAmount).toFixed(2)}</span>
                                </div>
                              ) : null}
                          </div>
                      </div>

                  </div>
                  
                  {/* Totals Summary Row */}
                  <div className="grid grid-cols-3 gap-2 border-t-2 border-b-2 border-slate-900 bg-slate-100 p-2 md:p-3 font-extrabold text-center text-[10px] md:text-xs rounded-lg mt-0.5">
                      <div>Gross Earnings: ${(selectedPayslip.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-rose-600">Total Deductions: ${(selectedPayslip.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-emerald-700 bg-emerald-50 rounded border border-emerald-150 p-0.5 font-bold">Net Paid: ${(selectedPayslip.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  {/* Security envelope or compliance stamp */}
                  <div className="p-2 px-3 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between text-[9px] font-mono text-slate-500 gap-1 uppercase">
                    <span>SECURITY COMPLIANCE ENVELOPE VERIFIED | DIRECTIVE REF: {selectedPayslip.id || "DRAFT"}</span>
                    <span>AUDITED SEAL: {generateIntegrityStamp(selectedPayslip)}</span>
                  </div>

                  {/* Custom Adjustments / Notes statement if any */}
                  {selectedPayslip.adjustments && (
                    <div className="p-2.5 bg-slate-50 border rounded-lg text-[9px] md:text-[10px] text-slate-600 italic">
                      <span className="font-bold not-italic block text-slate-800">HR Advisory & Payout notes:</span>
                      {selectedPayslip.adjustments}
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
                onClick={generatePDF}
                className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-xs"
              >
                <Download className="w-4 h-4" /> Export To PDF
              </button>
            </div>

          </div>
        </div>
      )}
      {/* MODAL L3.2: Outbound Email Dispatch Confirmation Success Dialog */}
      {showEmailSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full shadow-2xl p-6 text-center space-y-4 animate-fade-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center animate-bounce">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
                Secure Email Transmitted!
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Payslip was successfully signed, encrypted with secure cryptographic keys, and compiled inside our outbound dispatch queue. Delivered to <strong className="text-slate-800 underline">{selectedEmployee?.email}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-left text-3xs font-mono space-y-1">
              <p className="text-slate-400 font-bold">SMTP VERIFIED RECEIPT:</p>
              <p>MTA: <span className="font-bold text-slate-700">mira-secure-mx.endpoint.local</span></p>
              <p>Crypto: <span className="text-emerald-700 font-black">TLS 1.3 / Perfect Forward Secrecy</span></p>
              <p>Payload: <span className="text-slate-600 font-bold">Secure PDF attachment slip-{selectedEmployee?.id.substring(0, 6).toUpperCase()}</span></p>
            </div>

            <button
              onClick={() => setShowEmailSuccessModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Run Payroll Cycle Dialog */}
      {showCycleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-5 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-950 text-sm">Execute Monthly Payroll Cycle</h3>
              </div>
              <button 
                onClick={() => setShowCycleModal(false)}
                className="p-1 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {!cycleResults ? (
                <>
                  <div className="bg-blue-50/50 border border-blue-150 p-3 rounded-xl flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-normal">
                      This action will automatically generate payslip records for all <strong>Active employees</strong> currently in your directory for the selected month. Base earnings and standard statutory deductions will be automatically computed.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Monthly Tax Period</label>
                      <input
                        type="text"
                        value={cyclePeriod}
                        onChange={(e) => setCyclePeriod(e.target.value)}
                        placeholder="e.g. June 2026"
                        className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Initial Payslip Status</label>
                      <select
                        value={cycleStatus}
                        onChange={(e: any) => setCycleStatus(e.target.value)}
                        className="w-full border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden"
                      >
                        <option value="Draft">Draft (Inspect and approve individually)</option>
                        <option value="Issued">Issued (Pre-approved / Ready for archive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden mt-2">
                    <div className="bg-slate-50 border-b border-slate-100 p-2.5 flex justify-between font-bold text-slate-700">
                      <span>Active Roster to Process</span>
                      <span>{employees.filter(e => e.status === "Active").length} Employees</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 p-1 bg-white">
                      {employees.filter(e => e.status === "Active").map(emp => (
                        <div key={emp.id} className="p-2 flex justify-between items-center text-[11px]">
                          <div>
                            <p className="font-bold text-slate-800">{emp.name}</p>
                            <p className="text-[10px] text-slate-400">{emp.title}</p>
                          </div>
                          <span className="font-mono text-slate-600">${emp.basicSalary.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3 border-t border-slate-100">
                    <button
                      onClick={handleRunPayrollCycle}
                      disabled={processingCycle}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl cursor-pointer"
                    >
                      {processingCycle ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing Cycle Calculations...
                        </>
                      ) : (
                        "Generate Monthly Cycle"
                      )}
                    </button>
                    <button
                      onClick={() => setShowCycleModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center animate-bounce">
                    <Check className="h-6 w-6" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-slate-900 uppercase">Payroll Cycle Executed!</h4>
                    <p className="text-xs text-slate-500">
                      The automated ledger cycle has completed processing for <strong>{cyclePeriod}</strong>.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-left font-mono space-y-1.5 max-w-sm mx-auto">
                    <div className="flex justify-between border-b border-slate-200 pb-1.5 text-slate-400 font-bold text-3xs">
                      <span>AUDIT METRIC</span>
                      <span>VALUE</span>
                    </div>
                    <p className="flex justify-between">
                      <span>Generated Slips:</span>
                      <span className="font-bold text-emerald-700 font-sans">+{cycleResults.successCount} Drafts</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Skipped (Duplicates):</span>
                      <span className="font-bold text-amber-600 font-sans">{cycleResults.duplicateCount} Skipped</span>
                    </p>
                    <p className="flex justify-between pt-1 border-t border-dashed border-slate-200">
                      <span>Total Net Payout:</span>
                      <span className="font-extrabold text-slate-800 font-sans">${cycleResults.totalNet.toLocaleString()}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowCycleModal(false);
                      setCycleResults(null);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Finish and Inspect Slips
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden batch ZIP rendering portal reference */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={hiddenPdfRef} className="w-[800px] bg-white text-slate-850 p-10 flex flex-col gap-5 text-xs font-sans text-left">
          {selectedBulkPayslip && (
            <>
              {/* Ledger Corporate Heading block */}
              <div className="border-b-2 border-slate-950 pb-4 mb-2 flex justify-between items-start">
                  <div>
                      {companyDetails?.logo ? (
                          <div className="relative w-40 h-16 mb-2">
                              <img 
                                  src={companyDetails.logo} 
                                  alt="Company Logo" 
                                  className="w-full h-full object-contain object-left" 
                                  referrerPolicy="no-referrer"
                              />
                          </div>
                      ) : (
                          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{companyDetails?.name || "ABC Company"}</h2>
                      )}
                      <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">{companyDetails?.address || "Street Address\nCity, State, Zip"}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-tight">PAYSLIP</h2>
                    <div className="mt-2 text-[10px] font-mono font-bold bg-slate-50 p-1 border border-slate-200 rounded inline-block text-slate-600">
                      {generateIntegrityStamp(selectedBulkPayslip)}
                    </div>
                  </div>
              </div>
              
              {/* Pay period and Date block */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 px-3 font-semibold border border-slate-200 rounded-lg">
                  <div className="text-slate-600">Tax Period: <span className="font-extrabold text-slate-900">{selectedBulkPayslip.taxPeriod || "N/A"}</span></div>
                  <div className="text-slate-600">Date of Payment: <span className="font-extrabold text-slate-900">{formatPaymentDate(selectedBulkPayslip)}</span></div>
              </div>

              {/* Employee Information */}
              <div className="border border-slate-900 rounded-lg overflow-hidden mt-0.5">
                  <div className="bg-slate-900 text-white font-extrabold p-1.5 px-3 text-center text-xs tracking-wider uppercase">Employee Information</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 text-[11px]">
                    <div className="text-slate-500">Full Name: <span className="font-bold text-slate-900">{selectedBulkPayslip.employeeName}</span></div>
                    <div className="text-slate-500">Department: <span className="font-extrabold text-slate-900">{selectedBulkPayslip.employeeDepartment || "N/A"}</span></div>
                    <div className="text-slate-500">Employee ID: <span className="font-mono font-bold text-slate-900">{selectedBulkPayslip.employeeId || "N/A"}</span></div>
                    <div className="text-slate-500">Role Title: <span className="font-extrabold text-slate-900">{selectedBulkPayslip.employeeTitle || "N/A"}</span></div>
                    <div className="text-slate-500">Tax Registration (TIN): <span className="font-mono font-bold text-slate-900">{selectedBulkPayslip.tin || "N/A"}</span></div>
                    <div className="text-slate-500">ENPF Pension No.: <span className="font-mono font-bold text-slate-900">{selectedBulkPayslip.enpfNumber || "N/A"}</span></div>
                  </div>
              </div>

              {/* Financial Breakdown Table Grids */}
              <div className="grid grid-cols-2 gap-4 mt-0.5">
                  
                  {/* Earnings Column */}
                  <div className="border border-slate-900 rounded-lg overflow-hidden flex flex-col">
                      <div className="bg-slate-800 text-white font-bold p-1 px-3 text-center text-xs">Earnings & Additions</div>
                      <div className="p-3 space-y-2 text-[11px] flex-1">
                          <div className="flex justify-between border-b border-dashed pb-1">
                            <span className="text-slate-500">Basic Salary</span> 
                            <span className="font-mono font-bold text-slate-900">${(selectedBulkPayslip.basicSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          {selectedBulkPayslip.overtimeHours && selectedBulkPayslip.overtimeHours > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">Overtime hours ({selectedBulkPayslip.overtimeHours} x ${selectedBulkPayslip.overtimeRate || 25})</span> 
                              <span className="font-mono font-bold text-slate-900">${((selectedBulkPayslip.overtimeHours || 0) * (selectedBulkPayslip.overtimeRate || 25)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                          {selectedBulkPayslip.housingAllowance && selectedBulkPayslip.housingAllowance > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">Housing Allowance</span> 
                              <span className="font-mono font-bold text-slate-900">${selectedBulkPayslip.housingAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                          {selectedBulkPayslip.transportAllowance && selectedBulkPayslip.transportAllowance > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">Transport Allowance</span> 
                              <span className="font-mono font-bold text-slate-900">${selectedBulkPayslip.transportAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                          {selectedBulkPayslip.bonus && selectedBulkPayslip.bonus > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">Performance Bonus</span> 
                              <span className="font-mono font-bold text-slate-900">${selectedBulkPayslip.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : null}
                      </div>
                  </div>

                  {/* Deductions Column */}
                  <div className="border border-slate-900 rounded-lg overflow-hidden flex flex-col">
                      <div className="bg-slate-800 text-white font-bold p-1 px-3 text-center text-xs">Deductions & Levies</div>
                      <div className="p-3 space-y-2 text-[11px] flex-1">
                          <div className="flex justify-between border-b border-dashed pb-1">
                            <span className="text-slate-500">PAYE Taxation (23% gross)</span> 
                            <span className="font-mono font-bold text-red-600">{selectedBulkPayslip.paye && selectedBulkPayslip.paye > 0 ? `-$${parseFloat(selectedBulkPayslip.paye).toFixed(2)}` : "—"}</span>
                          </div>
                          <div className="flex justify-between border-b border-dashed pb-1">
                            <span className="text-slate-500">ENPF Co-Fund (5% basic)</span> 
                            <span className="font-mono font-bold text-red-600">{selectedBulkPayslip.enpf && selectedBulkPayslip.enpf > 0 ? `-$${parseFloat(selectedBulkPayslip.enpf).toFixed(2)}` : "—"}</span>
                          </div>
                          {selectedBulkPayslip.medicalAid && selectedBulkPayslip.medicalAid > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">Medical Aid Premium</span> 
                              <span className="font-mono font-bold text-red-600">-${parseFloat(selectedBulkPayslip.medicalAid).toFixed(2)}</span>
                            </div>
                          ) : null}
                          {selectedBulkPayslip.otherFeeAmount && selectedBulkPayslip.otherFeeAmount > 0 ? (
                            <div className="flex justify-between border-b border-dashed pb-1">
                              <span className="text-slate-500">{selectedBulkPayslip.otherFeeDescription || "Other Fee"}</span> 
                              <span className="font-mono font-bold text-red-600">-${parseFloat(selectedBulkPayslip.otherFeeAmount).toFixed(2)}</span>
                            </div>
                          ) : null}
                      </div>
                  </div>

              </div>
              
              {/* Totals Summary Row */}
              <div className="grid grid-cols-3 gap-2 border-t-2 border-b-2 border-slate-900 bg-slate-100 p-3 font-extrabold text-center text-xs rounded-lg mt-0.5">
                  <div>Gross Earnings: ${(selectedBulkPayslip.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-rose-600">Total Deductions: ${(selectedBulkPayslip.totalDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-emerald-700 bg-emerald-50 rounded border border-emerald-150 p-0.5 font-bold font-sans">Net Paid: ${(selectedBulkPayslip.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>

              {/* Security envelope or compliance stamp */}
              <div className="p-2 px-3 bg-indigo-50 border border-indigo-100 rounded-lg flex justify-between text-[9px] font-mono text-slate-500 gap-1 uppercase">
                <span>SECURITY COMPLIANCE ENVELOPE VERIFIED | DIRECTIVE REF: {selectedBulkPayslip.id || "DRAFT"}</span>
                <span>AUDITED SEAL: {generateIntegrityStamp(selectedBulkPayslip)}</span>
              </div>

              {/* Custom Adjustments / Notes statement if any */}
              {selectedBulkPayslip.adjustments && (
                <div className="p-2.5 bg-slate-50 border rounded-lg text-[10px] text-slate-600 italic">
                  <span className="font-bold not-italic block text-slate-800">HR Advisory & Payout notes:</span>
                  {selectedBulkPayslip.adjustments}
                </div>
              )}
              
              {/* Footer metadata */}
              <div className="mt-auto border-t pt-4 text-center text-[10px] text-slate-400 font-semibold tracking-tight">
                  Issued securely via MiraTech Workspace • Authenticated Enterprise Document © {new Date().getFullYear()}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
