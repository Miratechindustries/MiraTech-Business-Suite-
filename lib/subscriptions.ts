import { convertFromUSD, formatCurrency, getCurrencySymbol, getCurrencyInfo } from './currency';

export interface SubscriptionPlan {
  id: string;
  name: string;
  usdPrice: number; // Base in USD ($200, $700, $1500)
  maxUsers: number;
  maxAdmin: number;
  maxStaff: number;
  features: string[];
  description: string;
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Growth Suite (Tier 1)',
    usdPrice: 200,
    maxUsers: 10,
    maxAdmin: 2,
    maxStaff: 8,
    features: [
      'dashboard',
      'quotations',
      'invoices',
      'receipts',
      'inventory',
      'clients',
      'pos',
      'settings',
      'company_admin',
      'subscriptions'
    ],
    description: 'Entry business tier with up to 10 user seats, POS point-of-sale terminal, and standard financial workflows.',
    popular: false
  },
  {
    id: 'business',
    name: 'Business Suite (Tier 2)',
    usdPrice: 700,
    maxUsers: 35,
    maxAdmin: 5,
    maxStaff: 30,
    features: [
      'dashboard',
      'quotations',
      'invoices',
      'receipts',
      'inventory',
      'clients',
      'pos',
      'transactions',
      'reports',
      'projects',
      'procurement',
      'support',
      'marketing',
      'settings',
      'company_admin',
      'subscriptions'
    ],
    description: 'Comprehensive business operations suite for growing teams requiring multi-department access, projects, and banking reconciliation.',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise Unlimited (Tier 3)',
    usdPrice: 1500,
    maxUsers: 9999,
    maxAdmin: 9999,
    maxStaff: 9999,
    features: [
      'dashboard',
      'quotations',
      'invoices',
      'receipts',
      'inventory',
      'clients',
      'pos',
      'transactions',
      'reports',
      'projects',
      'procurement',
      'support',
      'marketing',
      'payroll',
      'audit_center',
      'audit',
      'executive',
      'settings',
      'company_admin',
      'subscriptions'
    ],
    description: 'Complete unrestricted corporate enterprise suite with unlimited user scaling, HR & payroll, executive lounge, and full audit governance.',
    popular: false
  }
];

export const ALL_FEATURES = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'inventory', label: 'Inventory & Warehousing' },
  { id: 'pos', label: 'POS System & Checkout' },
  { id: 'clients', label: 'Customer CRM & Clients' },
  { id: 'quotations', label: 'Quotes & Estimations' },
  { id: 'invoices', label: 'Billing Invoices' },
  { id: 'receipts', label: 'Receipts Ledger' },
  { id: 'transactions', label: 'Banking & Transactions' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'projects', label: 'Projects & Tasks' },
  { id: 'procurement', label: 'Procurement & Purchase Orders' },
  { id: 'support', label: 'Customer Support Hub' },
  { id: 'marketing', label: 'Marketing Campaigns' },
  { id: 'payroll', label: 'HR & Payroll Engine' },
  { id: 'audit_center', label: 'Financial Audit Center' },
  { id: 'audit', label: 'Security Audit Logs' },
  { id: 'executive', label: 'Executive Lounge' },
  { id: 'company_admin', label: 'Company Admin Portal' },
  { id: 'settings', label: 'Branding & Letterhead' },
  { id: 'subscriptions', label: 'Billing & Subscriptions' }
];

/**
 * Returns list of locked feature IDs for a given plan.
 */
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

/**
 * Calculates remaining days between two dates.
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Computes trial days remaining for a company.
 */
export function calculateTrialDaysRemaining(trialEndsAt?: string | number | Date): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt);
  const now = new Date();
  if (isNaN(end.getTime())) return 0;
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Determines if a company's free trial is currently active.
 */
export function isTrialActive(company?: any): boolean {
  if (!company) return false;
  if (company.subscriptionStatus === 'active') return false; // Paid active subscription
  if (company.trialActive === false) return false;
  
  if (company.trialEndsAt) {
    const end = new Date(company.trialEndsAt);
    return end.getTime() > Date.now();
  }
  return true; // Default true during onboarding/initial setup
}

/**
 * Validates whether adding a new user is permitted under current subscription limits.
 */
export function checkUserQuota(currentUserCount: number, planId?: string): {
  allowed: boolean;
  maxUsers: number;
  current: number;
  remaining: number;
  planName: string;
} {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0];
  const max = plan.maxUsers;
  const current = currentUserCount;
  const remaining = Math.max(0, max - current);
  const allowed = max >= 9999 || current < max;

  return {
    allowed,
    maxUsers: max,
    current,
    remaining,
    planName: plan.name
  };
}

/**
 * Formats plan pricing converted to target company currency.
 */
export function getConvertedPlanPrice(
  plan: SubscriptionPlan,
  currencyCode?: string,
  billingCycle: 'monthly' | 'annual' = 'monthly'
) {
  const multiplier = billingCycle === 'annual' ? 10 : 1;
  const usdAmount = plan.usdPrice * multiplier;
  const converted = convertFromUSD(usdAmount, currencyCode);
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = formatCurrency(converted, currencyCode, {
    minimumFractionDigits: converted % 1 === 0 ? 0 : 2
  });

  return {
    usdBase: usdAmount,
    convertedAmount: converted,
    formattedPrice: formatted,
    symbol,
    currencyCode: getCurrencyInfo(currencyCode).code,
    billingCycle
  };
}
