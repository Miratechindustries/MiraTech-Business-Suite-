'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { 
  CreditCard, 
  Plus, 
  Check, 
  X, 
  Edit2, 
  Trash2, 
  RefreshCcw, 
  Zap, 
  ShieldCheck, 
  Shield,
  Target,
  Clock,
  Building,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  where 
} from 'firebase/firestore';
import { SubscriptionPlan, Subscription, Business } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { assignSubscriptionToBusiness } from '@/lib/actions/subscriptions';

export default function SubscriptionManagementPage() {
  const { user } = useAppStore();
  const isAuthorized = user?.role === 'MASTER_ADMIN' || user?.role === 'master_admin';

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlanModalOpen, setPlanModalOpen] = useState(false);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [assignDuration, setAssignDuration] = useState<number>(1);
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [plansSnap, subsSnap, bizSnap] = await Promise.all([
        getDocs(query(collection(db, 'plans'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'subscriptions')),
        getDocs(collection(db, 'businesses'))
      ]);

      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPlan)));
      setSubscriptions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription)));
      setBusinesses(bizSnap.docs.map(d => ({ id: d.id, ...d.data() } as Business)));
    } catch (err) {
      console.error("Error fetching subscription data:", err);
      toast.error("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleAssignSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBizId || !selectedPlanId) {
      toast.error("Please select both business and plan");
      return;
    }

    setAssignLoading(true);
    try {
      await assignSubscriptionToBusiness(selectedBizId, selectedPlanId, assignDuration);
      
      setAssignModalOpen(false);
      fetchData();
      toast.success("Subscription protocol executed successfully");
    } catch (err) {
      console.error("Error assigning subscription:", err);
      toast.error("Failed to execute subscription protocol");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const planData = {
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      interval: formData.get('interval') as 'monthly' | 'yearly',
      features: (formData.get('features') as string).split(',').map(f => f.trim()),
      maxUsers: Number(formData.get('maxUsers')),
      maxBusinesses: Number(formData.get('maxBusinesses')),
      status: 'active' as const,
      updatedAt: Date.now(),
    };

    try {
      if (editingPlan) {
        await updateDoc(doc(db, 'plans', editingPlan.id), planData);
        toast.success("Plan updated successfully");
      } else {
        await addDoc(collection(db, 'plans'), {
          ...planData,
          createdAt: Date.now(),
        });
        toast.success("New plan created");
      }
      setPlanModalOpen(false);
      setEditingPlan(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to save plan");
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      await deleteDoc(doc(db, 'plans', id));
      toast.success("Plan deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete plan");
    }
  };

  if (!isAuthorized) return <div className="p-8">Access Denied</div>;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-widest font-black mb-1 italic">Level: Executive Management</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">Subscriptions_</h1>
        </div>
        <button 
          onClick={() => { setEditingPlan(null); setPlanModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all active:scale-95"
        >
          <Plus size={18} />
          Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Plans List */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap size={16} className="text-blue-600" />
            Active_Service_Plans
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 hover:border-blue-600/20 transition-all relative group shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-black text-slate-900 italic tracking-tight">{plan.name}</h4>
                    <p className="text-2xl font-black text-blue-600 mt-1">
                      ${plan.price}
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-1">/{plan.interval}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingPlan(plan); setPlanModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-xl">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-500">
                      <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4 mt-auto">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Users_Limit</p>
                      <p className="text-sm font-bold text-slate-900">{plan.maxUsers === 0 ? 'Unlimited' : plan.maxUsers}</p>
                    </div>
                     <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Entities_Limit</p>
                      <p className="text-sm font-bold text-slate-900">{plan.maxBusinesses === 0 ? 'Unlimited' : plan.maxBusinesses}</p>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Subscriptions Stats */}
        <div className="space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            Global_Metrics
          </h3>
          <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <CreditCard size={120} />
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Total_Subscribers</p>
              <h2 className="text-5xl font-black italic tracking-tighter">{subscriptions.length}</h2>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Total Businesses</span>
                  <span className="text-sm font-black">{businesses.length}</span>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Active Subscriptions</span>
                  <span className="text-sm font-black text-emerald-400">{subscriptions.filter(s => s.status === 'active').length}</span>
               </div>
               <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Unsubscribed Units</span>
                  <span className="text-sm font-black text-rose-400">{businesses.length - subscriptions.length}</span>
               </div>
            </div>

            <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
               <RefreshCcw size={14} />
               Re-sync External Billing
            </button>
          </div>
        </div>
      </div>

      {/* Business Subscription Registry */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
           <div>
             <h3 className="text-xs font-black text-slate-900 uppercase italic tracking-widest">Entity_Registry_</h3>
           </div>
           <div className="flex gap-2">
              <input type="text" placeholder="Search_entity..." className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-blue-500 transition-all" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Identifier</th>
                <th className="px-4 py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Active_Plan</th>
                <th className="px-4 py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">State_Flag</th>
                <th className="px-4 py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Renewal_Sync</th>
                <th className="px-4 py-3 text-[10px] uppercase font-black text-slate-400 tracking-widest text-right">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {businesses.map(biz => {
                const sub = subscriptions.find(s => s.businessId === biz.id);
                const plan = plans.find(p => p.id === sub?.planId);
                
                return (
                  <tr key={biz.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black italic text-xs shadow-md shrink-0">
                          {biz.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{biz.name}</p>
                          <p className="text-[9px] font-mono text-slate-400 truncate uppercase mt-0.5">{biz.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                       {plan ? (
                         <div className="flex items-center gap-1.5 p-1.5 bg-blue-50/50 rounded-lg border border-blue-100 w-fit">
                           <Target size={12} className="text-blue-600" />
                           <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight">{plan.name}</span>
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 w-fit">
                           <Shield size={12} className="text-slate-300" />
                           <span className="text-[10px] font-bold text-slate-400 italic uppercase">Unprovisioned</span>
                         </div>
                       )}
                    </td>
                    <td className="px-4 py-3">
                       <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                         sub?.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                         sub?.status === 'past_due' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                         'bg-slate-50 text-slate-400 border-slate-200'
                       }`}>
                         {sub?.status || 'Null_State'}
                       </span>
                    </td>
                    <td className="px-4 py-3">
                       <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-500">
                         <Clock size={12} className="text-slate-300" />
                         {sub ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                       </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                       <button 
                         onClick={() => {
                           setSelectedBizId(biz.id);
                           const sub = subscriptions.find(s => s.businessId === biz.id);
                           if (sub) setSelectedPlanId(sub.planId);
                           setAssignModalOpen(true);
                         }}
                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm hover:shadow-blue-600/20 active:scale-95"
                        >
                         <Plus size={10} />
                         {subscriptions.find(s => s.businessId === biz.id) ? 'Re-Assign' : 'Provision'}
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl p-10 relative border border-white/20">
              <button 
                onClick={() => setAssignModalOpen(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter mb-2 uppercase">
                Provision_Entity_
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Manual service authorization protocol</p>
              
              <form onSubmit={handleAssignSubscription} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Target Entity</label>
                    <select 
                      value={selectedBizId} 
                      onChange={e => setSelectedBizId(e.target.value)}
                      required 
                      className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all outline-none"
                    >
                      <option value="">Select Business...</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Service Tier</label>
                    <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                      {plans.map(plan => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                            selectedPlanId === plan.id 
                            ? 'border-blue-600 bg-blue-50' 
                            : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-black uppercase italic tracking-tight">{plan.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{plan.interval} cycle</p>
                          </div>
                          <span className="text-sm font-black text-blue-600">${plan.price}</span>
                        </button>
                      ))}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Authorization Interval (Months)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="number" 
                        min="1" 
                        max="120"
                        value={assignDuration}
                        onChange={e => setAssignDuration(Number(e.target.value))}
                        className="w-24 px-5 py-4 bg-slate-50 rounded-2xl text-sm font-black border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all outline-none"
                      />
                      <div className="text-[11px] font-bold text-slate-500 uppercase italic">
                        Access granted until: {new Date(new Date().setMonth(new Date().getMonth() + assignDuration)).toLocaleDateString()}
                      </div>
                    </div>
                 </div>

                 <button 
                   type="submit"
                   disabled={assignLoading}
                   className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                 >
                    {assignLoading ? 'EXECUTING_PROTOCOL...' : 'EXECUTE_PROVISIONING'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl p-10 relative border border-white/20">
              <button 
                onClick={() => setPlanModalOpen(false)}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter mb-8">
                {editingPlan ? 'Modify_Existing_Plan' : 'Configure_New_Plan_'}
              </h2>
              
              <form onSubmit={handleSavePlan} className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Plan Name</label>
                       <input 
                         name="name" 
                         defaultValue={editingPlan?.name} 
                         required 
                         className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all outline-none"
                         placeholder="e.g. Enterprise Elite"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Billing Price</label>
                       <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                          <input 
                             name="price" 
                             type="number"
                             defaultValue={editingPlan?.price} 
                             required 
                             className="w-full pl-8 pr-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all outline-none"
                             placeholder="0.00"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Users Limit</label>
                       <input 
                         name="maxUsers" 
                         type="number"
                         defaultValue={editingPlan?.maxUsers || 0} 
                         required 
                         className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all"
                         placeholder="0 for Unlimited"
                       />
                    </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Entity Limit</label>
                       <input 
                         name="maxBusinesses" 
                         type="number"
                         defaultValue={editingPlan?.maxBusinesses || 0} 
                         required 
                         className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all"
                         placeholder="0 for Unlimited"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Billing Cycle</label>
                    <select name="interval" defaultValue={editingPlan?.interval || 'monthly'} className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none appearance-none">
                       <option value="monthly">Monthly Cycle</option>
                       <option value="yearly">Yearly Cycle</option>
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Core Features (comma separated)</label>
                    <textarea 
                      name="features" 
                      defaultValue={editingPlan?.features.join(', ')} 
                      required 
                      className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold min-h-[100px] outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="High-Def Export, Multi-User Sync, Private Blockchain..."
                    />
                 </div>

                 <button className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all hover:-translate-y-1 active:translate-y-0">
                    Deploy_Plan_Specs
                 </button>
              </form>
           </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
