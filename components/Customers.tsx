"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Edit, X, User, Phone, Mail, Building, MapPin, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { logAction } from "../lib/audit";

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  totalBilling: number;
  status: "Active" | "Inactive";
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isOpen, setIsOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);

  // Form Fields
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [totalBilling, setTotalBilling] = useState(0);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBusiness() {
        if (!auth.currentUser) return;
        const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        setBusinessId(userSnap.data()?.businessId || null);
    }
    loadBusiness();
  }, []);

  useEffect(() => {
    if (!businessId) return;
    
    async function fetchCustomers() {
        const q = query(collection(db, "customers"), where("businessId", "==", businessId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        setCustomers(data);
    }
    fetchCustomers();
  }, [businessId]);

  const saveToLocal = (updatedList: Customer[]) => {
    setCustomers(updatedList);
    const user = auth.currentUser;
    const cacheKey = user ? `miratech_customers_${user.uid}` : "miratech_customers_guest";
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    // Audit logs entry
    const auditKey = user ? `miratech_audit_logs_${user.uid}` : "miratech_audit_logs_guest";
    const oldLogs = JSON.parse(localStorage.getItem(auditKey) || "[]");
    localStorage.setItem(auditKey, JSON.stringify([{
      action: "Customers Updated",
      detail: `Customer matrix updated. Active clients: ${updatedList.length}`,
      timestamp: new Date().toISOString(),
      user: user?.email || "Manager",
      ip: "127.0.0.1"
    }, ...oldLogs]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !businessId) return;

    const newCust = {
      businessId,
      name,
      company: company || "Individual/Direct",
      email,
      phone,
      address,
      totalBilling: Number(totalBilling),
      status,
    };

    const docRef = await addDoc(collection(db, "customers"), newCust);
    
    // Log database audit trail
    await logAction(
      "Client Created",
      `Created client profile '${name}' with email: ${email}`,
      businessId,
      Number(totalBilling)
    );

    setCustomers([...customers, { id: docRef.id, ...newCust }]);
    resetForm();
    setIsOpen(false);
  };

  const resetForm = () => {
    setId("");
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setAddress("");
    setTotalBilling(0);
    setStatus("Active");
    setEditingCust(null);
  };

  const handleEdit = (cust: Customer) => {
    setEditingCust(cust);
    setId(cust.id);
    setName(cust.name);
    setCompany(cust.company === "Individual/Direct" ? "" : cust.company);
    setEmail(cust.email);
    setPhone(cust.phone);
    setAddress(cust.address);
    setTotalBilling(cust.totalBilling);
    setStatus(cust.status);
    setIsOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust || !businessId) return;

    const updatedCust = {
      ...editingCust,
      name,
      company: company || "Individual/Direct",
      email,
      phone,
      address,
      totalBilling: Number(totalBilling),
      status,
    };
    
    await updateDoc(doc(db, "customers", editingCust.id), updatedCust);
    
    // Log database audit trail
    await logAction(
      "Client Updated",
      `Updated client profile '${name}' with email: ${email}`,
      businessId,
      Number(totalBilling)
    );

    setCustomers(customers.map((it) => it.id === editingCust.id ? updatedCust : it));
    resetForm();
    setIsOpen(false);
  };

  const handleDelete = async (custID: string) => {
    if (confirm("Permanently archive this corporate client log?")) {
      await deleteDoc(doc(db, "customers", custID));
      
      // Log database audit trail
      if (businessId) {
        await logAction(
          "Client Archived",
          `Permanently archived client log ID: ${custID}`,
          businessId
        );
      }

      setCustomers(customers.filter((it) => it.id !== custID));
    }
  };

  const filteredCusts = customers.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.company.toLowerCase().includes(search.toLowerCase()) ||
      it.email.toLowerCase().includes(search.toLowerCase()) ||
      it.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || it.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalClients = customers.length;
  const activeClients = customers.filter((it) => it.status === "Active").length;
  const totalTransactions = customers.reduce((sum, it) => sum + it.totalBilling, 0);

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Customers & Partners</h1>
          <p className="text-[11px] text-slate-500">Coordinate official accounts, billing references, and contact coordinates.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
        >
          <Plus className="h-3.5 w-3.5" /> Core Partner
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Accounts</p>
          <h3 className="text-base font-extrabold text-slate-800 mt-1 font-mono">{totalClients}</h3>
          <p className="text-[8px] text-slate-400">Direct partners database</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Entities</p>
          <h3 className="text-base font-extrabold text-green-600 mt-1 font-mono">{activeClients}</h3>
          <p className="text-[8px] text-green-500 font-medium">Clear routing active status</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Invoiced Receivables</p>
          <h3 className="text-base font-extrabold text-blue-700 mt-1 font-mono">${totalTransactions.toLocaleString()}</h3>
          <p className="text-[8px] text-blue-500 font-medium">Billed across all contract lifecycles</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden"
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {["All", "Active", "Inactive"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 border rounded-md text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-lg shadow-3xs">
        <table className="high-density-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th>ID</th>
              <th>Partner / Primary Contact</th>
              <th>Associated Business Group</th>
              <th>E-Mail Coordinate</th>
              <th>Phone line</th>
              <th>Billed</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {filteredCusts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                  No partners found matching parameters.
                </td>
              </tr>
            ) : (
              filteredCusts.map((it) => {
                const isActive = it.status === "Active";
                return (
                  <tr key={it.id} className="hover:bg-slate-50/50">
                    <td className="font-mono font-bold text-slate-900">{it.id}</td>
                    <td className="font-semibold text-slate-800">{it.name}</td>
                    <td className="font-bold text-blue-900">{it.company}</td>
                    <td className="font-mono text-[11px] text-slate-600">{it.email}</td>
                    <td className="font-mono text-[11px] text-slate-500">{it.phone || "---"}</td>
                    <td className="font-mono font-bold text-slate-800">${it.totalBilling.toLocaleString()}</td>
                    <td>
                      {isActive ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-150">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-400 border border-slate-150">
                          <AlertTriangle className="h-2.5 w-2.5" /> Asleep
                        </span>
                      )}
                    </td>
                    <td className="text-right space-x-1 py-1">
                      <button
                        onClick={() => handleEdit(it)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md cursor-pointer transition inline-flex"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition inline-flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-blue-905 uppercase tracking-wide border-0">
                {editingCust ? "Modify Partner Details" : "Register Direct Partner"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={editingCust ? handleUpdate : handleCreate} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Partner ID</label>
                  <input
                    type="text"
                    disabled={!!editingCust}
                    placeholder="Auto Generated"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client Active State</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                    className="w-full"
                  >
                    <option value="Active">Active / Engaged</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Associated Corporate Org</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Tech Solutions (leave blank if direct individual)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-Mail Address</label>
                  <input
                    type="email"
                    required
                    placeholder="jdoe@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (415) 555-0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Registered Address (Letterhead mapping)</label>
                <input
                  type="text"
                  placeholder="e.g. Suite 450, 100 Pine St, San Francisco, CA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recorded Billings Total ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={totalBilling}
                  onChange={(e) => setTotalBilling(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-md font-bold text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-bold text-[10px]"
                >
                  {editingCust ? "Save Settings" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
