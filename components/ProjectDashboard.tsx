"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useUserStore, useToastStore } from "../lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, AreaChart, Area } from "recharts";
import AddProjectModal from "./AddProjectModal";
import ProjectDetailsModal from "./ProjectDetailsModal";
import { 
  Plus, 
  FolderKanban, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  User, 
  Trash2, 
  Clock, 
  Tag, 
  Briefcase, 
  CheckCircle2, 
  ChevronRight, 
  TrendingUp, 
  PieChart as PieIcon,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
  MessageSquare
} from "lucide-react";
import EntityActivityDrawer from "./EntityActivityDrawer";
import { getDocs, query, where } from "firebase/firestore";

export default function ProjectDashboard({ companyId }: { companyId: string }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const [projects, setProjects] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<any | null>(null);
  const [activeDiscussionProject, setActiveDiscussionProject] = useState<{ id: string; name: string } | null>(null);

  // Search & Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Local state for inline edits to avoid lag
  const [editingFundsId, setEditingFundsId] = useState<string | null>(null);
  const [tempFundsVal, setTempFundsVal] = useState<number>(0);

  useEffect(() => {
    if (!companyId) return;
    const pRef = collection(db, "companies", companyId, "projects");
    const unsubP = onSnapshot(pRef, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setProjects(list);
    });
    const iRef = collection(db, "companies", companyId, "invoices");
    const unsubI = onSnapshot(iRef, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setInvoices(list);
    });
    
    async function loadAllCustomers() {
      const list: any[] = [];
      try {
        const subSnap = await getDocs(collection(db, "companies", companyId, "customers"));
        subSnap.forEach(d => list.push({ id: d.id, ...d.data() }));

        const rootSnap = await getDocs(query(collection(db, "customers"), where("businessId", "==", companyId)));
        rootSnap.forEach(d => {
          if (!list.some(c => c.id === d.id)) {
            list.push({ id: d.id, ...d.data() });
          }
        });
        setCustomers(list);
      } catch (err) {
        console.error("Error loading customers in ProjectDashboard:", err);
      }
    }
    loadAllCustomers();

    const cRef = collection(db, "companies", companyId, "customers");
    const unsubC = onSnapshot(cRef, (snap) => {
        loadAllCustomers();
    });

    return () => { unsubP(); unsubI(); unsubC(); };
  }, [companyId]);

  // Handle Project Deletion
  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete project "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "companies", companyId, "projects", id));
      addToast(`Project "${name}" was successfully removed from governance database.`, "success");
    } catch (err: any) {
      addToast(`Failed to delete project: ${err.message}`, "error");
    }
  };

  // Handle Inline Project Status Update
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "companies", companyId, "projects", id), { status: newStatus });
      addToast(`Project status updated successfully.`, "success");
    } catch (err: any) {
      addToast(`Failed to update status: ${err.message}`, "error");
    }
  };

  // Handle Inline Allocated Funds Top-up
  const handleUpdateAllocatedFunds = async (id: string, currentBudget: number) => {
    if (tempFundsVal > currentBudget) {
      if (!confirm(`Released funds ($${tempFundsVal.toLocaleString()}) exceed the registered project budget ($${currentBudget.toLocaleString()}). Proceed anyway?`)) {
        return;
      }
    }
    try {
      await updateDoc(doc(db, "companies", companyId, "projects", id), { allocatedFunds: Number(tempFundsVal) || 0 });
      addToast(`Released project funding adjusted successfully.`, "success");
      setEditingFundsId(null);
    } catch (err: any) {
      addToast(`Failed to update funding: ${err.message}`, "error");
    }
  };

  // Calculate Metrics
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(p => p.status === "active").length;
  const planningProjectsCount = projects.filter(p => p.status === "planning").length;
  const completedProjectsCount = projects.filter(p => p.status === "completed").length;

  const totalRegisteredBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const totalAllocatedFunds = projects.reduce((sum, p) => sum + (Number(p.allocatedFunds) || 0), 0);
  const totalInvoicedInCompany = invoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  // Match and Filter Projects
  const filteredProjects = projects.filter(p => {
    const clientName = customers.find(c => c.id === p.clientId)?.name || "";
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectManager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || p.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Recharts Chart Data
  const chartData = filteredProjects.map(p => {
    const projectInvoices = invoices.filter(i => i.projectId === p.id);
    const totalInvoiced = projectInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    return { 
      name: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name, 
      Budget: p.budget || 0, 
      Released: p.allocatedFunds || 0,
      Invoiced: totalInvoiced 
    };
  });

  // Helper: Format Dates Elegantly
  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper: Calculate Timeframe Length
  const calculateDuration = (start: string, end: string) => {
    if (!start) return "N/A";
    if (!end) return "Ongoing timeline";
    try {
      const sDate = new Date(start);
      const eDate = new Date(end);
      const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const remainingDays = diffDays % 30;

      if (years > 0) return `${years}y ${months}m (${diffDays} days)`;
      if (months > 0) return `${months}m ${remainingDays}d (${diffDays} days)`;
      return `${diffDays} days`;
    } catch (e) {
      return "N/A";
    }
  };

  // Helper: Status badge color maps
  const getStatusBadge = (status: string) => {
    switch(status) {
      case "active":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-55 text-emerald-700 border border-emerald-200">⚡ Active</span>;
      case "planning":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-55 text-blue-700 border border-blue-200">📋 Planning</span>;
      case "on_hold":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-55 text-amber-700 border border-amber-200">⏸️ On Hold</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-55 text-indigo-700 border border-indigo-200">✅ Completed</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">🛑 Archived</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">{status}</span>;
    }
  };

  // Helper: Priority color maps
  const getPriorityBadge = (prio: string) => {
    switch(prio) {
      case "high":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-600 border border-red-150">🚨 High Priority</span>;
      case "medium":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-600 border border-orange-150">🟡 Medium</span>;
      case "low":
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-150">🟢 Low</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add Project Controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b pb-4">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" /> Executive Project Directory & Funding Governance
          </h3>
          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
            Register client-linked engagements, configure execution timelines, authorize capital disbursements, and oversee project delivery metrics.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Register New Project
        </button>
      </div>

      {/* KPI Performance Summary Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-center gap-3.5 shadow-4xs">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Active Engagements</p>
            <h4 className="text-base font-black text-slate-900">{activeProjectsCount} <span className="text-[10px] font-medium text-slate-500">of {totalProjectsCount} total</span></h4>
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-center gap-3.5 shadow-4xs">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Project Budgets</p>
            <h4 className="text-base font-black text-slate-900">${totalRegisteredBudget.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-center gap-3.5 shadow-4xs">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Released / Disbursed Funds</p>
            <h4 className="text-base font-black text-emerald-700">${totalAllocatedFunds.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-center gap-3.5 shadow-4xs">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Disbursement Rate</p>
            <h4 className="text-base font-black text-slate-900">
              {totalRegisteredBudget > 0 ? ((totalAllocatedFunds / totalRegisteredBudget) * 100).toFixed(1) : "0.0"}%
            </h4>
          </div>
        </div>

      </div>

      {/* Corporate Visualizer Financial Chart */}
      {filteredProjects.length > 0 && (
        <div className="bg-white p-5 border border-slate-150 rounded-3xl shadow-4xs space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <PieIcon className="w-4.5 h-4.5 text-blue-600" /> Capital Disbursed & Invoiced Breakdown
              </h4>
              <p className="text-[9px] text-slate-400 font-medium">Comparison between Project Target Budget, Active Funding Disbursements, and Clients Billed Invoiced</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={9} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                <Bar name="Target Budget" dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar name="Released Funds" dataKey="Released" fill="#c084fc" radius={[4, 4, 0, 0]} />
                <Bar name="Client Invoiced" dataKey="Invoiced" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grid Directory: Search, Filters, and List */}
      <div className="space-y-4">
        
        {/* Search and Filters Header bar */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-4xs">
          
          <div className="relative w-full md:w-80 flex items-center">
            <Search className="absolute left-3.5 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects, PMs, clients, scope..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center justify-start md:justify-end">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] text-slate-500 font-bold uppercase">Filter:</span>
            </div>
            
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-600 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="planning">Planning / Backlog</option>
              <option value="active">Active Execution</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Archived</option>
            </select>

            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-600 focus:outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

        </div>

        {/* Project directory empty state */}
        {filteredProjects.length === 0 ? (
          <div className="bg-white border border-slate-150 rounded-2xl p-10 text-center text-slate-400 shadow-4xs space-y-2">
            <FolderKanban className="w-8 h-8 mx-auto text-slate-300" />
            <h4 className="text-xs font-bold text-slate-600">No Projects Found</h4>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto">There are no project governance files corresponding to the selected search phrases or filters.</p>
          </div>
        ) : (
          /* High-fidelity responsive bento cards grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredProjects.map((p) => {
              const matchedClient = customers.find(c => c.id === p.clientId);
              const projectInvoices = invoices.filter(i => i.projectId === p.id);
              const projectInvoicedSum = projectInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
              
              const isFundsEditing = editingFundsId === p.id;
              const fundingRate = p.budget > 0 ? (p.allocatedFunds / p.budget) * 100 : 0;

              return (
                <div 
                  key={p.id} 
                  className="bg-white border border-slate-150 hover:border-slate-350 rounded-2xl p-5 shadow-4xs hover:shadow-3xs transition-all flex flex-col gap-4 text-left"
                >
                  
                  {/* Card Title Header Block */}
                  <div className="flex justify-between items-start gap-2 border-b pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {getStatusBadge(p.status)}
                        {getPriorityBadge(p.priority)}
                      </div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">{p.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setActiveDiscussionProject({ id: p.id, name: p.name })}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border border-indigo-100"
                        title="Open Team Discussion & Mentions"
                      >
                        <MessageSquare className="w-3 h-3" /> Thread
                      </button>
                      <button 
                        onClick={() => setSelectedProjectForDetails(p)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> View Details
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(p.id, p.name)}
                        className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                        title="Delete Project Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Project Scope Description */}
                  {p.description ? (
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3">
                      {p.description}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                      No scope of work summary written for this registered engagement.
                    </p>
                  )}

                  {/* Operational Governance Metrics & Assignments */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-[10px] md:text-[11px] font-medium text-slate-600">
                    <div className="space-y-1">
                      <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Designated PM</div>
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {p.projectManager || "Unassigned"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Client Link</div>
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" /> {matchedClient?.name || "Independent / Internal"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Governance Timeline</div>
                      <div className="flex items-center gap-1.5 text-slate-850 font-semibold font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDateStr(p.startDate)} → {formatDateStr(p.endDate)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Timeline Duration</div>
                      <div className="flex items-center gap-1.5 text-slate-850 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {calculateDuration(p.startDate, p.endDate)}
                      </div>
                    </div>
                  </div>

                  {/* Financial Audit, Funding Allocations & Invoicing details */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Capital Disbursement Progress</span>
                      <span className="font-mono text-slate-800">{fundingRate.toFixed(1)}% disbursed</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${fundingRate > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(fundingRate, 100)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[9px] md:text-[10px]">
                      <div className="bg-slate-50 border rounded-lg p-1.5">
                        <span className="block text-slate-400 font-bold uppercase text-[8px]">Budget</span>
                        <span className="font-mono font-bold text-slate-800">${(p.budget || 0).toLocaleString()}</span>
                      </div>
                      
                      <div className="bg-slate-50 border rounded-lg p-1.5 relative group">
                        <span className="block text-slate-400 font-bold uppercase text-[8px]">Disbursed</span>
                        <span className="font-mono font-bold text-emerald-700">${(p.allocatedFunds || 0).toLocaleString()}</span>
                      </div>

                      <div className="bg-slate-50 border rounded-lg p-1.5">
                        <span className="block text-slate-400 font-bold uppercase text-[8px]">Invoiced</span>
                        <span className="font-mono font-bold text-slate-800">${projectInvoicedSum.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive card footer: status switcher & inline funding modification */}
                  <div className="border-t pt-3 flex flex-col sm:flex-row gap-3.5 justify-between items-start sm:items-center bg-slate-50/30 p-2.5 rounded-b-xl border border-slate-100">
                    
                    {/* Inline Status Dropdown */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Status:</span>
                      <select 
                        value={p.status} 
                        onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-2xs bg-white text-slate-700 font-bold focus:outline-hidden"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Archived</option>
                      </select>
                    </div>

                    {/* Inline Allocated Funding Top Up Toggle */}
                    <div className="w-full sm:w-auto text-right">
                      {isFundsEditing ? (
                        <div className="flex items-center gap-1 w-full justify-end">
                          <span className="text-xs text-slate-500 font-mono">$</span>
                          <input 
                            type="number"
                            min={0}
                            className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold border rounded-md"
                            value={tempFundsVal}
                            onChange={(e) => setTempFundsVal(Number(e.target.value))}
                            placeholder="Disburse"
                          />
                          <button 
                            onClick={() => handleUpdateAllocatedFunds(p.id, p.budget)}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[9px] font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingFundsId(null)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md text-[9px] font-bold cursor-pointer"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingFundsId(p.id);
                            setTempFundsVal(p.allocatedFunds || 0);
                          }}
                          className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase tracking-wider border border-blue-200 hover:border-blue-400 bg-white px-2 py-1 rounded-lg transition cursor-pointer"
                        >
                          Disburse Funds <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      <AddProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        companyId={companyId} 
        customers={customers} 
      />

      <ProjectDetailsModal 
        isOpen={!!selectedProjectForDetails}
        onClose={() => setSelectedProjectForDetails(null)}
        project={selectedProjectForDetails}
        companyId={companyId}
        customers={customers}
      />

      {/* Contextual Entity Activity Drawer for Projects */}
      {activeDiscussionProject && (
        <EntityActivityDrawer
          isOpen={true}
          onClose={() => setActiveDiscussionProject(null)}
          companyId={companyId}
          entityType="projects"
          entityId={activeDiscussionProject.id}
          entityTitle={`Project: ${activeDiscussionProject.name}`}
        />
      )}
    </div>
  );
}
