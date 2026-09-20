import { db } from "./firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  writeBatch,
  query,
  limit
} from "firebase/firestore";

export interface DatabaseTableDefinition {
  name: string;
  category: "core" | "financial" | "procurement" | "hr" | "marketing" | "system" | "compliance";
  description: string;
  primaryKey: string;
  sampleRecord?: Record<string, any>;
  indexes?: string[];
}

export const DATABASE_TABLE_REGISTRY: DatabaseTableDefinition[] = [
  {
    name: "companies",
    category: "core",
    description: "Corporate workspace profiles, tenant settings, branding, and active modules.",
    primaryKey: "companyId",
    sampleRecord: {
      name: "MiraTech Industries",
      legalName: "MiraTech Industries LLC",
      registrationNumber: "REG-2026-001",
      taxVatNumber: "VAT-998822",
      industry: "Technology & Professional Services",
      businessType: "Corporation",
      address: "100 Innovation Parkway, Suite 400",
      city: "London",
      country: "United Kingdom",
      currency: "USD",
      activeModules: ["accounting", "invoices", "inventory", "payroll", "procurement", "marketing"],
      activeDepartments: ["executive", "finance", "operations", "sales", "hr"],
      isVerified: true,
      subscriptionPlanId: "growth",
      subscriptionStatus: "active",
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "users",
    category: "core",
    description: "Multi-tenant user profiles, RBAC permissions, and authentication credentials.",
    primaryKey: "userId",
    sampleRecord: {
      displayName: "Master Administrator",
      email: "miratechindustries@gmail.com",
      role: "MASTER_ADMIN",
      positionTitle: "Chief Executive Officer",
      status: "ACTIVE",
      isVerified: true,
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "invoices",
    category: "financial",
    description: "Sales invoices, receivables, line items, and tax calculations.",
    primaryKey: "invoiceId"
  },
  {
    name: "quotations",
    category: "financial",
    description: "Commercial quotations, bids, client proposals, and validity dates.",
    primaryKey: "quotationId"
  },
  {
    name: "receipts",
    category: "financial",
    description: "Payment receipts, automated reconciliation stamps, and payment methods.",
    primaryKey: "receiptId"
  },
  {
    name: "chart_of_accounts",
    category: "financial",
    description: "General Ledger Chart of Accounts structure (Assets, Liabilities, Equity, Revenue, Expense).",
    primaryKey: "accountCode"
  },
  {
    name: "journal_entries",
    category: "financial",
    description: "Double-entry bookkeeping journal entries and transactions.",
    primaryKey: "entryId"
  },
  {
    name: "products",
    category: "procurement",
    description: "Inventory items, catalog SKUs, stock levels, unit pricing, and reorder thresholds.",
    primaryKey: "productId"
  },
  {
    name: "suppliers",
    category: "procurement",
    description: "Vendor database, payment terms, contact details, and supplier ratings.",
    primaryKey: "supplierId"
  },
  {
    name: "purchase_orders",
    category: "procurement",
    description: "Purchase orders dispatched to vendors and fulfillment tracking.",
    primaryKey: "poId"
  },
  {
    name: "purchase_requests",
    category: "procurement",
    description: "Internal departmental purchase requests and procurement approvals.",
    primaryKey: "prId"
  },
  {
    name: "rfqs",
    category: "procurement",
    description: "Requests for Quotations sent to vendors for competitive bidding.",
    primaryKey: "rfqId"
  },
  {
    name: "employees",
    category: "hr",
    description: "Employee records, departments, job titles, and compensation packages.",
    primaryKey: "employeeId"
  },
  {
    name: "payroll_runs",
    category: "hr",
    description: "Historical payroll execution runs, net pays, statutory taxes, and disbursement logs.",
    primaryKey: "runId"
  },
  {
    name: "marketing_campaigns",
    category: "marketing",
    description: "Omnichannel marketing campaigns, social metrics, ROI, and lead conversion.",
    primaryKey: "campaignId"
  },
  {
    name: "SupportMessages",
    category: "system",
    description: "Customer service desk inquiries, support tickets, and response threads.",
    primaryKey: "ticketId"
  },
  {
    name: "audit_logs",
    category: "compliance",
    description: "Immutable statutory audit trail, security events, and administrative actions.",
    primaryKey: "logId"
  },
  {
    name: "system_config",
    category: "system",
    description: "Platform-wide configurations, operational status, and system versioning.",
    primaryKey: "configKey"
  },
  {
    name: "legal_documents",
    category: "compliance",
    description: "Platform legal terms, GDPR policies, DPA, and master service agreements.",
    primaryKey: "documentSlug"
  }
];

export const STANDARD_CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Operating Cash & Bank Account", type: "ASSET", category: "Current Assets" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", category: "Current Assets" },
  { code: "1200", name: "Inventory Asset", type: "ASSET", category: "Current Assets" },
  { code: "1500", name: "Office Equipment & Property", type: "ASSET", category: "Non-Current Assets" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", category: "Current Liabilities" },
  { code: "2100", name: "Sales Tax / VAT Payable", type: "LIABILITY", category: "Current Liabilities" },
  { code: "2200", name: "Payroll & Withholding Liabilities", type: "LIABILITY", category: "Current Liabilities" },
  { code: "3000", name: "Owner / Shareholder Equity", type: "EQUITY", category: "Equity" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", category: "Equity" },
  { code: "4000", name: "Operating Sales Revenue", type: "REVENUE", category: "Operating Revenue" },
  { code: "4100", name: "Service & Consulting Revenue", type: "REVENUE", category: "Operating Revenue" },
  { code: "5000", name: "Cost of Goods Sold (COGS)", type: "EXPENSE", category: "Direct Costs" },
  { code: "6000", name: "Salaries & Wages Expense", type: "EXPENSE", category: "Operating Expenses" },
  { code: "6100", name: "Rent & Facilities Expense", type: "EXPENSE", category: "Operating Expenses" },
  { code: "6200", name: "Marketing & Advertising Expense", type: "EXPENSE", category: "Operating Expenses" },
  { code: "6300", name: "Technology & Software Subscriptions", type: "EXPENSE", category: "Operating Expenses" },
];

/**
 * Initializes and validates core database collections & default configuration tables.
 */
export async function initializeDatabaseTables(targetCompanyId?: string): Promise<{
  success: boolean;
  initializedTables: string[];
  errors: string[];
}> {
  const initializedTables: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Initialize system_config table
    const sysConfigRef = doc(db, "system_config", "general");
    const sysConfigSnap = await getDoc(sysConfigRef);
    if (!sysConfigSnap.exists()) {
      await setDoc(sysConfigRef, {
        platformName: "MiraTech Business Suite",
        version: "3.5.0-enterprise",
        status: "OPERATIONAL",
        maintenanceMode: false,
        lastSchemaBuild: new Date().toISOString(),
        supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "ZAR", "KES", "NGN", "AED"],
        defaultTaxRatePercent: 15,
        defaultPaymentTermsDays: 30,
        createdAt: new Date().toISOString()
      });
      initializedTables.push("system_config");
    }

    // 2. Initialize Standard Chart of Accounts if companyId provided
    if (targetCompanyId) {
      const coaCol = collection(db, "companies", targetCompanyId, "chart_of_accounts");
      const coaSnap = await getDocs(query(coaCol, limit(1)));
      if (coaSnap.empty) {
        const batch = writeBatch(db);
        for (const account of STANDARD_CHART_OF_ACCOUNTS) {
          const accDoc = doc(coaCol, account.code);
          batch.set(accDoc, {
            ...account,
            companyId: targetCompanyId,
            balance: 0,
            active: true,
            createdAt: new Date().toISOString()
          });
        }
        await batch.commit();
        initializedTables.push("companies/{id}/chart_of_accounts");
      }
    }

    return {
      success: errors.length === 0,
      initializedTables,
      errors
    };
  } catch (err: any) {
    errors.push(err.message || String(err));
    return {
      success: false,
      initializedTables,
      errors
    };
  }
}
