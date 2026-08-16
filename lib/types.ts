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
  | 'MANAGING_DIRECTOR'
  | 'SALES_REP'
  | 'ACCOUNTANT'
  | 'INVENTORY_OFFICER'
  | 'HR_OFFICER';

export interface User {
  id: string;
  email: string;
  role: Role;
  businessId: string;
  companyId?: string;
  displayName?: string;
  name?: string;
  photoURL?: string;
  position?: string;
  departments?: string[];
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  canApproveQuotations?: boolean;
  canApproveInvoices?: boolean;
  canOverrideHR?: boolean;
  canFinalizeDocuments?: boolean;
  canRejectDocuments?: boolean;
  canReturnForEditing?: boolean;
  canViewApprovalHistory?: boolean;
  canApproveAcrossAllDepartments?: boolean;
  canReceiveApprovalNotifications?: boolean;
  approvalRights?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface CompanyData {
  id?: string;
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  country?: string;
  website?: string;
  registrationNumber?: string;
  taxNumber?: string; // VAT or Tax ID
  industry?: string;
  
  // Currency settings
  currency?: string; // "SZL", "ZAR", "USD", "EUR", "GBP", etc.
  currencySymbol?: string; // "E", "R", "$", "€", "£", etc.
  
  // Brand assets
  logo?: string;
  letterheadLogo?: string;
  letterheadHeader?: string;
  letterheadFooter?: string;
  favicon?: string;
  digitalStamp?: string;
  useCompanyLetterhead?: boolean;
  letterheadWidthFit?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  
  // Onboarding & Subscription
  isOnboardingCompleted?: boolean;
  subscriptionPlanId?: 'starter' | 'business' | 'enterprise' | string;
  subscriptionStatus?: 'trial' | 'active' | 'grace_period' | 'expired' | 'cancelled';
  trialActive?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  billingCycle?: 'monthly' | 'annual';
  maxUsers?: number;
  
  // Security and UI customization
  inactivityTimeout?: number;
  themePreset?: string;
  themeMode?: "light" | "warm" | "dim" | "dark";
  fontFamily?: "inter" | "space_grotesk" | "playfair" | "jetbrains_mono" | "outfit";
  cardRadius?: "none" | "md" | "lg" | "xl" | "full";
  sidebarStyle?: "flat" | "colored" | "gradient" | "bordered";
  lockedFeatures?: string[];
  enabledModules?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Business {
  id: string;
  name: string;
  createdAt: string;
  currency?: string;
  currencySymbol?: string;
  ownerId?: string;
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
  id?: string;
  email: string;
  companyId?: string;
  companyName?: string;
  name?: string;
  role: Role;
  position?: string;
  departments?: string[];
  canApproveQuotations?: boolean;
  canApproveInvoices?: boolean;
  canOverrideHR?: boolean;
  canFinalizeDocuments?: boolean;
  canRejectDocuments?: boolean;
  approvalRights?: boolean;
  authMethod?: 'google' | 'password';
  invitedAt?: string;
  invitedBy?: string;
  status?: 'pending' | 'accepted' | 'revoked';
  claimedByUid?: string;
  claimedAt?: string;
}
