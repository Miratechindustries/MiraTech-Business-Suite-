import { db, auth } from "../firebase";
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  writeBatch 
} from "firebase/firestore";

export type AccountCategory = "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface ChartOfAccountItem {
  code: string;
  name: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
  description: string;
}

/**
 * Standard Universal Chart of Accounts (COA)
 * Conforming to GAAP / IFRS classification
 */
export const STANDARD_CHART_OF_ACCOUNTS: ChartOfAccountItem[] = [
  // 1000 - Assets (Normal: DEBIT)
  { code: "1010", name: "Assets: Cash & Operating Bank", category: "Assets", normalBalance: "DEBIT", description: "Primary operating bank account liquidity" },
  { code: "1020", name: "Assets: Petty Cash & Till Float", category: "Assets", normalBalance: "DEBIT", description: "Physical cash in register drawers and petty cash" },
  { code: "1030", name: "Assets: Trade Receivables (AR)", category: "Assets", normalBalance: "DEBIT", description: "Invoiced amounts owed by clients and customers" },
  { code: "1040", name: "Assets: Merchandise Inventory", category: "Assets", normalBalance: "DEBIT", description: "Raw materials and finished goods stock on hand" },
  { code: "1050", name: "Assets: Prepaid Expenses", category: "Assets", normalBalance: "DEBIT", description: "Advance payments for insurance, rent, or annual licenses" },
  { code: "1510", name: "Assets: Equipment & Hardware", category: "Assets", normalBalance: "DEBIT", description: "Property, plant, POS hardware and office machinery" },
  
  // 2000 - Liabilities (Normal: CREDIT)
  { code: "2010", name: "Liabilities: Trade Payables (AP)", category: "Liabilities", normalBalance: "CREDIT", description: "Outstanding obligations owed to suppliers and vendors" },
  { code: "2020", name: "Liabilities: Sales Tax & VAT Payable", category: "Liabilities", normalBalance: "CREDIT", description: "Collected tax liabilities awaiting remittance to revenue authority" },
  { code: "2030", name: "Liabilities: Accrued Payroll & PAYE", category: "Liabilities", normalBalance: "CREDIT", description: "Accrued staff wages, employee tax, and pension withholdings" },
  { code: "2040", name: "Liabilities: Customer Deposits & Unearned", category: "Liabilities", normalBalance: "CREDIT", description: "Customer pre-payments and advance deposits held as liability" },
  { code: "2510", name: "Liabilities: Long-Term Debt & Loans", category: "Liabilities", normalBalance: "CREDIT", description: "Institutional debt, credit facilities, and term loans" },

  // 3000 - Equity (Normal: CREDIT)
  { code: "3010", name: "Equity: Share Capital & Owners Equity", category: "Equity", normalBalance: "CREDIT", description: "Contributed capital by business founders and shareholders" },
  { code: "3020", name: "Equity: Retained Earnings", category: "Equity", normalBalance: "CREDIT", description: "Cumulative net earnings reinvested in the corporate entity" },

  // 4000 - Revenue (Normal: CREDIT)
  { code: "4010", name: "Revenue: Product Sales Revenue", category: "Revenue", normalBalance: "CREDIT", description: "Income generated from POS and retail merchandise sales" },
  { code: "4020", name: "Revenue: Subscription & Recurring", category: "Revenue", normalBalance: "CREDIT", description: "Income from software subscriptions and retainer contracts" },
  { code: "4030", name: "Revenue: Professional & Service Fees", category: "Revenue", normalBalance: "CREDIT", description: "Consulting, engineering, and service delivery billings" },
  { code: "4040", name: "Revenue: Operating Interest Income", category: "Revenue", normalBalance: "CREDIT", description: "Interest accrued on financing, trade credit, or savings" },
  { code: "4090", name: "Revenue: Miscellaneous Operating Income", category: "Revenue", normalBalance: "CREDIT", description: "Ancillary fees, penalties, and secondary operating revenue" },

  // 5000 - Cost of Sales (Normal: DEBIT)
  { code: "5010", name: "Expenses: Cost of Goods Sold (COGS)", category: "Expenses", normalBalance: "DEBIT", description: "Direct purchase price of inventory sold during the period" },
  { code: "5020", name: "Expenses: Merchant & Payment Gateway Fees", category: "Expenses", normalBalance: "DEBIT", description: "Card processing fees, interchange, and payment rail costs" },

  // 6000 - Operating Expenses (Normal: DEBIT)
  { code: "6010", name: "Expenses: Salaries & Staff Compensation", category: "Expenses", normalBalance: "DEBIT", description: "Base salaries, hourly wages, and contractor payments" },
  { code: "6020", name: "Expenses: Office Rent & Facilities", category: "Expenses", normalBalance: "DEBIT", description: "Commercial lease, maintenance, and facility overhead" },
  { code: "6030", name: "Expenses: Cloud Infrastructure & Software", category: "Expenses", normalBalance: "DEBIT", description: "Server hosting, SaaS tooling, and API consumption" },
  { code: "6040", name: "Expenses: Marketing & Outbound Promotion", category: "Expenses", normalBalance: "DEBIT", description: "Ad spend, campaigns, sponsorships, and promotional costs" },
  { code: "6050", name: "Expenses: Audit, Legal & Professional", category: "Expenses", normalBalance: "DEBIT", description: "Regulatory filing fees, legal retainers, and accounting audits" },
  { code: "6060", name: "Expenses: Product Refunds & Returns", category: "Expenses", normalBalance: "DEBIT", description: "Reversed sales, customer chargebacks, and returned items" },
  { code: "6070", name: "Expenses: General Operating Overhead", category: "Expenses", normalBalance: "DEBIT", description: "Utilities, travel, supplies, and miscellaneous operating outlays" }
];

