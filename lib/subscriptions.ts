export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in E (Emalangeni/Euro/E)
  features: string[]; // list of activeTab elements permitted
  maxAdmin: number;
  maxStaff: number;
  description: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Small Business (Starter)',
    price: 800,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'settings', 'subscriptions'],
    maxAdmin: 1,
    maxStaff: 1,
    description: 'Perfect for small businesses creating professional quotes and billing clients.'
  },
  {
    id: 'growth',
    name: 'Growth Business',
    price: 1800,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'settings', 'subscriptions'],
    maxAdmin: 2,
    maxStaff: 5,
    description: 'For growing businesses requiring inventory stock tracking and customer CRM.'
  },
  {
    id: 'professional',
    name: 'Professional Business',
    price: 3250,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'transactions', 'reports', 'settings', 'subscriptions'],
    maxAdmin: 5,
    maxStaff: 15,
    description: 'For mature businesses needing detailed bank transactions processing and reporting analytics.'
  },
  {
    id: 'elite',
    name: 'Corporate Elite',
    price: 5000,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'transactions', 'reports', 'audit', 'settings', 'subscriptions'],
    maxAdmin: 10,
    maxStaff: 50,
    description: 'Premium package supporting comprehensive security audit logs and activity tracking.'
  },
  {
    id: 'enterprise',
    name: 'Full Enterprise',
    price: 7500,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'transactions', 'reports', 'audit', 'payroll', 'audit_center', 'settings', 'subscriptions'],
    maxAdmin: 9999, // Unlimited
    maxStaff: 9999, // Unlimited
    description: 'Complete unconstrained workspace access including active HR & Payroll and the internal Audit Center.'
  }
];

export const ALL_FEATURES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'clients', label: 'Clients / Customers' },
  { id: 'payroll', label: 'HR & Payroll' },
  { id: 'quotations', label: 'Quotes & Invoices' },
  { id: 'invoices', label: 'Billing Invoices' },
  { id: 'receipts', label: 'Receipts Ledger' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'audit_center', label: 'Audit Center' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'settings', label: 'Branding Settings' },
  { id: 'subscriptions', label: 'Subscriptions' }
];

export function getLockedFeaturesForPlan(planId: string): string[] {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0];
  const locked: string[] = [];
  ALL_FEATURES.forEach(f => {
    if (!plan.features.includes(f.id)) {
      locked.push(f.id);
    }
  });
  return locked;
}

export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
