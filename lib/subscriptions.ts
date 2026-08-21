export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in E (Emalangeni/USD/EUR)
  features: string[]; // list of feature IDs permitted
  maxAdmin: number;
  maxStaff: number;
  description: string;
  badge?: string;
  popular?: boolean;
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
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'pos', 'projects', 'support', 'settings', 'subscriptions'],
    maxAdmin: 2,
    maxStaff: 5,
    description: 'For growing businesses requiring inventory stock tracking, customer CRM, POS & project tracking.'
  },
  {
    id: 'professional',
    name: 'Professional Business',
    price: 3250,
    popular: true,
    badge: 'Most Popular',
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'pos', 'projects', 'support', 'transactions', 'reports', 'procurement', 'marketing', 'settings', 'subscriptions'],
    maxAdmin: 5,
    maxStaff: 15,
    description: 'For mature businesses needing double-entry transactions, procurement, marketing, and reporting analytics.'
  },
  {
    id: 'elite',
    name: 'Corporate Elite',
    price: 5000,
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'pos', 'projects', 'support', 'transactions', 'reports', 'procurement', 'marketing', 'audit', 'settings', 'subscriptions'],
    maxAdmin: 10,
    maxStaff: 50,
    description: 'Premium package supporting comprehensive SecOps security audit logs, compliance checks & activity tracking.'
  },
  {
    id: 'enterprise',
    name: 'Full Enterprise',
    price: 7500,
    badge: 'All-Inclusive',
    features: ['dashboard', 'quotations', 'invoices', 'receipts', 'inventory', 'clients', 'pos', 'projects', 'support', 'transactions', 'reports', 'procurement', 'marketing', 'audit', 'audit_center', 'payroll', 'executive', 'settings', 'subscriptions'],
    maxAdmin: 9999, // Unlimited
    maxStaff: 9999, // Unlimited
    description: 'Complete unconstrained workspace access including active HR & Payroll, Financial Audit Center, and C-Suite Executive Lounge.'
  }
];

export interface FeatureDefinition {
  id: string;
  label: string;
  category: 'core' | 'operations' | 'finance' | 'hr' | 'security';
  description: string;
  minimumPlanId: 'starter' | 'growth' | 'professional' | 'elite' | 'enterprise';
}

export const ALL_FEATURES: FeatureDefinition[] = [
  { id: 'dashboard', label: 'Dashboard & Divisions Hub', category: 'core', description: 'Central operational hub and overview metrics.', minimumPlanId: 'starter' },
  { id: 'quotations', label: 'Commercial Quotations', category: 'operations', description: 'Draft, calculate and dispatch quote estimates.', minimumPlanId: 'starter' },
  { id: 'invoices', label: 'Billing & Tax Invoices', category: 'finance', description: 'Accounts receivable and outbound corporate invoices.', minimumPlanId: 'starter' },
  { id: 'receipts', label: 'Settlement Receipts', category: 'finance', description: 'Payment verification and receipt vouchers.', minimumPlanId: 'starter' },
  { id: 'inventory', label: 'Stock & SKU Inventory', category: 'operations', description: 'Real-time stock management and SKU cataloging.', minimumPlanId: 'growth' },
  { id: 'clients', label: 'CRM & Client Directory', category: 'core', description: 'Customer relationship tracking and contacts database.', minimumPlanId: 'growth' },
  { id: 'pos', label: 'Point of Sale (POS)', category: 'operations', description: 'Walk-in cash register and instant thermal receipts.', minimumPlanId: 'growth' },
  { id: 'projects', label: 'Projects & Tasks', category: 'operations', description: 'Sprint boards, milestones and team task allocations.', minimumPlanId: 'growth' },
  { id: 'support', label: 'Customer Support Portal', category: 'core', description: 'Client ticketing queues and CSAT satisfaction tracking.', minimumPlanId: 'growth' },
  { id: 'transactions', label: 'Banking & Transactions Ledger', category: 'finance', description: 'Double-entry cash flows and journal entries.', minimumPlanId: 'professional' },
  { id: 'reports', label: 'Reports & Business Analytics', category: 'core', description: 'Financial statements, trends, and analytical sheets.', minimumPlanId: 'professional' },
  { id: 'procurement', label: 'Procurement & Purchase Orders', category: 'operations', description: 'Supplier management and purchase order pipelines.', minimumPlanId: 'professional' },
  { id: 'marketing', label: 'Marketing & Outbound Hub', category: 'core', description: 'Broadcast newsletters and promotional campaigns.', minimumPlanId: 'professional' },
  { id: 'audit', label: 'SecOps Audit Trail Logs', category: 'security', description: 'Immutable cryptographic security logs.', minimumPlanId: 'elite' },
  { id: 'audit_center', label: 'Finance Audit Center', category: 'security', description: 'Advanced reconciliation & financial compliance audits.', minimumPlanId: 'enterprise' },
  { id: 'payroll', label: 'HR Personnel & Payroll Engine', category: 'hr', description: 'Employee salary disbursal, PAYE taxes, and payslips.', minimumPlanId: 'enterprise' },
  { id: 'executive', label: 'Executive Strategic Lounge', category: 'core', description: 'C-Suite revenue forecasts & business valuation metrics.', minimumPlanId: 'enterprise' },
  { id: 'settings', label: 'Branding Settings', category: 'core', description: 'Custom letterheads, colors and corporate preferences.', minimumPlanId: 'starter' },
  { id: 'subscriptions', label: 'Subscriptions Management', category: 'core', description: 'Billing management and tier upgrades.', minimumPlanId: 'starter' }
];

export interface FeatureItem {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const FEATURE_DEFINITIONS: FeatureItem[] = ALL_FEATURES.map(f => ({
  id: f.id,
  name: f.label,
  category: f.category,
  description: f.description
}));

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

export function isFeatureAllowedForPlan(planId: string | undefined, featureId: string): boolean {
  if (!planId) return false;
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) return false;
  return plan.features.includes(featureId);
}

export function getRequiredPlanForFeature(featureId: string): SubscriptionPlan {
  const feature = ALL_FEATURES.find(f => f.id === featureId);
  const minPlanId = feature?.minimumPlanId || 'enterprise';
  return SUBSCRIPTION_PLANS.find(p => p.id === minPlanId) || SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1];
}

export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

