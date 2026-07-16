"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useUserStore } from "../lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import AddProjectModal from "./AddProjectModal";
import { Plus, FolderKanban } from "lucide-react";

export default function ProjectDashboard({ companyId }: { companyId: string }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const cRef = collection(db, "companies", companyId, "customers");
    const unsubC = onSnapshot(cRef, (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setCustomers(list);
    });
    return () => { unsubP(); unsubI(); unsubC(); };
  }, [companyId]);

  const chartData = projects.map(p => {
    const projectInvoices = invoices.filter(i => i.projectId === p.id);
    const totalInvoiced = projectInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    return { name: p.name, Budget: p.budget, Invoiced: totalInvoiced };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FolderKanban className="w-4 h-4 text-cyan-600"/> Projects Overview</h3>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Project
        </button>
      </div>
      
      <div className="h-64 bg-white p-4 border border-slate-200 rounded-xl shadow-4xs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10}/>
            <YAxis fontSize={10}/>
            <Tooltip />
            <Legend fontSize={10}/>
            <Bar dataKey="Budget" fill="#3b82f6" />
            <Bar dataKey="Invoiced" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-4xs space-y-2">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project List</h4>
        {projects.map(p => (
            <div key={p.id} className="text-xs p-2 border-b border-slate-100 flex justify-between">
                <span>{p.name}</span>
                <span className="font-bold text-slate-700">Budget: ${Number(p.budget).toLocaleString()}</span>
            </div>
        ))}
      </div>
      <AddProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} companyId={companyId} customers={customers} />
    </div>
  );
}
