"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Building2, 
  CalendarDays, 
  ClipboardList, 
  BookOpen, 
  ShieldCheck, 
  FileSpreadsheet, 
  Send, 
  TrendingUp, 
  Calculator, 
  Clock, 
  History,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Save,
  Award,
  Star,
  ChevronRight,
  FileCheck,
  RefreshCw,
  LogOut,
  Mail,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  AlertCircle,
  HelpCircle,
  UserCheck
} from "lucide-react";
import { collection, doc, query, where, getDocs, updateDoc, addDoc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import Payroll from "./Payroll"; 
import PayrollHistoricalLogs from "./PayrollHistoricalLogs";
import { motion, AnimatePresence } from "motion/react";

// Structure definitions match actual Firestore employee model
interface Employee {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  basicSalary: number;
  tin: string;
  enpfNumber: string;
  status: "Active" | "Terminated" | "On Leave";
  createdAt?: string;
  phone?: string;
  address?: string;
  
  // Custom persistent arrays saved on the employee document directly
  attendance?: Array<{
    id: string;
    date: string;
    clockIn: string;
    clockOut: string;
    status: "Present" | "Late" | "Absent" | "Half Day" | "Excused";
    notes?: string;
  }>;
  leaves?: Array<{
    id: string;
    type: "Annual" | "Sick" | "Maternity" | "Study" | "Unpaid";
    startDate: string;
    endDate: string;
    reason: string;
    status: "Pending" | "Approved" | "Rejected";
    totalDays: number;
    requestedAt: string;
  }>;
  performanceReviews?: Array<{
    id: string;
    period: string; // e.g. Q2 2026, Annual 2026
    rating: number; // 1 to 5
    achievements: string;
    goals: string;
    comments: string;
    reviewer: string;
    date: string;
  }>;
  contract?: {
    type: "Full-time" | "Part-time" | "Contract" | "Internship";
    startDate: string;
    endDate: string;
    probationMonths: number;
    status: "Active" | "Expired" | "Suspended";
    terms: string;
  };
}

const HRManagement = ({ operationalData }: { operationalData: any }) => {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  // Resolve unified business tenant ID securely
  const businessId = currentUser?.companyId || currentUser?.businessId || importAuth.currentUser?.uid || "SYSTEM";

  // State elements
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");


  // Selected employee in active modal
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"profile" | "contracts" | "leave" | "attendance" | "performance">("profile");
  const [isHrSaving, setIsHrSaving] = useState(false);

  // Form states for attendance track
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attClockIn, setAttClockIn] = useState("09:00");
  const [attClockOut, setAttClockOut] = useState("17:00");
  const [attStatus, setAttStatus] = useState<"Present" | "Late" | "Absent" | "Half Day" | "Excused">("Present");
  const [attNotes, setAttNotes] = useState("");

  // Form states for Leave requests
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState<"Annual" | "Sick" | "Maternity" | "Study" | "Unpaid">("Annual");
  const [leaveReason, setLeaveReason] = useState("");

  // Form states for Performance evaluation
  const [performancePeriod, setPerformancePeriod] = useState("Mid-Year 2026");
  const [performanceRating, setPerformanceRating] = useState<number>(5);
  const [performanceAchievements, setPerformanceAchievements] = useState("");
  const [performanceGoals, setPerformanceGoals] = useState("");
  const [performanceComments, setPerformanceComments] = useState("");
  const [performanceReviewer, setPerformanceReviewer] = useState(currentUser?.name || "HR Director");

  // Form states for Contract Info
  const [contractType, setContractType] = useState<"Full-time" | "Part-time" | "Contract" | "Internship">("Full-time");
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractProbation, setContractProbation] = useState<number>(3);
  const [contractStatus, setContractStatus] = useState<"Active" | "Expired" | "Suspended">("Active");
  const [contractTerms, setContractTerms] = useState("");

  // Personal Info edit form states
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDept, setEditDept] = useState("Finance");
  const [editSalary, setEditSalary] = useState<number>(3500);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Terminated" | "On Leave">("Active");

  // Quick statistical items
  const statsTotal = employees.length;
  const statsActive = employees.filter(emp => emp.status === "Active").length;
  const statsOnLeave = employees.filter(emp => emp.status === "On Leave").length;
  const statsPendingLeaves = employees.reduce((acc, emp) => {
    const pendingCount = (emp.leaves || []).filter(l => l.status === "Pending").length;
    return acc + pendingCount;
  }, 0);

  // Fetch employees
  const fetchEmployeesData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "employees"),
        where("businessId", "==", businessId)
      );
      const snapshot = await getDocs(q);
      const data: Employee[] = [];
      snapshot.forEach(docSnap => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Employee);
      });
      setEmployees(data);
    } catch (err: any) {
      console.error("Error loaded HR ledger database:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, "employees");
      } catch (r) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Load selected employee details into form states
  const openHrModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setActiveModalTab("profile");

    // Initialize edit fields
    setEditName(emp.name || "");
    setEditTitle(emp.title || "");
    setEditDept(emp.department || "Finance");
    setEditSalary(emp.basicSalary || 3500);
    setEditEmail(emp.email || "");
    setEditPhone(emp.phone || "");
    setEditAddress(emp.address || "");
    setEditStatus(emp.status || "Active");

    // Initialize Contract details
    setContractType(emp.contract?.type || "Full-time");
    setContractStartDate(emp.contract?.startDate || new Date().toISOString().split("T")[0]);
    setContractEndDate(emp.contract?.endDate || "");
    setContractProbation(emp.contract?.probationMonths || 3);
    setContractStatus(emp.contract?.status || "Active");
    setContractTerms(emp.contract?.terms || "");

    // Reset list inputs
    setAttDate(new Date().toISOString().split("T")[0]);
    setAttClockIn("09:00");
    setAttClockOut("17:00");
    setAttStatus("Present");
    setAttNotes("");

    setLeaveStartDate(new Date().toISOString().split("T")[0]);
    setLeaveEndDate(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
    setLeaveType("Annual");
    setLeaveReason("");

    setPerformancePeriod("Mid-Year 2026");
    setPerformanceRating(5);
    setPerformanceAchievements("");
    setPerformanceGoals("");
    setPerformanceComments("");
    setPerformanceReviewer(currentUser?.name || "HR Director");
  };

  // Safe Cloud-ledgers dynamic Firestore sync
  const handleUpdateEmployeeHR = async (updatedFields: Partial<Employee>): Promise<boolean> => {
    if (!selectedEmployee) return false;
    setIsHrSaving(true);
    try {
      const docRef = doc(db, "employees", selectedEmployee.id);
      await updateDoc(docRef, updatedFields);
      
      // Sync local state
      setEmployees(prev => prev.map(emp => emp.id === selectedEmployee.id ? { ...emp, ...updatedFields } : emp));
      setSelectedEmployee(prev => prev ? { ...prev, ...updatedFields } : null);

      // Auditing
      await logAction(
        "HR_EMPLOYEE_RECORD_SYNCED",
        `HR operations verified updates for ${selectedEmployee.name}. Details: ${Object.keys(updatedFields).join(", ")}.`,
        businessId,
        0
      );

      addToast("Employee HR ledger updated in real-time cloud data", "success");
      return true;
    } catch (err: any) {
      console.error(err);
      addToast("Failed to write update: " + err.message, "error");
      try {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${selectedEmployee.id}`);
      } catch (r) {}
      return false;
    } finally {
      setIsHrSaving(false);
    }
  };

  // Profile Information Save
  const saveProfileInfo = async () => {
    if (!selectedEmployee) return;
    if (!editName || !editEmail || !editTitle) {
      addToast("Employee Name, Email and Title cannot be blank", "warning");
      return;
    }
    await handleUpdateEmployeeHR({
      name: editName,
      title: editTitle,
      department: editDept,
      basicSalary: Number(editSalary),
      email: editEmail,
      phone: editPhone,
      address: editAddress,
      status: editStatus
    });
  };

  // Contract Details Save
  const saveContractDetails = async () => {
    if (!selectedEmployee) return;
    const contractObj = {
      type: contractType,
      startDate: contractStartDate,
      endDate: contractEndDate,
      probationMonths: Number(contractProbation),
      status: contractStatus,
      terms: contractTerms
    };
    await handleUpdateEmployeeHR({ contract: contractObj });
  };

  // Log inline Attendance
  const addAttendanceRecord = async () => {
    if (!selectedEmployee) return;
    const newRecord = {
      id: "ATT-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      date: attDate,
      clockIn: attClockIn,
      clockOut: attClockOut,
      status: attStatus,
      notes: attNotes
    };

    const currentAttendance = selectedEmployee.attendance || [];
    // Prevent duplicated date logging for the same employee
    const dateExists = currentAttendance.some(item => item.date === attDate);
    if (dateExists) {
      addToast("An attendance record is already logged for " + attDate, "warning");
      return;
    }

    const updatedAttendance = [newRecord, ...currentAttendance];
    
    // Sort array chronologically by date desc
    updatedAttendance.sort((a, b) => b.date.localeCompare(a.date));

    const result = await handleUpdateEmployeeHR({ attendance: updatedAttendance });
    if (result !== false) {
      setAttNotes(""); // reset notes area
    }
  };

  // Submit Leave request (Manager/HR on behalf of employee)
  const addLeaveRequest = async () => {
    if (!selectedEmployee) return;

    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (end < start) {
      addToast("Leave End Date cannot precede Start Date", "warning");
      return;
    }

    const durationTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(durationTime / (1000 * 60 * 60 * 24)) + 1;

    const newLeave = {
      id: "LV-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      type: leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: leaveReason,
      status: "Approved" as const, // Audited by default, auto-approved when logged by HR / Admin
      totalDays,
      requestedAt: new Date().toISOString()
    };

    const currentLeaves = selectedEmployee.leaves || [];
    const updatedLeaves = [newLeave, ...currentLeaves];
    updatedLeaves.sort((a, b) => b.startDate.localeCompare(a.startDate));

    // Auto update status to "On Leave" if active leave spans today
    const todayStr = new Date().toISOString().split("T")[0];
    let customStatusUpdate: Partial<Employee> = { leaves: updatedLeaves };
    
    if (leaveStartDate <= todayStr && leaveEndDate >= todayStr) {
      customStatusUpdate.status = "On Leave";
      addToast(`Leave logged. Switched ${selectedEmployee.name} status to 'On Leave' dynamically`, "info");
    }

    const result = await handleUpdateEmployeeHR(customStatusUpdate);
    if (result !== false) {
      setLeaveReason("");
    }
  };

  // Change Leave Request status (Approve or Reject pending ones)
  const updateLeaveStatus = async (leaveId: string, status: "Approved" | "Rejected") => {
    if (!selectedEmployee) return;
    const updatedLeaves = (selectedEmployee.leaves || []).map(l => {
      if (l.id === leaveId) {
        return { ...l, status };
      }
      return l;
    });

    const targetLeave = (selectedEmployee.leaves || []).find(l => l.id === leaveId);
    let extraUpdates: Partial<Employee> = { leaves: updatedLeaves };

    if (targetLeave && status === "Approved") {
      const todayStr = new Date().toISOString().split("T")[0];
      if (targetLeave.startDate <= todayStr && targetLeave.endDate >= todayStr) {
        extraUpdates.status = "On Leave";
      }
    }

    await handleUpdateEmployeeHR(extraUpdates);
  };

  // Remove Leave request helper
  const deleteLeaveRequest = async (leaveId: string) => {
    if (!selectedEmployee) return;
    const updatedLeaves = (selectedEmployee.leaves || []).filter(l => l.id !== leaveId);
    await handleUpdateEmployeeHR({ leaves: updatedLeaves });
  };

  // Add Performance Review
  const addPerformanceReview = async () => {
    if (!selectedEmployee) return;
    const newReview = {
      id: "REV-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      period: performancePeriod,
      rating: performanceRating,
      achievements: performanceAchievements,
      goals: performanceGoals,
      comments: performanceComments,
      reviewer: performanceReviewer,
      date: new Date().toLocaleDateString()
    };

    const currentReviews = selectedEmployee.performanceReviews || [];
    const updatedReviews = [newReview, ...currentReviews];

    const result = await handleUpdateEmployeeHR({ performanceReviews: updatedReviews });
    if (result !== false) {
      setPerformanceAchievements("");
      setPerformanceGoals("");
      setPerformanceComments("");
    }
  };

  // Filter Employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDeptFilter === "All" || emp.department === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === "All" || emp.status === selectedStatusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. Upper KPI Statistics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Roster Size", value: statsTotal, description: "Total employees onboard", icon: Users, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "On Duty", value: statsActive, description: "Regular active operational", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { label: "On Approved Leave", value: statsOnLeave, description: "With scheduled dynamic absence", icon: CalendarDays, color: "text-amber-500 bg-amber-50 border-amber-100" },
          { label: "Action Pending Leaves", value: statsPendingLeaves, description: "Leave requests needing attention", icon: Clock, color: "text-rose-500 bg-rose-50 border-rose-100" }
        ].map((kpi, idx) => (
          <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{kpi.label}</span>
              <span className="text-2xl font-black tracking-tight text-slate-900 mt-1 block">{kpi.value}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{kpi.description}</span>
            </div>
            <div className={`p-2.5 rounded-xl border ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. Directory control filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden transition"
          />
        </div>

        {/* Directory drop downs */}
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="w-1/2 md:w-40">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
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
          </div>

          <div className="w-1/2 md:w-40">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Company Employees Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <Clock className="w-8 h-8 animate-spin text-slate-400" />
            <p className="text-xs font-bold text-slate-400">Syncing enterprise HR directories...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-16 text-center bg-slate-50/50 flex flex-col items-center justify-center space-y-3 border-b">
            <Users className="w-10 h-10 text-slate-350" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">No Employees Registered</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">There are no employees coordinating with your selected filters. Onboard staff in the Payroll tab to start managing. </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                  <th className="py-3.5 px-5">Personnel</th>
                  <th className="py-3.5 px-5">Department & Job Title</th>
                  <th className="py-3.5 px-5">Leaves Logged</th>
                  <th className="py-3.5 px-5">Attendance Rate</th>
                  <th className="py-3.5 px-5">Employment Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const initial_letter = emp.name.charAt(0);
                  // Calculate attendance metrics
                  const totalLogged = (emp.attendance || []).length;
                  const presentCount = (emp.attendance || []).filter(a => a.status === "Present" || a.status === "Late" || a.status === "Half Day").length;
                  const onTimeCount = (emp.attendance || []).filter(a => a.status === "Present").length;
                  const attendanceRatio = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : null;
                  const onTimeRatio = totalLogged > 0 ? Math.round((onTimeCount / totalLogged) * 100) : null;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition duration-150">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center border border-slate-200 text-slate-700 uppercase">
                            {initial_letter}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-snug">{emp.name}</span>
                            <span className="text-[10px] text-slate-400 font-medium block">{emp.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-bold text-slate-800 block">{emp.title}</span>
                        <span className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">{emp.department}</span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-extrabold text-slate-700">
                            {(emp.leaves || []).filter(l => l.status === "Approved").reduce((sum, l) => sum + l.totalDays, 0)} days approved
                          </span>
                          {(emp.leaves || []).some(l => l.status === "Pending") && (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wide text-rose-600 bg-rose-50 border border-rose-100 uppercase animate-pulse">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {attendanceRatio !== null ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">{attendanceRatio}%</span>
                              <span className="text-[9px] text-slate-400">(On-Time: {onTimeRatio}%)</span>
                            </div>
                            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                              <div 
                                className={`h-full rounded-full ${attendanceRatio > 85 ? "bg-emerald-500" : attendanceRatio > 70 ? "bg-amber-400" : "bg-rose-500"}`}
                                style={{ width: `${attendanceRatio}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No attendance logged</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          emp.status === "Active" 
                            ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                            : emp.status === "On Leave"
                            ? "bg-amber-50 border-amber-150 text-amber-700"
                            : "bg-rose-50 border-rose-150 text-rose-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            emp.status === "Active" ? "bg-emerald-500" : emp.status === "On Leave" ? "bg-amber-500" : "bg-rose-500"
                          }`} />
                          {emp.status || "Active"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => openHrModal(emp)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-2xs font-extrabold shadow-sm transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3" />
                          HR Operations
                          <ChevronRight className="w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Complete, interactive HR Operations slideover-modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-100 flex items-center justify-end p-0 md:p-6 bg-slate-900/60 backdrop-blur-xs">
            {/* Modal Container */}
            <motion.div 
              initial={{ x: "100%", opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.9 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-4xl h-full md:h-[calc(100vh-48px)] bg-white border border-slate-200 rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white text-sm font-extrabold flex items-center justify-center uppercase">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      {selectedEmployee.name} 
                      <span className="text-[10px] text-slate-400 font-mono tracking-tight font-bold">({selectedEmployee.id})</span>
                    </h3>
                    <p className="text-2xs text-slate-400 font-bold uppercase tracking-wider">{selectedEmployee.title} • {selectedEmployee.department}</p>
                  </div>
                </div>
                
                  <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  <X className="w-4 h-4 inline" /> Close
                </button>
              </div>

              {/* Sub-tab modal Navigation */}
              <div className="flex border-b border-slate-200 text-xs bg-white overflow-x-auto overflow-y-hidden">
                {[
                  { id: "profile", label: "Profile & Designation", icon: Users },
                  { id: "contracts", label: "Legal Contract", icon: FileCheck },
                  { id: "leave", label: "Absences & Leaves", icon: CalendarDays },
                  { id: "attendance", label: "Attendance Sheet", icon: Clock },
                  { id: "performance", label: "Appraisal Hub", icon: Award }
                ].map((tab) => {
                  const isActive = activeModalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModalTab(tab.id as any)}
                      className={`py-3 px-5 border-b-2 font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                        isActive 
                          ? "border-slate-900 text-slate-900 bg-slate-50/40" 
                          : "border-transparent text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <tab.icon className={`w-4 h-4 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Modal Core Panels Scroll area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                
                {/* PROFILE INFORMATION PANEL */}
                {activeModalTab === "profile" && (
                  <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm border-b pb-2">Modify General HR Details</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Employee Full Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-slate-400 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Business Title / Designation</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Allocated Department</label>
                          <select
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-medium"
                          >
                            <option value="Finance">Finance</option>
                            <option value="HR">HR</option>
                            <option value="Engineering">Engineering</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Customer Success">Customer Success</option>
                            <option value="Operations">Operations</option>
                            <option value="Legal">Legal</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Base Monthly Salary ($)</label>
                          <input
                            type="number"
                            value={editSalary}
                            onChange={(e) => setEditSalary(Number(e.target.value))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Contact Phone</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Overall Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-black text-slate-700"
                          >
                            <option value="Active">Active</option>
                            <option value="On Leave">On Leave</option>
                            <option value="Terminated">Terminated</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-xs pt-1">
                        <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Street Address</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                      <h4 className="font-bold text-slate-900 text-sm border-b pb-2">Statutory Identifiers</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div className="p-3 bg-slate-55 border border-slate-100 rounded-lg bg-slate-50">
                          <span className="text-3xs block text-slate-400 font-bold font-sans">TAX IDENTIFICATION NUMBER (TIN)</span>
                          <span className="font-bold text-slate-800 text-[11px] block mt-1">{selectedEmployee.tin || "Pending Provision"}</span>
                        </div>
                        <div className="p-3 bg-slate-55 border border-slate-100 rounded-lg bg-slate-50">
                          <span className="text-3xs block text-slate-400 font-bold font-sans">ENPF IDENTIFICATION NUMBER</span>
                          <span className="font-bold text-slate-800 text-[11px] block mt-1">{selectedEmployee.enpfNumber || "Pending Allocation"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={saveProfileInfo}
                        disabled={isHrSaving}
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition"
                      >
                        {isHrSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save General Details
                      </button>
                    </div>
                  </div>
                )}

                {/* LEGAL CONTRACTS PANEL */}
                {activeModalTab === "contracts" && (
                  <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <FileCheck className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-slate-900 text-sm">Employment Contract Agreement</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Contract Type</label>
                          <select
                            value={contractType}
                            onChange={(e) => setContractType(e.target.value as any)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold"
                          >
                            <option value="Full-time">Full-time Permanent</option>
                            <option value="Part-time">Part-time Operations</option>
                            <option value="Contract">Fixed-Term Contract</option>
                            <option value="Internship">Temporary Internship</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Contract Status</label>
                          <select
                            value={contractStatus}
                            onChange={(e) => setContractStatus(e.target.value as any)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold"
                          >
                            <option value="Active">Active Operational</option>
                            <option value="Expired">Term Expired</option>
                            <option value="Suspended">Suspended Agreement</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Effective Start Date</label>
                          <input
                            type="date"
                            value={contractStartDate}
                            onChange={(e) => setContractStartDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Fixed End Date (Leave empty if Permanent)</label>
                          <input
                            type="date"
                            value={contractEndDate}
                            onChange={(e) => setContractEndDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Probationary Period (in months)</label>
                        <input
                          type="number"
                          value={contractProbation}
                          onChange={(e) => setContractProbation(Number(e.target.value))}
                          className="w-32 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Legal Clauses & Custom Terms</label>
                        <textarea
                          rows={4}
                          value={contractTerms}
                          onChange={(e) => setContractTerms(e.target.value)}
                          placeholder="Type clauses regarding benefits, code of conduct, equity details, or probation criteria..."
                          className="w-full text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={saveContractDetails}
                        disabled={isHrSaving}
                        className="px-6 py-2 bg-indigo-650 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition"
                      >
                        {isHrSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Contract Parameters
                      </button>
                    </div>
                  </div>
                )}

                {/* ABSENCES AND LEAVES PANEL */}
                {activeModalTab === "leave" && (
                  <div className="space-y-6">
                    {/* Add Leave */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-emerald-600" /> Log Scheduled Absence or Leave
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Leave Category</label>
                          <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value as any)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold text-slate-700"
                          >
                            <option value="Annual">Annual Paid Leave</option>
                            <option value="Sick">Sick Leave</option>
                            <option value="Maternity">Maternity/Paternity</option>
                            <option value="Study">Authorized Study Leave</option>
                            <option value="Unpaid">Unpaid Personal Leave</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                          <input
                            type="date"
                            value={leaveStartDate}
                            onChange={(e) => setLeaveStartDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">End Date</label>
                          <input
                            type="date"
                            value={leaveEndDate}
                            onChange={(e) => setLeaveEndDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Reason for Absence</label>
                        <input
                          type="text"
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder="Identify medical prescription details, flight itineraries or personal matters..."
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={addLeaveRequest}
                          disabled={isHrSaving}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                        >
                          <Plus className="w-4 h-4" /> Log & Approve Leave
                        </button>
                      </div>
                    </div>

                    {/* Historical Table */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">Archived Absences Log</h4>
                      
                      {(!selectedEmployee.leaves || selectedEmployee.leaves.length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed rounded-lg bg-slate-50/50">No leave history recorded to date</p>
                      ) : (
                        <div className="overflow-x-auto border rounded-xl">
                          <table className="w-full text-left text-2xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b text-slate-400 font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-4">Leave Type</th>
                                <th className="py-2.5 px-4">Timeline</th>
                                <th className="py-2.5 px-4">Absence Span</th>
                                <th className="py-2.5 px-4">Reason</th>
                                <th className="py-2.5 px-4">Approval Status</th>
                                <th className="py-2.5 px-4 text-right">Terminations</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-sans">
                              {selectedEmployee.leaves.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50/50">
                                  <td className="py-3 px-4 font-bold text-slate-800">{l.type}</td>
                                  <td className="py-3 px-4 font-mono text-slate-500">{l.startDate} to {l.endDate}</td>
                                  <td className="py-3 px-4 font-bold text-slate-700">{l.totalDays} day(s)</td>
                                  <td className="py-3 px-4 max-w-xs truncate text-slate-500 font-medium" title={l.reason}>{l.reason || "—"}</td>
                                  <td className="py-3 px-4">
                                    {l.status === "Pending" ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => updateLeaveStatus(l.id, "Approved")}
                                          className="p-1 text-emerald-600 bg-emerald-50 border border-emerald-150 hover:bg-emerald-100 rounded cursor-pointer"
                                          title="Approve request"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => updateLeaveStatus(l.id, "Rejected")}
                                          className="p-1 text-rose-600 bg-rose-50 border border-rose-150 hover:bg-rose-100 rounded cursor-pointer"
                                          title="Reject request"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                        l.status === "Approved" ? "bg-emerald-50 border-emerald-150 text-emerald-700" : "bg-rose-50 border-rose-150 text-rose-700"
                                      }`}>
                                        {l.status}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => deleteLeaveRequest(l.id)}
                                      className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-100 text-slate-450 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ATTENDANCE PANEL */}
                {activeModalTab === "attendance" && (
                  <div className="space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left: Input log */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 md:col-span-1 h-fit">
                        <h4 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-indigo-600" /> Add Clock-In Card
                        </h4>
                        
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                            <input
                              type="date"
                              value={attDate}
                              onChange={(e) => setAttDate(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Arrival Time</label>
                              <input
                                type="text"
                                value={attClockIn}
                                onChange={(e) => setAttClockIn(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Departure</label>
                              <input
                                type="text"
                                value={attClockOut}
                                onChange={(e) => setAttClockOut(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Compliance Status</label>
                            <select
                              value={attStatus}
                              onChange={(e) => setAttStatus(e.target.value as any)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold"
                            >
                              <option value="Present">Present (On Time)</option>
                              <option value="Late">Tardy / Late Shift</option>
                              <option value="Absent">Unexcused Absence</option>
                              <option value="Half Day">Half Day Shift</option>
                              <option value="Excused">Excused Absence</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Desk Notes</label>
                            <input
                              type="text"
                              value={attNotes}
                              onChange={(e) => setAttNotes(e.target.value)}
                              placeholder="e.g. Internet breakdown fallback, Doctor's note..."
                              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                            />
                          </div>

                          <button
                            onClick={addAttendanceRecord}
                            disabled={isHrSaving}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition duration-150 cursor-pointer"
                          >
                            <Check className="w-4 h-4" /> Save Record stamp
                          </button>
                        </div>
                      </div>

                      {/* Right: Listed Table */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 md:col-span-2">
                        <h4 className="font-bold text-slate-900 text-sm">Attendance Logs history</h4>
                        
                        {(!selectedEmployee.attendance || selectedEmployee.attendance.length === 0) ? (
                          <p className="text-xs text-slate-400 italic py-10 text-center border border-dashed rounded-lg bg-slate-50/50">No attendance clock-in records saved</p>
                        ) : (
                          <div className="overflow-x-auto border rounded-xl">
                            <table className="w-full text-left text-2xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4">Date stamp</th>
                                  <th className="py-2.5 px-4">Active hours</th>
                                  <th className="py-2.5 px-4">Compliance Status</th>
                                  <th className="py-2.5 px-4">Details / Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-sans">
                                {selectedEmployee.attendance.map((a) => (
                                  <tr key={a.id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-4 font-bold text-slate-800 font-mono">{a.date}</td>
                                    <td className="py-3 px-4 font-mono text-slate-500">{a.clockIn} — {a.clockOut}</td>
                                    <td className="py-3 px-4">
                                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                                        a.status === "Present" 
                                          ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                                          : a.status === "Late"
                                          ? "bg-amber-50 border-amber-150 text-amber-700"
                                          : "bg-rose-50 border-rose-150 text-rose-700"
                                      }`}>
                                        {a.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate font-medium">{a.notes || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* PERFORMANCE APPRAISALS PANEL */}
                {activeModalTab === "performance" && (
                  <div className="space-y-6">
                    {/* Add Review */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-1.5">
                        <Award className="w-4.5 h-4.5 text-indigo-600" /> Create Performance Assessment
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Review Period</label>
                          <input
                            type="text"
                            value={performancePeriod}
                            onChange={(e) => setPerformancePeriod(e.target.value)}
                            placeholder="e.g. Mid-Year 2026, Q2 2026"
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Lead Appraiser (Reviewer)</label>
                          <input
                            type="text"
                            value={performanceReviewer}
                            onChange={(e) => setPerformanceReviewer(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Rating Score</label>
                          <div className="flex items-center gap-1 mt-1.5">
                            {[1, 2, 3, 4, 5].map((stars) => (
                              <button
                                key={stars}
                                type="button"
                                onClick={() => setPerformanceRating(stars)}
                                className="p-0.5 hover:scale-110 duration-100 transition cursor-pointer"
                              >
                                <Star className={`w-5 h-5 ${stars <= performanceRating ? "fill-amber-400 text-amber-500" : "text-slate-200"}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Key Contributions & Achievements</label>
                          <textarea
                            rows={3}
                            value={performanceAchievements}
                            onChange={(e) => setPerformanceAchievements(e.target.value)}
                            placeholder="Identify major milestones, successful deliveries, process optimization..."
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Opportunities for Growth & Goals</label>
                          <textarea
                            rows={3}
                            value={performanceGoals}
                            onChange={(e) => setPerformanceGoals(e.target.value)}
                            placeholder="Define development goals, upcoming KPIs or target improvements..."
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-3xs font-black text-slate-400 uppercase tracking-wider block mb-1">Assessment Summary & Comments</label>
                        <textarea
                          rows={2}
                          value={performanceComments}
                          onChange={(e) => setPerformanceComments(e.target.value)}
                          placeholder="Provide supportive direct feedback about workplace attributes..."
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={addPerformanceReview}
                          disabled={isHrSaving}
                          className="px-5 py-2 bg-indigo-600 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm cursor-pointer transition"
                        >
                          <Plus className="w-4 h-4" /> Save Appraisal Card
                        </button>
                      </div>
                    </div>

                    {/* Review Archive card list */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">Historical Appraisal records</h4>
                      
                      {(!selectedEmployee.performanceReviews || selectedEmployee.performanceReviews.length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-8 text-center border border-dashed rounded-lg bg-slate-50/50">No prior evaluations completed regarding this employee</p>
                      ) : (
                        <div className="space-y-4">
                          {selectedEmployee.performanceReviews.map((rev) => (
                            <div key={rev.id} className="p-4 border border-slate-150 rounded-xl bg-slate-50/50 space-y-3 font-sans text-xs">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div>
                                  <span className="font-bold text-slate-800 uppercase tracking-tight text-[11px] block">{rev.period} Assessment</span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">Author: <strong className="text-slate-600">{rev.reviewer}</strong> on {rev.date}</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((st) => (
                                    <Star key={st} className={`w-3.5 h-3.5 ${st <= rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-2.5 border border-slate-100 rounded-lg">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Achievements & Impact</span>
                                  <p className="text-2xs text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">{rev.achievements || "—"}</p>
                                </div>
                                <div className="bg-white p-2.5 border border-slate-100 rounded-lg">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Development & Future Milestones</span>
                                  <p className="text-2xs text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">{rev.goals || "—"}</p>
                                </div>
                              </div>

                              <div className="p-2.5 bg-indigo-50/40 border border-indigo-100/50 rounded-lg">
                                <span className="text-[9px] font-extrabold text-indigo-800 uppercase tracking-wider block mb-1">Appraiser notes summary</span>
                                <p className="text-2xs text-indigo-950 font-medium italic">&ldquo;{rev.comments || "No general comments provided."}&rdquo;</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default function PayrollAndHR({ operationalData }: { operationalData?: any }) {
  const [activeModule, setActiveModule] = useState<"payroll" | "hr" | "history">("payroll");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <button
          onClick={() => setActiveModule("payroll")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${activeModule === 'payroll' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-150 border border-slate-250 text-slate-600 hover:bg-slate-200'}`}
        >
          <Calculator className="w-4 h-4" />
          Payroll
        </button>
        <button
          onClick={() => setActiveModule("hr")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${activeModule === 'hr' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-150 border border-slate-250 text-slate-600 hover:bg-slate-200'}`}
        >
          <Users className="w-4 h-4" />
          HR Operations
        </button>
        <button
          onClick={() => setActiveModule("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${activeModule === 'history' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-150 border border-slate-250 text-slate-600 hover:bg-slate-200'}`}
        >
          <History className="w-4 h-4" />
          Historical Logs
        </button>
      </div>

      <div>
        {activeModule === "payroll" ? (
          <Payroll />
        ) : activeModule === "hr" ? (
          <HRManagement operationalData={operationalData} />
        ) : (
          <PayrollHistoricalLogs />
        )}
      </div>
    </div>
  );
}
