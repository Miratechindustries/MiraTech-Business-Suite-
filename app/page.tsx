'use client';

import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../lib/subscriptions';
import { 
  Building2, 
  LayoutDashboard, 
  FileText, 
  Receipt, 
  CreditCard, 
  Settings2, 
  Users2, 
  Plus, 
  Check, 
  AlertCircle,
  Building,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Briefcase,
  CheckCircle,
  Clock,
  Shield,
  HelpCircle,
  X,
  FileCheck
} from 'lucide-react';

export default function Home() {
  const { 
    currentUser, 
    company, 
    quotations, 
    invoices, 
    receipts, 
    users,
    updateCompany,
    schedulePlanChange,
    addQuotation,
    updateQuotationStatus,
    addInvoice,
    updateInvoiceStatus,
    addReceipt,
    addUser,
    updateUserPermissions
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'quotes' | 'invoices' | 'receipts' | 'billing' | 'profile' | 'staff'>('dashboard');
  
  // Modals / Form States
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // New Quote Form
  const [newQuoteClient, setNewQuoteClient] = useState('');
  const [newQuoteEmail, setNewQuoteEmail] = useState('');
  const [newQuoteDesc, setNewQuoteDesc] = useState('');
  const [newQuoteQty, setNewQuoteQty] = useState(1);
  const [newQuotePrice, setNewQuotePrice] = useState(100);

  // New Invoice Form
  const [newInvClient, setNewInvoiceClient] = useState('');
  const [newInvEmail, setNewInvoiceEmail] = useState('');
  const [newInvDesc, setNewInvoiceDesc] = useState('');
  const [newInvQty, setNewInvoiceQty] = useState(1);
  const [newInvPrice, setNewInvoicePrice] = useState(100);

  // New Receipt Form
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('Bank Transfer');

  // New Staff Form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'STAFF' | 'DEPARTMENT_MANAGER' | 'HR' | 'FINANCE_MANAGER'>('STAFF');

  const isAdminOrOwner = currentUser?.role === 'COMPANY_OWNER' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'BUSINESS_ADMIN';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Submit Handlers
  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteClient || !newQuoteDesc) return;
    addQuotation({
      clientName: newQuoteClient,
      clientEmail: newQuoteEmail || 'client@example.com',
      date: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: newQuoteDesc, quantity: newQuoteQty, unitPrice: newQuotePrice }],
      total: newQuoteQty * newQuotePrice,
      status: 'SENT'
    });
    setNewQuoteClient('');
    setNewQuoteEmail('');
    setNewQuoteDesc('');
    setNewQuoteQty(1);
    setNewQuotePrice(100);
    setShowQuoteModal(false);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvClient || !newInvDesc) return;
    addInvoice({
      clientName: newInvClient,
      clientEmail: newInvEmail || 'client@example.com',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: newInvDesc, quantity: newInvQty, unitPrice: newInvPrice }],
      total: newInvQty * newInvPrice,
      status: 'UNPAID'
    });
    setNewInvoiceClient('');
    setNewInvoiceEmail('');
    setNewInvDesc('');
    setNewInvoiceQty(1);
    setNewInvoicePrice(100);
    setShowInvoiceModal(false);
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const inv = invoices.find(i => i.id === selectedInvoiceId);
    if (!inv) return;
    
    addReceipt({
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      date: new Date().toISOString().split('T')[0],
      amount: inv.total,
      paymentMethod: receiptMethod
    });

    updateInvoiceStatus(inv.id, 'PAID');
    setShowReceiptModal(false);
    setSelectedInvoiceId('');
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail) return;
    addUser({
      email: newStaffEmail,
      role: newStaffRole,
      companyId: company?.id || 'comp_miratech',
      name: newStaffName,
      status: 'ACTIVE',
      canEditCompanyProfile: false,
      canCreateQuotations: true,
      canApproveQuotations: false,
      canCreateInvoices: true,
      canApproveInvoices: false,
      canCreateReceipts: true
    });
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffRole('STAFF');
    setShowUserModal(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Building2 className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="font-extrabold text-sm tracking-wide text-white truncate max-w-[150px]">
                {company?.name || 'Business Suite'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Hub</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'quotes', label: 'Quotations', icon: FileText },
              { id: 'invoices', label: 'Invoices & Billing', icon: FileCheck },
              { id: 'receipts', label: 'Settlement Receipts', icon: Receipt },
              { id: 'staff', label: 'Personnel & Staff', icon: Users2 },
              { id: 'profile', label: 'Company Profile', icon: Settings2 },
              { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xs uppercase shadow-inner">
              {currentUser?.name?.charAt(0) || 'E'}
            </div>
            <div className="truncate max-w-[140px]">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{currentUser?.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
              {activeTab === 'dashboard' ? 'Workspace Overview' : `${activeTab} Control Hub`}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Production ready, enterprise security hardened ERP workflow module.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>Production Gateway Synced</span>
            </span>
          </div>
        </header>

        {/* Dynamic Division Render */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Quotations</span>
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">
                  {formatCurrency(quotations.reduce((sum, q) => sum + q.total, 0))}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Across {quotations.length} global quotes
                </p>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Invoiced Receivables</span>
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">
                  {formatCurrency(invoices.reduce((sum, i) => sum + i.total, 0))}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Across {invoices.length} active bills
                </p>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Settled Payments</span>
                  <Receipt className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">
                  {formatCurrency(receipts.reduce((sum, r) => sum + r.amount, 0))}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  {receipts.length} verified receipts issued
                </p>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Billing Tier</span>
                  <CreditCard className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-lg font-black text-slate-800 truncate">
                  {company?.subscriptionPlanName}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  {company?.autoRenew ? 'Auto-Renewal Enabled' : 'Manual Renewal'}
                </p>
              </div>
            </div>

            {/* Quick Actions & General Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>Active Corporate Accounts Receivable Ledger</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-medium divide-y divide-slate-100">
                      <thead>
                        <tr className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold pb-2">
                          <th className="py-2">Ref / Number</th>
                          <th className="py-2">Corporate Client</th>
                          <th className="py-2 text-right">Amount</th>
                          <th className="py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                            <td className="py-3 text-slate-700">{inv.clientName}</td>
                            <td className="py-3 text-right font-black text-slate-900">{formatCurrency(inv.total)}</td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-amber-50 text-amber-700 border border-amber-250'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-2">Corporate Branding Details</h3>
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <Building className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Legal Corporate Name</p>
                      <p className="text-xs font-bold text-slate-800">{company?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billing Email</p>
                      <p className="text-xs font-bold text-slate-800">{company?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Phone</p>
                      <p className="text-xs font-bold text-slate-800">{company?.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Corporate Address</p>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{company?.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quotes tab */}
        {activeTab === 'quotes' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Commercial Sales Quotes</h3>
              <button
                onClick={() => setShowQuoteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Sales Quote</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs font-medium divide-y divide-slate-150">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                    <th className="py-4 px-6">Quote Number</th>
                    <th className="py-4 px-6">Client Details</th>
                    <th className="py-4 px-6">Issue Date</th>
                    <th className="py-4 px-6">Valid Until</th>
                    <th className="py-4 px-6 text-right">Quote Value</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">{q.quoteNumber}</td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{q.clientName}</p>
                        <p className="text-slate-400 text-[10px]">{q.clientEmail}</p>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-semibold">{q.date}</td>
                      <td className="py-4 px-6 text-slate-500 font-semibold">{q.validUntil}</td>
                      <td className="py-4 px-6 text-right font-black text-slate-900">{formatCurrency(q.total)}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          q.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                          q.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-250' : 'bg-blue-50 text-blue-700 border border-blue-250'
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5">
                        {q.status === 'SENT' && (
                          <>
                            <button
                              onClick={() => updateQuotationStatus(q.id, 'ACCEPTED')}
                              className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer transition"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => updateQuotationStatus(q.id, 'REJECTED')}
                              className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {q.status === 'ACCEPTED' && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked to Invoice</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Inbound Billing Receivables</h3>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Corporate Invoice</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs font-medium divide-y divide-slate-150">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                    <th className="py-4 px-6">Invoice Number</th>
                    <th className="py-4 px-6">Client Details</th>
                    <th className="py-4 px-6">Issue Date</th>
                    <th className="py-4 px-6">Due Date</th>
                    <th className="py-4 px-6 text-right">Billing Value</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{inv.clientName}</p>
                        <p className="text-slate-400 text-[10px]">{inv.clientEmail}</p>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-semibold">{inv.date}</td>
                      <td className="py-4 px-6 text-slate-500 font-semibold">{inv.dueDate}</td>
                      <td className="py-4 px-6 text-right font-black text-slate-900">{formatCurrency(inv.total)}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-amber-50 text-amber-700 border border-amber-250'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {inv.status === 'UNPAID' && (
                          <button
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setShowReceiptModal(true);
                            }}
                            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition shadow-sm"
                          >
                            Receive Settlement
                          </button>
                        )}
                        {inv.status === 'PAID' && (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Receipts Tab */}
        {activeTab === 'receipts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Settled Receipt Vouchers</h3>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs font-medium divide-y divide-slate-150">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                    <th className="py-4 px-6">Receipt Number</th>
                    <th className="py-4 px-6">Invoice Number</th>
                    <th className="py-4 px-6">Corporate Client</th>
                    <th className="py-4 px-6">Settlement Date</th>
                    <th className="py-4 px-6">Payment Channel</th>
                    <th className="py-4 px-6 text-right">Amount Cleared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                        No settled corporate transaction payments recorded in this cycle.
                      </td>
                    </tr>
                  ) : (
                    receipts.map((rcpt) => (
                      <tr key={rcpt.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-slate-800">{rcpt.receiptNumber}</td>
                        <td className="py-4 px-6 font-mono text-slate-500 font-semibold">{rcpt.invoiceNumber}</td>
                        <td className="py-4 px-6 font-bold text-slate-800">{rcpt.clientName}</td>
                        <td className="py-4 px-6 text-slate-500 font-semibold">{rcpt.date}</td>
                        <td className="py-4 px-6 text-slate-600 font-bold uppercase tracking-wider text-[10px]">{rcpt.paymentMethod}</td>
                        <td className="py-4 px-6 text-right font-black text-slate-900">{formatCurrency(rcpt.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staff & User Management */}
        {activeTab === 'staff' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Operational Personnel Roster</h3>
              <button
                onClick={() => setShowUserModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enroll Personnel</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs font-medium divide-y divide-slate-150">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                    <th className="py-4 px-6">Name</th>
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6">Assigned Role</th>
                    <th className="py-4 px-6">System Status</th>
                    <th className="py-4 px-6 text-right">Corporate Privileges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-800">{u.name}</td>
                      <td className="py-4 px-6 font-mono text-slate-500">{u.email}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          <span>Active</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-y-1">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {u.canEditCompanyProfile && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded">Profile</span>}
                          {u.canCreateQuotations && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">Quotes</span>}
                          {u.canCreateInvoices && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">Billing</span>}
                          {u.canCreateReceipts && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">Receipts</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Company Profile Tab */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-extrabold text-slate-800 text-base">Corporate Profile Configuration</h3>
              <p className="text-xs text-slate-500 mt-1">Configure legal identity, corporate contacts, and branding parameters.</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!isAdminOrOwner) return;
              updateCompany({
                name: (e.currentTarget.elements.namedItem('compName') as HTMLInputElement).value,
                email: (e.currentTarget.elements.namedItem('compEmail') as HTMLInputElement).value,
                phone: (e.currentTarget.elements.namedItem('compPhone') as HTMLInputElement).value,
                address: (e.currentTarget.elements.namedItem('compAddress') as HTMLInputElement).value,
              });
            }} className="p-6 space-y-5">
              {!isAdminOrOwner && (
                <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span>Only Corporate Administrators can update company branding parameters.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Legal Company Name</label>
                  <input
                    type="text"
                    name="compName"
                    disabled={!isAdminOrOwner}
                    defaultValue={company?.name}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Company Contact Phone</label>
                  <input
                    type="text"
                    name="compPhone"
                    disabled={!isAdminOrOwner}
                    defaultValue={company?.phone}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Corporate Email Address</label>
                <input
                  type="email"
                  name="compEmail"
                  disabled={!isAdminOrOwner}
                  defaultValue={company?.email}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Operational Address</label>
                <textarea
                  name="compAddress"
                  rows={3}
                  disabled={!isAdminOrOwner}
                  defaultValue={company?.address}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              {isAdminOrOwner && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Commit Corporate Profile
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Plan & Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-base">Current Workspace Billing Tier</h3>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border bg-blue-50 text-blue-700 border-blue-200">
                    Active Subscription
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Currently subscribed to <strong className="text-slate-700">{company?.subscriptionPlanName}</strong>. 
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={company?.autoRenew}
                      onChange={(e) => updateCompany({ autoRenew: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                    {company?.autoRenew ? 'Auto-Renew ON' : 'Auto-Renew OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Scheduled Plan Changes Banner */}
            {company?.scheduledSubscriptionPlanId && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 border border-blue-250 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-[10px]">Pending Scheduled Subscription Change</h4>
                  <p className="text-blue-700 mt-1">
                    Your workspace is scheduled to update to the <strong className="text-slate-800">{company.scheduledSubscriptionPlanName}</strong>. This update will take effect automatically once the current chosen package period has elapsed.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Workspace Plan Matrix</h3>
                <p className="text-xs text-slate-500">Upgrade or downgrade your current workspace. The new pricing structure is applied once the chosen package has elapsed.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isCurrent = plan.id === company?.subscriptionPlanId;
                  const isScheduled = plan.id === company?.scheduledSubscriptionPlanId;

                  return (
                    <div key={plan.id} className={`bg-white border rounded-2xl p-6 flex flex-col justify-between shadow-sm relative ${
                      isCurrent ? 'ring-2 ring-blue-600 border-transparent' : 'border-slate-200'
                    }`}>
                      {isCurrent && (
                        <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white font-extrabold text-[8px] uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow">
                          Current Active Plan
                        </span>
                      )}

                      <div className="space-y-3">
                        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">{plan.name}</h4>
                        <div>
                          <span className="text-2xl font-black text-slate-900">${plan.price}</span>
                          <span className="text-[10px] font-bold text-slate-400">/mo</span>
                        </div>
                        <p className="text-[11px] text-slate-500 min-h-[44px] leading-relaxed">
                          {plan.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 my-4 space-y-2 text-[10px] text-slate-500 font-bold select-none text-left">
                        <div className="flex justify-between">
                          <span>Admin Quota</span>
                          <span className="text-slate-800">{plan.maxAdmin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Staff Accounts</span>
                          <span className="text-slate-800">{plan.maxStaff}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || isScheduled}
                        onClick={() => schedulePlanChange(plan.id, plan.name)}
                        className={`w-full py-2.5 font-bold text-[10px] uppercase tracking-wider rounded-xl transition shadow-sm cursor-pointer ${
                          isCurrent 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150 cursor-default' 
                            : isScheduled 
                            ? 'bg-blue-50 text-blue-700 border border-blue-150'
                            : 'bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50'
                        }`}
                      >
                        {isCurrent ? 'Activated' : isScheduled ? 'Upgrade Scheduled' : 'Schedule Package'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal: New Quote */}
        {showQuoteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-zoomIn">
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Create Sales Quote</h3>
                <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateQuote} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Corporate Client</label>
                  <input
                    type="text"
                    required
                    value={newQuoteClient}
                    onChange={(e) => setNewQuoteClient(e.target.value)}
                    placeholder="e.g. AeroCorp Global"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Client Email Address</label>
                  <input
                    type="email"
                    required
                    value={newQuoteEmail}
                    onChange={(e) => setNewQuoteEmail(e.target.value)}
                    placeholder="e.g. billing@aerocorp.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Deliverable Description</label>
                  <input
                    type="text"
                    required
                    value={newQuoteDesc}
                    onChange={(e) => setNewQuoteDesc(e.target.value)}
                    placeholder="e.g. ERP Configuration"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newQuoteQty}
                      onChange={(e) => setNewQuoteQty(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newQuotePrice}
                      onChange={(e) => setNewQuotePrice(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Dispatch Sales Quote
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: New Invoice */}
        {showInvoiceModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-zoomIn">
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Create Corporate Invoice</h3>
                <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Corporate Client</label>
                  <input
                    type="text"
                    required
                    value={newInvClient}
                    onChange={(e) => setNewInvoiceClient(e.target.value)}
                    placeholder="e.g. AeroCorp Global"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Client Email Address</label>
                  <input
                    type="email"
                    required
                    value={newInvEmail}
                    onChange={(e) => setNewInvoiceEmail(e.target.value)}
                    placeholder="e.g. billing@aerocorp.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Service Description</label>
                  <input
                    type="text"
                    required
                    value={newInvDesc}
                    onChange={(e) => setNewInvoiceDesc(e.target.value)}
                    placeholder="e.g. ERP Configuration"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newInvQty}
                      onChange={(e) => setNewInvoiceQty(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newInvPrice}
                      onChange={(e) => setNewInvoicePrice(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Issue Billing Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Receive payment / create receipt */}
        {showReceiptModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-zoomIn">
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Receive Corporate Settlement</h3>
                <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateReceipt} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Select Pending Invoice</label>
                  <select
                    required
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Choose Invoice --</option>
                    {invoices.filter(i => i.status === 'UNPAID').map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.clientName} ({formatCurrency(inv.total)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Payment Method</label>
                  <select
                    required
                    value={receiptMethod}
                    onChange={(e) => setReceiptMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Corporate Check">Corporate Check</option>
                    <option value="Cash / POS">Cash / POS</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Approve Payment & Issue Receipt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add User */}
        {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-zoomIn">
              <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Enroll Personnel</h3>
                <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Corporate Email Address</label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="e.g. s.jenkins@company.com"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Organizational Role</label>
                  <select
                    required
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="STAFF">Standard Staff Specialist</option>
                    <option value="DEPARTMENT_MANAGER">Department Head (Manager)</option>
                    <option value="HR">HR Generalist</option>
                    <option value="FINANCE_MANAGER">Finance Controller</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Authorize Account Enrollment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
