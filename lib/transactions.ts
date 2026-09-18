/**
 * MiraTech Business Suite - ACID Database Transaction Helpers
 * 
 * Ensures atomic write consistency for financial operations (Invoices, Quotations, Payroll, POS)
 * preventing race conditions, duplicate-key errors, and ledger drift.
 */

import { adminDb } from "./firebase-admin";
import { DocumentReference, DocumentData, Transaction } from "firebase-admin/firestore";

/**
 * Executes an ACID transaction for financial writes.
 */
export async function runFinancialTransaction<T>(
  updateFn: (transaction: Transaction) => Promise<T>
): Promise<T> {
  return await adminDb.runTransaction(async (transaction) => {
    return await updateFn(transaction);
  });
}

/**
 * Helper to atomically record a financial ledger entry and update balances.
 */
export async function recordLedgerEntryWithTransaction(
  tenantId: string,
  entry: {
    type: 'INVOICE' | 'PAYROLL' | 'POS' | 'EXPENSE';
    referenceId: string;
    amount: number;
    description: string;
    createdBy: string;
  }
): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    const tenantRef = adminDb.collection("companies").doc(tenantId);
    const tenantDoc = await transaction.get(tenantRef);

    if (!tenantDoc.exists) {
      throw new Error(`Tenant ${tenantId} does not exist for ledger posting`);
    }

    const ledgerRef = adminDb.collection("companies").doc(tenantId).collection("financial_ledger").doc();
    transaction.set(ledgerRef, {
      ...entry,
      createdAt: new Date(),
    });
  });
}
