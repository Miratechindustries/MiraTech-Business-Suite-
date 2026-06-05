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

export interface LedgerEntry {
  id: string;
  transactionId: string;
  businessId: string;
  userId: string;
  userEmail: string;
  date: string;
  timestamp: any;
  account: string; // e.g. "Assets: Cash", "Revenue: Subscriptions"
  accountType: "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses";
  debit: number;
  credit: number;
  runningBalance: number;
  sourceModule: string; // e.g. "Subscriptions", "Loans", "Savings"
  description: string;
  referenceNumber: string; // Unique Audit Reference Number
  createdAt: any;
  createdBy: string;
  lastModifiedBy: string;
}

export interface JournalEntry {
  id: string;
  transactionId: string;
  businessId: string;
  date: string;
  description: string;
  sourceModule: string;
  referenceNumber: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  createdBy: string;
  timestamp: any;
}

// Map transaction categories to debits/credits
export interface TxMapping {
  debitAccount: string;
  debitType: "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses";
  creditAccount: string;
  creditType: "Assets" | "Liabilities" | "Equity" | "Revenue" | "Expenses";
}

export const TRANSACTION_MAPPINGS: Record<string, TxMapping> = {
  "Customer Subscriptions": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Client Sales Revenue",
    creditType: "Revenue"
  },
  "Subscription Renewals": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Client Sales Revenue",
    creditType: "Revenue"
  },
  "One-Time Payments": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Product & Service Revenue",
    creditType: "Revenue"
  },
  "Loan Disbursements": {
    debitAccount: "Assets: Trade Receivables",
    debitType: "Assets",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "Loan Repayments": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Assets: Trade Receivables",
    creditType: "Assets"
  },
  "Savings Contributions": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Liabilities: Client Deposits Liability",
    creditType: "Liabilities"
  },
  "Withdrawals": {
    debitAccount: "Liabilities: Client Deposits Liability",
    debitType: "Liabilities",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "Interest Earned (Savings)": {
    debitAccount: "Expenses: Operating Interest Costs",
    debitType: "Expenses",
    creditAccount: "Liabilities: Client Deposits Liability",
    creditType: "Liabilities"
  },
  "Interest Earned (Loans)": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Operating Interest Income",
    creditType: "Revenue"
  },
  "Penalties and Fees": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Fee & Penalty Revenue",
    creditType: "Revenue"
  },
  "Refunds": {
    debitAccount: "Expenses: Product Refunds Outlay",
    debitType: "Expenses",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "Discounts": {
    debitAccount: "Expenses: Sales Discounts & Incentives",
    debitType: "Expenses",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "Commission Payments": {
    debitAccount: "Expenses: Sales Commissions Paid",
    debitType: "Expenses",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "Administrative Adjustments (Inflow)": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Equity: Retained Earnings",
    creditType: "Equity"
  },
  "Administrative Adjustments (Outflow)": {
    debitAccount: "Equity: Retained Earnings",
    debitType: "Equity",
    creditAccount: "Assets: Cash",
    creditType: "Assets"
  },
  "System-Generated Transactions": {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: System Operating Income",
    creditType: "Revenue"
  }
};

/**
 * Generate a unique, compliant audit reference number
 */
export function generateAuditRef(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "AUD-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a Double-Entry Ledger Record for a Transaction inside Firestore
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
  const user = auth.currentUser;
  const runner = user?.email || createdByEmail || "System Engine";
  const userId = user?.uid || "SYSTEM";

  const mapping = TRANSACTION_MAPPINGS[sourceModule] || {
    debitAccount: "Assets: Cash",
    debitType: "Assets",
    creditAccount: "Revenue: Unassigned Revenue",
    creditType: "Revenue"
  };

  const refNum = generateAuditRef();

  // Create Journal record
  const journalPayload: Omit<JournalEntry, "id"> = {
    transactionId,
    businessId,
    date,
    description,
    sourceModule,
    referenceNumber: refNum,
    debitAccount: mapping.debitAccount,
    creditAccount: mapping.creditAccount,
    amount,
    createdBy: runner,
    timestamp: serverTimestamp()
  };

  const journalRef = await addDoc(collection(db, "journal_entries"), journalPayload);

  // Debit entry line
  const debitPayload: Omit<LedgerEntry, "id"> = {
    transactionId,
    businessId,
    userId,
    userEmail: runner,
    date,
    timestamp: serverTimestamp(),
    account: mapping.debitAccount,
    accountType: mapping.debitType,
    debit: amount,
    credit: 0,
    runningBalance: 0, // Calculated dynamically
    sourceModule,
    description: `[DEBIT] ${description}`,
    referenceNumber: refNum,
    createdAt: serverTimestamp(),
    createdBy: runner,
    lastModifiedBy: runner
  };

  // Credit entry line
  const creditPayload: Omit<LedgerEntry, "id"> = {
    transactionId,
    businessId,
    userId,
    userEmail: runner,
    date,
    timestamp: serverTimestamp(),
    account: mapping.creditAccount,
    accountType: mapping.creditType,
    debit: 0,
    credit: amount,
    runningBalance: 0, // Calculated dynamically
    sourceModule,
    description: `[CREDIT] ${description}`,
    referenceNumber: refNum,
    createdAt: serverTimestamp(),
    createdBy: runner,
    lastModifiedBy: runner
  };

  const batch = writeBatch(db);
  const debitDocRef = doc(collection(db, "general_ledger"));
  const creditDocRef = doc(collection(db, "general_ledger"));

  batch.set(debitDocRef, debitPayload);
  batch.set(creditDocRef, creditPayload);

  await batch.commit();

  return {
    referenceNumber: refNum,
    journalId: journalRef.id
  };
}

/**
 * Fetch all double entry journal logs
 */
export async function getJournalEntries(businessId: string | null): Promise<JournalEntry[]> {
  let q;
  if (!businessId) {
    q = collection(db, "journal_entries");
  } else {
    q = query(collection(db, "journal_entries"), where("businessId", "==", businessId));
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));
  data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return data;
}

/**
 * Fetch all double entry general ledger lines
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
  
  // Calculate rolling balance per account type securely / client side
  const accountBalances: Record<string, number> = {};
  data.forEach((entry) => {
    const acc = entry.account;
    if (!accountBalances[acc]) {
      accountBalances[acc] = 0;
    }
    const sign = (entry.accountType === "Assets" || entry.accountType === "Expenses") ? 1 : -1;
    accountBalances[acc] += sign * (entry.debit - entry.credit);
    entry.runningBalance = accountBalances[acc];
  });

  return data.reverse(); // Newest first
}