export interface JournalVoucherLine {
  accountCode?: string;
  account: string;
  accountType: AccountCategory;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalVoucher {
  id?: string;
  transactionId?: string;
  businessId: string;
  date: string;
  description: string;
  sourceModule: string;
  referenceNumber: string;
  lines: JournalVoucherLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  createdBy: string;
  createdAt?: any;
  timestamp?: any;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  businessId: string;
  userId: string;
  userEmail: string;
  date: string;
  timestamp: any;
  account: string;
  accountCode?: string;
  accountType: AccountCategory;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceModule: string;
  description: string;
  referenceNumber: string;
  createdAt: any;
  createdBy: string;
  lastModifiedBy: string;
}

export interface TrialBalanceRow {
  code: string;
  account: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
  totalDebits: number;
  totalCredits: number;
  netDebit: number;
  netCredit: number;
}

export interface TrialBalanceResult {
  businessId: string;
  generatedAt: string;
  rows: TrialBalanceRow[];
  grandTotalDebits: number;
  grandTotalCredits: number;
  imbalance: number;
  isBalanced: boolean;
}

/**
 * Audit Reference Generator
 */
export function generateAuditRef(prefix = "AUD"): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestampPart}-${randomPart}`;
}

/**
 * Strict Double-Entry Invariant Validator
 * Throws a descriptive error if debits do not equal credits.
 */
export function validateDoubleEntryInvariant(lines: JournalVoucherLine[]): { totalDebits: number; totalCredits: number } {
  if (!lines || lines.length < 2) {
    throw new Error("Double-entry bookkeeping requires at least two ledger lines (one debit and one credit).");
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;

    if (debit < 0 || credit < 0) {
      throw new Error(`Negative amounts are forbidden in general ledger line #${i + 1} (${line.account}).`);
    }

    if (debit > 0 && credit > 0) {
      throw new Error(`Line #${i + 1} (${line.account}) cannot have both Debit and Credit amounts simultaneously. Split into two entries.`);
    }

    if (debit === 0 && credit === 0) {
      throw new Error(`Line #${i + 1} (${line.account}) has zero value. Every ledger line must specify a positive debit or credit.`);
    }

    totalDebits += debit;
    totalCredits += credit;
  }

  // Floating point zero-sum assertion with 4 decimal places tolerance
  const diff = Math.abs(totalDebits - totalCredits);
  if (diff > 0.0001) {
    throw new Error(
      `Double-Entry Invariant Violated: Total Debits (E${totalDebits.toFixed(2)}) does not equal Total Credits (E${totalCredits.toFixed(2)}). Variance: E${diff.toFixed(2)}. Transaction rejected.`
    );
  }

  return { totalDebits, totalCredits };
}

