export type UserRole = 'MASTER_ADMIN' | 'BUSINESS_ADMIN' | 'STAFF';

export interface Business {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  currency: string;
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'suspended';
  businessId?: string;
  photoURL?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  categoryId: string;
  buyPrice: number;
  sellPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  createdAt: number;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt: number;
}

export interface Quotation {
  id: string;
  businessId: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  items: any[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expiryDate: number;
  createdAt: number;
}

export interface Transaction {
  id: string;
  businessId: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'mobile_money' | 'bank_transfer' | 'card';
  referenceId?: string; // invoiceId, receiptId, etc.
  description: string;
  date: number;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  businessId: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  businessId: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: any[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  dueDate: number;
  createdAt: number;
  paidAmount: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  maxUsers: number;
  maxBusinesses: number;
  status: 'active' | 'archived';
  createdAt: number;
}

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  startDate: number;
  endDate: number;
  trialEndDate?: number;
  cancelAtPeriodEnd: boolean;
  cancelReason?: string;
  currentPeriodEnd: number;
  updatedAt: number;
}
