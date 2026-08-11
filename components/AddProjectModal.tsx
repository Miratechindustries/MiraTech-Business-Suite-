"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useUserStore, useToastStore } from "../lib/store";
import { X, Calendar, DollarSign, User, Plus, Building, Phone, Mail, MapPin } from "lucide-react";

export default function AddProjectModal({ isOpen, onClose, companyId, customers: initialCustomers }: { isOpen: boolean, onClose: () => void, companyId: string, customers: any[] }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [allocatedFunds, setAllocatedFunds] = useState<number>(0);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("planning");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [projectManager, setProjectManager] = useState("");

  const [allCustomers, setAllCustomers] = useState<any[]>(initialCustomers || []);
  const [clientSearch, setClientSearch] = useState("");

  // Add New Client Modal state inside Project Form
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientType, setNewClientType] = useState("Enterprise");

  useEffect(() => {
    setAllCustomers(initialCustomers || []);
  }, [initialCustomers]);

  // Fetch customers from both collections to be 100% robust
  useEffect(() => {
    if (!companyId) return;
    async function fetchAllClients() {
      try {
        const list: any[] = [];
        // 1. From companies/{companyId}/customers
        const subSnap = await getDocs(collection(db, "companies", companyId, "customers"));
        subSnap.forEach(d => list.push({ id: d.id, ...d.data() }));

        // 2. From customers where businessId == companyId
        const rootSnap = await getDocs(query(collection(db, "customers"), where("businessId", "==", companyId)));
        rootSnap.forEach(d => {
          if (!list.some(c => c.id === d.id)) {
            list.push({ id: d.id, ...d.data() });
          }
        });

        if (list.length > 0) {
          setAllCustomers(list);
        }
      } catch (err) {
        console.error("Failed to load clients in project modal:", err);
      }
    }
    fetchAllClients();
  }, [companyId, isOpen]);

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !companyId) {
      addToast("Customer/Company Name is required", "error");
      return;
    }

    try {
      const clientData = {
        businessId: companyId,
        name: newClientName.trim(),
        company: newClientName.trim(),
        contactPerson: newClientContact.trim(),
        phone: newClientPhone.trim(),
        email: newClientEmail.trim(),
        address: newClientAddress.trim(),
        customerType: newClientType,
        totalBilling: 0,
        status: "Active",
        createdAt: new Date().toISOString()
      };

      // Save to root collection & subcollection for full integration
      const rootRef = await addDoc(collection(db, "customers"), clientData);
      try {
        await addDoc(collection(db, "companies", companyId, "customers"), clientData);
      } catch (subErr) {
        console.warn("Subcollection customer sync notice:", subErr);
      }

      const createdCustomer = { id: rootRef.id, ...clientData };
      setAllCustomers(prev => [...prev, createdCustomer]);
      setClientId(rootRef.id);

      addToast(`Client "${newClientName}" created and selected successfully!`, "success");
      setIsAddingClient(false);
      // Reset new client form
      setNewClientName("");
      setNewClientContact("");
      setNewClientPhone("");
      setNewClientEmail("");
      setNewClientAddress("");
    } catch (err: any) {
      addToast("Failed to create client: " + err.message, "error");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setBudget(0);
    setAllocatedFunds(0);
    setClientId("");
    setStatus("planning");
    setPriority("medium");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setProjectManager("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Project Name is required", "error");
      return;
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      addToast("Target Completion Date cannot be before Start Date", "error");
      return;
    }
    if (allocatedFunds > budget) {
      addToast("Allocated Funds cannot exceed the total project Budget", "warning");
    }

    const projectReference = `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await addDoc(collection(db, "companies", companyId, "projects"), {
        ownerId: currentUser?.uid || "SYSTEM",
        projectReference,
        name: name.trim(),
        description: description.trim(),
        budget: Number(budget) || 0,
        allocatedFunds: Number(allocatedFunds) || 0,
        clientId,
        status,
        priority,
        startDate,
        endDate: endDate || null,
        projectManager: projectManager.trim() || "Unassigned",
        createdAt: new Date().toISOString()
      });
      
      addToast(`Project ${projectReference} registered successfully!`, "success");
      resetForm();
      onClose();
    } catch (err: any) {
      console.error("Project registration failed:", err);
      addToast("Failed to create project: " + err.message, "error");
    }
  };

  if (!isOpen) return null;

  const filteredCustomers = allCustomers.filter(c => 
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 max-w-2xl w-full overflow-hidden flex flex-col my-8">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-blue-600" /> Complete Project Registration & Client Link
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Associate project with existing clients or create new clients on the fly.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh] space-y-5 text-left">
          
          {/* Section 1: Basic Information & Client Dropdown */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b pb-1">1. Project Scope & Client Mapping</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Name *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Enterprise Cloud ERP Migration"
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client Association *</label>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingClient(!isAddingClient)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> {isAddingClient ? "Select Existing" : "+ Add New Client"}
                  </button>
                </div>

                {isAddingClient ? (
                  <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-2.5">
                    <h5 className="text-[10px] font-bold text-blue-900 uppercase">Quick Add New Customer</h5>
                    <input 
                      type="text" 
                      placeholder="Company / Customer Name *"
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="email" 
                        placeholder="Email Address"
                        value={newClientEmail}
                        onChange={e => setNewClientEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input 
                        type="text" 
                        placeholder="Phone Number"
                        value={newClientPhone}
                        onChange={e => setNewClientPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleCreateNewClient}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs"
                    >
                      Save & Select Client
                    </button>
                  </div>
                ) : (
                  <select 
                    value={clientId} 
                    onChange={(e) => setClientId(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 font-medium text-slate-800"
                  >
                    <option value="">-- Select Registered Client --</option>
                    {allCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.company && c.company !== c.name ? `(${c.company})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description & Deliverables Summary</label>
              <textarea 
                rows={3}
                placeholder="Describe key scope, timeline goals, milestones..."
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 resize-none" 
              />
            </div>
          </div>

          {/* Section 2: Governance & Ownership */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b pb-1">2. Governance & Ownership</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Manager *</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={projectManager} 
                    onChange={(e) => setProjectManager(e.target.value)} 
                    className="w-full pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50"
                >
                  <option value="planning">📋 Planning</option>
                  <option value="active">⚡ Active Execution</option>
                  <option value="on_hold">⏸️ On Hold</option>
                  <option value="completed">✅ Completed</option>
                  <option value="cancelled">🛑 Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Financial Ledger & Timelines */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest border-b pb-1">3. Financial Ledger & Timeline</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Budget ($) *</label>
                <div className="relative flex items-center">
                  <DollarSign className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="number" 
                    required 
                    min={0}
                    placeholder="0.00"
                    value={budget || ""} 
                    onChange={(e) => setBudget(Number(e.target.value))} 
                    className="w-full pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 font-mono font-bold" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Allocated Funds ($)</label>
                <div className="relative flex items-center">
                  <DollarSign className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="number" 
                    min={0}
                    placeholder="0.00"
                    value={allocatedFunds || ""} 
                    onChange={(e) => setAllocatedFunds(Number(e.target.value))} 
                    className="w-full pl-8.5 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 font-mono" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date *</label>
                <input 
                  type="date" 
                  required 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 font-mono" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Completion Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition bg-slate-50 font-mono" 
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex gap-2.5 justify-end pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              Confirm Registration
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
