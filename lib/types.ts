export type Role = 
  | 'MASTER_ADMIN' 
  | 'SUPER_ADMIN'
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

export interface ScopedPermissions {
  canEditCompanyProfile?: boolean;
  canCreateQuotations?: boolean;
  canApproveQuotations?: boolean;
  canCreateInvoices?: boolean;
  canApproveInvoices?: boolean;
  canCreateReceipts?: boolean;
  canApproveTransactions?: boolean;
  canApproveExpenses?: boolean;
  canOverrideHR?: boolean;
  canManageStaff?: boolean;
  canExportReports?: boolean;
  canViewAuditLogs?: boolean;
  canFinalizeDocuments?: boolean;
  canRejectDocuments?: boolean;
  canReturnForEditing?: boolean;
  canViewApprovalHistory?: boolean;
  approvalRights?: boolean;
}

export interface User extends ScopedPermissions {
  id: string;
  email: string;
  role: Role;
  companyId: string;
  name: string;
  photoURL?: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  subscriptionPlanId: string;
  subscriptionPlanName: string;
  scheduledSubscriptionPlanId?: string;
  scheduledSubscriptionPlanName?: string;
  scheduledAt?: string;
  autoRenew: boolean;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  date: string;
  validUntil: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  total: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  total: number;
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  notes?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  clientName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}
