"use client";
import { useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useUserStore, useToastStore } from "../lib/store";
import { X } from "lucide-react";

export default function AddProjectModal({ isOpen, onClose, companyId, customers }: { isOpen: boolean, onClose: () => void, companyId: string, customers: any[] }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(0);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("planning");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "companies", companyId, "projects"), {
        ownerId: currentUser?.uid,
        name,
        description,
        budget: Number(budget),
        clientId,
        status,
        startDate,
        createdAt: new Date().toISOString()
      });
      addToast("Project created successfully", "success");
      onClose();
    } catch (err) {
      addToast("Failed to create project", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-lg w-full">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800">Add New Project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Project Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Budget</label>
            <input type="number" required value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="">Select a Client</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs font-bold">Create Project</button>
        </form>
      </div>
    </div>
  );
}
