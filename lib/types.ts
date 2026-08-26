export type Role = 
  | 'MASTER_ADMIN' 
  | 'BUSINESS_ADMIN' 
  | 'STAFF'
  | 'COMPANY_OWNER'
  | 'COMPANY_ADMIN'
  | 'DEPARTMENT_MANAGER'
  | 'DEPARTMENT_STAFF'
  | 'EMPLOYEE'
  | 'READ_ONLY'
  | 'HR'
  | 'GENERAL_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'FINANCE_MANAGER'
  | 'MANAGING_DIRECTOR';

export interface User {
  id: string;
  email: string;
  role: Role;
  businessId: string;
  displayName?: string;
  photoURL?: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  emailVerified?: boolean;
}

export interface Business {
  id: string;
  name: string;
  createdAt: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  emailVerified?: boolean;
  officialEmail?: string;
  verifiedEmail?: string;
  emailVerifiedAt?: string;
  subscriptionPlanId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  legalName?: string;
  email: string;
  officialEmail?: string;
  phone?: string;
  officialPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  industry?: string;
  businessType?: string;
  currency?: string;
  employeeRange?: string;
  branchCount?: number;
  logo?: string;
  letterheadLogo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  useCompanyLetterhead?: boolean;
  themePreset?: string;
  themeMode?: string;
  fontFamily?: string;
  cardRadius?: string;
  sidebarStyle?: string;
  isVerified: boolean;
  isEmailVerified?: boolean;
  emailVerified?: boolean;
  verifiedEmail?: string;
  emailVerifiedAt?: string;
  subscriptionPlanId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  lockedFeatures?: string[];
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  email: string;
}

export interface ExpenseCategory {
  id: string;
  businessId: string;
  name: string;
}

export interface Expense {
  id: string;
  businessId: string;
  categoryId: string;
  amount: number;
  date: string;
  description: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  receiptUrl?: string;
}

export interface FinancialDocument {
  id: string;
  businessId: string;
  name: string;
  url: string;
  category: 'Expenses' | 'Supplier invoices' | 'External quotations' | 'Receipts' | 'Purchases' | 'Operational costs';
  extractedData?: Record<string, any>;
  uploadedAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface UserInvitation {
  email: string;
  role: Role;
}
