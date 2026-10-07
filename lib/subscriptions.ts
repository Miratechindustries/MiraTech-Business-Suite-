export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  maxAdmin: number;
  maxStaff: number;
  description: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Small Business (Starter)',
    price: 80,
    maxAdmin: 1,
    maxStaff: 1,
    description: 'Perfect for small businesses creating professional quotes and billing clients.',
    features: ['Quotations', 'Invoices', 'Basic CRM']
  },
  {
    id: 'growth',
    name: 'Growth Business',
    price: 180,
    maxAdmin: 2,
    maxStaff: 5,
    description: 'For growing businesses requiring inventory tracking, customer CRM & project tracking.',
    features: ['Quotations', 'Invoices', 'CRM', 'Inventory', 'Project Tracking']
  },
  {
    id: 'professional',
    name: 'Professional Business',
    price: 325,
    maxAdmin: 5,
    maxStaff: 15,
    description: 'For mature businesses needing double-entry ledger, procurement, and analytics.',
    features: ['Quotations', 'Invoices', 'CRM', 'Inventory', 'Project Tracking', 'Ledger', 'Procurement', 'Basic Analytics']
  },
  {
    id: 'enterprise',
    name: 'Full Enterprise',
    price: 750,
    maxAdmin: 999,
    maxStaff: 999,
    description: 'Complete unconstrained workspace access including Payroll and C-Suite strategic lounge.',
    features: ['Quotations', 'Invoices', 'CRM', 'Inventory', 'Project Tracking', 'Ledger', 'Procurement', 'Advanced Analytics', 'Payroll', 'Security Audit Logs']
  }
];
