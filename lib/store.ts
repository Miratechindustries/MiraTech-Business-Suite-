import { create } from 'zustand';
import { User, Company, Quotation, Invoice, Receipt, Role } from './types';

interface BusinessStore {
  currentUser: User | null;
  company: Company | null;
  quotations: Quotation[];
  invoices: Invoice[];
  receipts: Receipt[];
  users: User[];
  
  // Setters & Actions
  setCurrentUser: (user: User | null) => void;
  updateCompany: (companyData: Partial<Company>) => void;
  schedulePlanChange: (planId: string, planName: string) => void;
  
  // Quotations
  addQuotation: (quote: Omit<Quotation, 'id' | 'quoteNumber'>) => void;
  updateQuotationStatus: (id: string, status: Quotation['status']) => void;
  
  // Invoices
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>) => void;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  
  // Receipts
  addReceipt: (receipt: Omit<Receipt, 'id' | 'receiptNumber'>) => void;
  
  // User Management
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUserRole: (id: string, role: Role) => void;
  updateUserPermissions: (id: string, permissions: Partial<User>) => void;
}

const DEFAULT_COMPANY: Company = {
  id: 'comp_miratech',
  name: 'MiraTech Industries LLC',
  email: 'office@miratech.com',
  phone: '+1 (555) 831-2940',
  address: '100 Innovation Way, Suite 400, Tech City, TC 94012',
  primaryColor: '#2563eb', // Blue 600
  secondaryColor: '#4f46e5', // Indigo 600
  subscriptionPlanId: 'professional',
  subscriptionPlanName: 'Professional Business',
  autoRenew: true
};

const DEFAULT_USER: User = {
  id: 'user_owner',
  email: 'miratechindustries@gmail.com',
  role: 'COMPANY_OWNER',
  companyId: 'comp_miratech',
  name: 'Corporate Executive',
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  canEditCompanyProfile: true,
  canCreateQuotations: true,
  canApproveQuotations: true,
  canCreateInvoices: true,
  canApproveInvoices: true,
  canCreateReceipts: true,
  canApproveTransactions: true,
  canApproveExpenses: true,
  canManageStaff: true,
  canExportReports: true,
  canViewAuditLogs: true
};