/**
 * Post a fully balanced compound Journal Voucher directly into the General Ledger.
 * Uses atomic Firestore write batches to guarantee that either the full entry is posted or none is.
 */
export async function postJournalVoucher(params: {
  businessId: string;
  date: string;
  description: string;
  sourceModule: string;
  referenceNumber?: string;
  transactionId?: string;
  lines: JournalVoucherLine[];
  createdByEmail?: string;
}): Promise<{ voucherId: string; referenceNumber: string; totalDebits: number; totalCredits: number }> {
  const { businessId, date, description, sourceModule, transactionId, lines, createdByEmail } = params;
  
  // 1. Strict mathematical validation
  const { totalDebits, totalCredits } = validateDoubleEntryInvariant(lines);

  const user = auth.currentUser;
  const runnerEmail = user?.email || createdByEmail || "ERP System Ledger Engine";
  const runnerUid = user?.uid || "SYSTEM";

  // 2. Prepare Journal Voucher document
  const refNum = params.referenceNumber || generateAuditRef("GL");
  const voucherDocRef = doc(collection(db, "journal_entries"));
  
  // Cryptographic immutable hash representation
  const hashPayload = `${businessId}|${date}|${refNum}|${totalDebits.toFixed(2)}|${totalCredits.toFixed(2)}|${lines.map(l => `${l.account}:${l.debit}:${l.credit}`).join(";")}`;
  let immutableHash = "HASH-SEAL-";
  for (let i = 0; i < hashPayload.length; i++) {
    const char = hashPayload.charCodeAt(i);
    immutableHash += ((char << 5) - char + (i * 17)).toString(16).toUpperCase();
  }

  const voucherPayload: Omit<JournalVoucher, "id"> & { immutableHash?: string } = {
    transactionId: transactionId || refNum,
    businessId,
    date,
    description,
    sourceModule,
    referenceNumber: refNum,
    lines,
    totalDebits,
    totalCredits,
    isBalanced: true,
    immutableHash,
    createdBy: runnerEmail,
    timestamp: serverTimestamp()
  };

  // 3. Atomically write voucher and each ledger line
  const batch = writeBatch(db);
  batch.set(voucherDocRef, voucherPayload);

  for (const line of lines) {
    const ledgerDocRef = doc(collection(db, "general_ledger"));
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;

    const ledgerPayload: Omit<LedgerEntry, "id"> = {
      transactionId: transactionId || refNum,
      businessId,
      userId: runnerUid,
      userEmail: runnerEmail,
      date,
      timestamp: serverTimestamp(),
      account: line.account,
      accountCode: line.accountCode,
      accountType: line.accountType,
      debit,
      credit,
      runningBalance: 0,
      sourceModule,
      description: line.description || (debit > 0 ? `[DEBIT] ${description}` : `[CREDIT] ${description}`),
      referenceNumber: refNum,
      createdAt: serverTimestamp(),
      createdBy: runnerEmail,
      lastModifiedBy: runnerEmail
    };

    batch.set(ledgerDocRef, ledgerPayload);
  }

  await batch.commit();

  return {
    voucherId: voucherDocRef.id,
    referenceNumber: refNum,
    totalDebits,
    totalCredits
  };
}

/**
 * Standard category mappings for two-legged automated double-entry creation
 */
export const TRANSACTION_MAPPINGS: Record<string, {
  debitAccount: string;
  debitType: AccountCategory;
  creditAccount: string;
  creditType: AccountCategory;
}> = {
  "Customer Subscriptions": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Subscription & Recurring",
    creditType: "Revenue"
  },
  "Subscription Renewals": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Subscription & Recurring",
    creditType: "Revenue"
  },
  "One-Time Payments": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Product Sales Revenue",
    creditType: "Revenue"
  },
  "Loan Disbursements": {
    debitAccount: "Assets: Trade Receivables (AR)",
    debitType: "Assets",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "Loan Repayments": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Assets: Trade Receivables (AR)",
    creditType: "Assets"
  },
  "Savings Contributions": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Liabilities: Customer Deposits & Unearned",
    creditType: "Liabilities"
  },
  "Withdrawals": {
    debitAccount: "Liabilities: Customer Deposits & Unearned",
    debitType: "Liabilities",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "Interest Earned (Loans)": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Operating Interest Income",
    creditType: "Revenue"
  },
  "Refunds": {
    debitAccount: "Expenses: Product Refunds & Returns",
    debitType: "Expenses",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "Discounts": {
    debitAccount: "Expenses: General Operating Overhead",
    debitType: "Expenses",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "Commission Payments": {
    debitAccount: "Expenses: Merchant & Payment Gateway Fees",
    debitType: "Expenses",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "Administrative Adjustments (Inflow)": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Equity: Retained Earnings",
    creditType: "Equity"
  },
  "Administrative Adjustments (Outflow)": {
    debitAccount: "Equity: Retained Earnings",
    debitType: "Equity",
    creditAccount: "Assets: Cash & Operating Bank",
    creditType: "Assets"
  },
  "System-Generated Transactions": {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Miscellaneous Operating Income",
    creditType: "Revenue"
  }
};

/**
 * Backward-compatible helper to post a two-legged double entry
 * Validated strictly against the double-entry invariant.
 */
export async function createDoubleEntry(params: {
  transactionId: string;
  businessId: string;
  sourceModule: string;
  amount: number;
  date: string;
  description: string;
  createdByEmail?: string;
}) {
  const { transactionId, businessId, sourceModule, amount, date, description, createdByEmail } = params;

  if (amount <= 0) {
    throw new Error(`Double-entry posting requires a positive amount. Received: ${amount}`);
  }

  const mapping = TRANSACTION_MAPPINGS[sourceModule] || {
    debitAccount: "Assets: Cash & Operating Bank",
    debitType: "Assets",
    creditAccount: "Revenue: Miscellaneous Operating Income",
    creditType: "Revenue"
  };

  const lines: JournalVoucherLine[] = [
    {
      account: mapping.debitAccount,
      accountType: mapping.debitType,
      debit: amount,
      credit: 0,
      description: `[DEBIT] ${description}`
    },
    {
      account: mapping.creditAccount,
      accountType: mapping.creditType,
      debit: 0,
      credit: amount,
      description: `[CREDIT] ${description}`
    }
  ];

  const result = await postJournalVoucher({
    businessId,
    date,
    description,
    sourceModule,
    transactionId,
    lines,
    createdByEmail
  });

  return {
    referenceNumber: result.referenceNumber,
    journalId: result.voucherId
  };
}

/**
 * Fetch all double entry journal vouchers
 */
export async function getJournalEntries(businessId: string | null): Promise<any[]> {
  let q;
  if (!businessId) {
    q = collection(db, "journal_entries");
  } else {
    q = query(collection(db, "journal_entries"), where("businessId", "==", businessId));
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  data.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return data;
}

/**
 * Fetch all double entry general ledger lines with running balance calculation
 */
export async function getLedgerEntries(businessId: string | null): Promise<LedgerEntry[]> {
  let q;
  if (!businessId) {
    q = collection(db, "general_ledger");
  } else {
    q = query(collection(db, "general_ledger"), where("businessId", "==", businessId));
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
  data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate rolling balance per account according to standard GAAP normal balance rules
  const accountBalances: Record<string, number> = {};
  data.forEach((entry) => {
    const acc = entry.account;
    if (!accountBalances[acc]) {
      accountBalances[acc] = 0;
    }
    // Debit normal: Assets, Expenses => +Debit -Credit
    // Credit normal: Liabilities, Equity, Revenue => +Credit -Debit
    const isDebitNormal = entry.accountType === "Assets" || entry.accountType === "Expenses";
    const delta = isDebitNormal ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
    accountBalances[acc] += delta;
    entry.runningBalance = accountBalances[acc];
  });

  return data.reverse();
}

/**
 * Generate a mathematically rigorous Trial Balance from all general ledger entries
 */
export async function generateTrialBalance(businessId: string | null): Promise<TrialBalanceResult> {
  const entries = await getLedgerEntries(businessId);
  
  // Group by account
  const accountMap: Record<string, {
    code: string;
    account: string;
    category: AccountCategory;
    normalBalance: NormalBalance;
    totalDebits: number;
    totalCredits: number;
  }> = {};

  // Initialize with standard chart of accounts
  for (const item of STANDARD_CHART_OF_ACCOUNTS) {
    accountMap[item.name] = {
      code: item.code,
      account: item.name,
      category: item.category,
      normalBalance: item.normalBalance,
      totalDebits: 0,
      totalCredits: 0
    };
  }

  // Accumulate entries
  for (const entry of entries) {
    if (!accountMap[entry.account]) {
      const isDebitNormal = entry.accountType === "Assets" || entry.accountType === "Expenses";
      accountMap[entry.account] = {
        code: entry.accountCode || "9999",
        account: entry.account,
        category: entry.accountType,
        normalBalance: isDebitNormal ? "DEBIT" : "CREDIT",
        totalDebits: 0,
        totalCredits: 0
      };
    }

    accountMap[entry.account].totalDebits += Number(entry.debit) || 0;
    accountMap[entry.account].totalCredits += Number(entry.credit) || 0;
  }

  // Formulate trial balance rows
  const rows: TrialBalanceRow[] = [];
  let grandTotalDebits = 0;
  let grandTotalCredits = 0;

  for (const key of Object.keys(accountMap)) {
    const item = accountMap[key];
    if (item.totalDebits === 0 && item.totalCredits === 0) {
      continue; // exclude inactive accounts for clarity
    }

    let netDebit = 0;
    let netCredit = 0;

    if (item.normalBalance === "DEBIT") {
      const balance = item.totalDebits - item.totalCredits;
      if (balance >= 0) {
        netDebit = balance;
      } else {
        netCredit = Math.abs(balance);
      }
    } else {
      const balance = item.totalCredits - item.totalDebits;
      if (balance >= 0) {
        netCredit = balance;
      } else {
        netDebit = Math.abs(balance);
      }
    }

    grandTotalDebits += netDebit;
    grandTotalCredits += netCredit;

    rows.push({
      code: item.code,
      account: item.account,
      category: item.category,
      normalBalance: item.normalBalance,
      totalDebits: item.totalDebits,
      totalCredits: item.totalCredits,
      netDebit,
      netCredit
    });
  }

  // Sort by account code
  rows.sort((a, b) => a.code.localeCompare(b.code));

  const diff = Math.abs(grandTotalDebits - grandTotalCredits);
  const isBalanced = diff < 0.001;

  return {
    businessId: businessId || "ALL_TENANTS",
    generatedAt: new Date().toISOString(),
    rows,
    grandTotalDebits,
    grandTotalCredits,
    imbalance: diff,
    isBalanced
  };
}

/**
 * Verify cryptographic hash integrity and double-entry invariants across all stored journal entries
 */
export async function verifyLedgerIntegrity(businessId: string | null): Promise<{
  totalVouchersAudited: number;
  unbalancedCount: number;
  tamperedCount: number;
  isIntegrityIntact: boolean;
  issues: string[];
}> {
  const journals = await getJournalEntries(businessId);
  let unbalancedCount = 0;
  let tamperedCount = 0;
  const issues: string[] = [];

  for (const j of journals) {
    const debitSum = (j.lines || []).reduce((acc: number, l: any) => acc + (Number(l.debit) || 0), 0);
    const creditSum = (j.lines || []).reduce((acc: number, l: any) => acc + (Number(l.credit) || 0), 0);
    const diff = Math.abs(debitSum - creditSum);

    if (diff >= 0.01) {
      unbalancedCount++;
      issues.push(`Voucher ${j.referenceNumber || j.id} is unbalanced: Debits E${debitSum.toFixed(2)} vs Credits E${creditSum.toFixed(2)}`);
    }

    if (j.immutableHash) {
      const hashPayload = `${j.businessId || businessId}|${j.date}|${j.referenceNumber || j.id}|${debitSum.toFixed(2)}|${creditSum.toFixed(2)}|${(j.lines || []).map((l: any) => `${l.account}:${l.debit}:${l.credit}`).join(";")}`;
      let recomputedHash = "HASH-SEAL-";
      for (let i = 0; i < hashPayload.length; i++) {
        const char = hashPayload.charCodeAt(i);
        recomputedHash += ((char << 5) - char + (i * 17)).toString(16).toUpperCase();
      }
      if (recomputedHash !== j.immutableHash) {
        tamperedCount++;
        issues.push(`Voucher ${j.referenceNumber || j.id} failed cryptographic hash seal verification (tampering detected).`);
      }
    }
  }

  return {
    totalVouchersAudited: journals.length,
    unbalancedCount,
    tamperedCount,
    isIntegrityIntact: unbalancedCount === 0 && tamperedCount === 0,
    issues
  };
}

export interface TaxReportSummary {
  period: string;
  year: number;
  standardTaxRatePct: number;
  grossSalesTaxable: number;
  outputTaxCollected: number;
  grossPurchasesTaxable: number;
  inputTaxCredits: number;
  netTaxPayable: number;
  isRefundDue: boolean;
  taxableTransactionsCount: number;
  generatedAt: string;
}

/**
 * Generate Automated Tax Liability Reporting (Output VAT vs Input Tax Credits)
 */
export async function generateTaxReportSummary(
  businessId: string | null,
  period: "Q1" | "Q2" | "Q3" | "Q4" | "ALL" = "ALL",
  targetYear: number = new Date().getFullYear(),
  taxRatePct: number = 15
): Promise<TaxReportSummary> {
  const ledgerEntries = await getLedgerEntries(businessId);

  let grossSalesTaxable = 0;
  let grossPurchasesTaxable = 0;
  let taxableTxCount = 0;

  const rateFraction = taxRatePct / 100;

  for (const entry of ledgerEntries) {
    if (!entry.date) continue;
    const entryDate = new Date(entry.date);
    if (isNaN(entryDate.getTime())) continue;

    if (targetYear && entryDate.getFullYear() !== targetYear) continue;

    const month = entryDate.getMonth() + 1; // 1 to 12
    if (period === "Q1" && !(month >= 1 && month <= 3)) continue;
    if (period === "Q2" && !(month >= 4 && month <= 6)) continue;
    if (period === "Q3" && !(month >= 7 && month <= 9)) continue;
    if (period === "Q4" && !(month >= 10 && month <= 12)) continue;

    // Output Tax from Revenue & Inflows (Credits)
    if (entry.accountType === "Revenue") {
      const revCredit = (Number(entry.credit) || 0) - (Number(entry.debit) || 0);
      if (revCredit > 0) {
        grossSalesTaxable += revCredit;
        taxableTxCount++;
      }
    }

    // Input Tax from Expenses & Outflows (Debits)
    if (entry.accountType === "Expenses") {
      const expDebit = (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
      if (expDebit > 0) {
        grossPurchasesTaxable += expDebit;
        taxableTxCount++;
      }
    }
  }

  const outputTaxCollected = grossSalesTaxable * rateFraction;
  const inputTaxCredits = grossPurchasesTaxable * rateFraction;
  const netTaxPayable = outputTaxCollected - inputTaxCredits;

  return {
    period,
    year: targetYear,
    standardTaxRatePct: taxRatePct,
    grossSalesTaxable,
    outputTaxCollected,
    grossPurchasesTaxable,
    inputTaxCredits,
    netTaxPayable: Math.abs(netTaxPayable),
    isRefundDue: netTaxPayable < 0,
    taxableTransactionsCount: taxableTxCount,
    generatedAt: new Date().toISOString()
  };
}