export const useStore = create<BusinessStore>((set, get) => {
  // Load initial data from localStorage if on client
  const isClient = typeof window !== 'undefined';
  
  const getStored = (key: string, fallback: any) => {
    if (!isClient) return fallback;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    currentUser: getStored('mira_currentUser', DEFAULT_USER),
    company: getStored('mira_company', DEFAULT_COMPANY),
    quotations: getStored('mira_quotations', [
      {
        id: 'q_1',
        quoteNumber: 'QT-2026-001',
        clientName: 'AeroCorp Global',
        clientEmail: 'billing@aerocorp.com',
        date: '2026-10-01',
        validUntil: '2026-11-01',
        items: [{ description: 'Cloud ERP Consultation & Scoping', quantity: 1, unitPrice: 2500 }],
        total: 2500,
        status: 'ACCEPTED',
        notes: 'Includes complete integration assessment.'
      },
      {
        id: 'q_2',
        quoteNumber: 'QT-2026-002',
        clientName: 'Vortex Systems',
        clientEmail: 'procure@vortex.io',
        date: '2026-10-05',
        validUntil: '2026-11-05',
        items: [{ description: 'Custom Analytics API License', quantity: 5, unitPrice: 450 }],
        total: 2250,
        status: 'SENT'
      }
    ]),
    invoices: getStored('mira_invoices', [
      {
        id: 'inv_1',
        invoiceNumber: 'INV-2026-001',
        clientName: 'AeroCorp Global',
        clientEmail: 'billing@aerocorp.com',
        date: '2026-10-02',
        dueDate: '2026-10-16',
        items: [{ description: 'Cloud ERP Consultation & Scoping', quantity: 1, unitPrice: 2500 }],
        total: 2500,
        status: 'UNPAID',
        notes: 'Generated from accepted quote QT-2026-001.'
      }
    ]),
    receipts: getStored('mira_receipts', []),
    users: getStored('mira_users', [DEFAULT_USER]),

    setCurrentUser: (user) => {
      set({ currentUser: user });
      if (isClient) localStorage.setItem('mira_currentUser', JSON.stringify(user));
    },

    updateCompany: (companyData) => {
      set((state) => {
        const updated = state.company ? { ...state.company, ...companyData } : null;
        if (isClient && updated) localStorage.setItem('mira_company', JSON.stringify(updated));
        return { company: updated };
      });
    },

    schedulePlanChange: (planId, planName) => {
      set((state) => {
        if (!state.company) return {};
        const updated: Company = {
          ...state.company,
          scheduledSubscriptionPlanId: planId,
          scheduledSubscriptionPlanName: planName,
          scheduledAt: new Date().toISOString()
        };
        if (isClient) localStorage.setItem('mira_company', JSON.stringify(updated));
        return { company: updated };
      });
    },

    addQuotation: (quote) => {
      set((state) => {
        const nextId = `q_${state.quotations.length + 1}`;
        const quoteNumber = `QT-2026-${String(state.quotations.length + 1).padStart(3, '0')}`;
        const newQuote: Quotation = { ...quote, id: nextId, quoteNumber };
        const updated = [newQuote, ...state.quotations];
        if (isClient) localStorage.setItem('mira_quotations', JSON.stringify(updated));
        return { quotations: updated };
      });
    },

    updateQuotationStatus: (id, status) => {
      set((state) => {
        const updated = state.quotations.map((q) => 
          q.id === id ? { ...q, status } : q
        );
        if (isClient) localStorage.setItem('mira_quotations', JSON.stringify(updated));
        return { quotations: updated };
      });
    },

    addInvoice: (invoice) => {
      set((state) => {
        const nextId = `inv_${state.invoices.length + 1}`;
        const invoiceNumber = `INV-2026-${String(state.invoices.length + 1).padStart(3, '0')}`;
        const newInvoice: Invoice = { ...invoice, id: nextId, invoiceNumber };
        const updated = [newInvoice, ...state.invoices];
        if (isClient) localStorage.setItem('mira_invoices', JSON.stringify(updated));
        return { invoices: updated };
      });
    },

    updateInvoiceStatus: (id, status) => {
      set((state) => {
        const updated = state.invoices.map((inv) => 
          inv.id === id ? { ...inv, status } : inv
        );
        if (isClient) localStorage.setItem('mira_invoices', JSON.stringify(updated));
        return { invoices: updated };
      });
    },

    addReceipt: (receipt) => {
      set((state) => {
        const nextId = `rcpt_${state.receipts.length + 1}`;
        const receiptNumber = `RC-2026-${String(state.receipts.length + 1).padStart(3, '0')}`;
        const newReceipt: Receipt = { ...receipt, id: nextId, receiptNumber };
        const updated = [newReceipt, ...state.receipts];
        if (isClient) localStorage.setItem('mira_receipts', JSON.stringify(updated));
        return { receipts: updated };
      });
    },

    addUser: (user) => {
      set((state) => {
        const nextId = `user_${Date.now()}`;
        const newUser: User = { 
          ...user, 
          id: nextId, 
          createdAt: new Date().toISOString() 
        };
        const updated = [...state.users, newUser];
        if (isClient) localStorage.setItem('mira_users', JSON.stringify(updated));
        return { users: updated };
      });
    },

    updateUserRole: (id, role) => {
      set((state) => {
        const updated = state.users.map((u) => 
          u.id === id ? { ...u, role } : u
        );
        if (isClient) localStorage.setItem('mira_users', JSON.stringify(updated));
        return { users: updated };
      });
    },

    updateUserPermissions: (id, permissions) => {
      set((state) => {
        const updated = state.users.map((u) => 
          u.id === id ? { ...u, ...permissions } : u
        );
        if (isClient) localStorage.setItem('mira_users', JSON.stringify(updated));
        return { users: updated };
      });
    }
  };
});
