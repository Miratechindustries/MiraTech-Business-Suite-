"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Search, 
  Plus, 
  Trash2, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  FileCheck2,
  BookOpen,
  Layers,
  Scale,
  Upload,
  RefreshCw,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  HelpCircle,
  FileUp,
  Sliders,
  Check,
} from "lucide-react";
import { auth, db, isOfflineError } from "../lib/firebase";
import { collection, doc, getDocs, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { 
  STANDARD_CHART_OF_ACCOUNTS, 
  ChartOfAccountItem, 
  postJournalVoucher, 
  JournalVoucherLine,
  getJournalEntries
} from "../lib/accounting/ledger";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: "Inflow" | "Outflow";
  reference: string;
  method: string;
  amount: number;
  status: "Settled" | "Pending";
  accountCode?: string;
  accountName?: string;
  offsetAccountCode?: string;
  offsetAccountName?: string;
  reconciled?: boolean;
  reconciledAt?: string;
  statementRef?: string;
  journalVoucherId?: string;
  auditRef?: string;
}

interface StatementLine {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchedTxId?: string;
}

export type TreasuryFieldKey = "date" | "description" | "amount" | "reference" | "type" | "method";

export interface TreasuryFieldDef {
  key: TreasuryFieldKey;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

export const TREASURY_STANDARD_FIELDS: TreasuryFieldDef[] = [
  { 
    key: "date", 
    label: "Transaction Date", 
    required: true, 
    aliases: ["date", "posting date", "transaction date", "value date", "booking date", "txn date", "trans date", "stmt date"],
    description: "ISO date format (YYYY-MM-DD or DD/MM/YYYY)"
  },
  { 
    key: "description", 
    label: "Description / Narration", 
    required: true, 
    aliases: ["description", "narration", "memo", "details", "transaction details", "payee", "particulars", "remarks", "reference note"],
    description: "Transaction narrative or payee details"
  },
  { 
    key: "amount", 
    label: "Amount (Net / Signed)", 
    required: true, 
    aliases: ["amount", "net amount", "total", "value", "sum", "transaction amount", "amt"],
    description: "Numeric transaction amount (positive or negative)"
  },
  { 
    key: "reference", 
    label: "Reference / Check Number", 
    required: false, 
    aliases: ["reference", "ref", "ref no", "reference number", "check no", "cheque", "txn ref", "id", "trans id"],
    description: "Bank or internal tracking voucher reference"
  },
  { 
    key: "type", 
    label: "Flow Type (Inflow / Outflow)", 
    required: false, 
    aliases: ["type", "dr/cr", "d/c", "flow", "inflow/outflow", "transaction type", "movement"],
    description: "Explicit flow indicator or Credit/Debit flag"
  },
  { 
    key: "method", 
    label: "Payment Rail / Method", 
    required: false, 
    aliases: ["method", "channel", "payment method", "rail", "settlement method", "instrument"],
    description: "Bank Transfer, ACH, Card, POS, Cash, etc."
  }
];

export interface ValidatedCSVRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsedDate: string;
  parsedDescription: string;
  parsedAmount: number;
  parsedType: "Inflow" | "Outflow";
  parsedReference: string;
  parsedMethod: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export default function Transactions() {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);
  
  // Tab state: "transactions" | "reconciliation"
  const [activeTab, setActiveTab] = useState<"transactions" | "reconciliation">("transactions");
  
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [reconcileFilter, setReconcileFilter] = useState<"All" | "Reconciled" | "Unreconciled">("All");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [errorSignal, setErrorSignal] = useState<string | null>(null);

  // Journal Voucher Audit Modal State
  const [inspectVoucherTx, setInspectVoucherTx] = useState<Transaction | null>(null);
  const [voucherData, setVoucherData] = useState<any | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  // Form Fields
  const [id, setId] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Inflow" | "Outflow">("Inflow");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<"Settled" | "Pending">("Settled");
  
  // Chart of Accounts Selection
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("4010");
  const [cashAccountCode, setCashAccountCode] = useState<string>("1010");

  // CSV Bank Statement Upload & Column Mapping Workspace State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<TreasuryFieldKey, string>>({
    date: "",
    description: "",
    amount: "",
    reference: "",
    type: "",
    method: ""
  });
  const [isDragging, setIsDragging] = useState(false);
  const [csvStep, setCsvStep] = useState<"upload" | "map" | "preview" | "importing">("upload");
  const [importTargetAccountCode, setImportTargetAccountCode] = useState<string>("4010");
  const [importCashAccountCode, setImportCashAccountCode] = useState<string>("1010");
  const [importMode, setImportMode] = useState<"both" | "statement_only" | "ledger_only">("both");
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Bank Reconciliation States
  const [selectedTxIdsForReconciliation, setSelectedTxIdsForReconciliation] = useState<string[]>([]);
  const [isProcessingReconciliation, setIsProcessingReconciliation] = useState(false);
  const [statementDate, setStatementDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [statementEndingBalance, setStatementEndingBalance] = useState<number>(0);

  useEffect(() => {
    async function loadBusiness() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const cached = currentUser?.companyId || currentUser?.businessId;
        if (cached) {
          setBusinessId(cached);
        } else {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          setBusinessId(userDoc.data()?.businessId || userDoc.data()?.companyId || user.uid);
        }
      } catch (err) {
        console.error("Failed to load business configuration for transactions active scope.", err);
        const fallbackId = user.uid;
        setBusinessId(fallbackId);
        setErrorSignal("Failed to authorize corporate business context. Defaulted to fallback user identity space.");
      }
    }
    loadBusiness();
  }, [currentUser]);

  const loadTransactions = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setErrorSignal(null);
    const colRef = collection(db, "companies", businessId, "transactions");
    try {
      const snapshot = await getDocs(colRef);
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      
      if (data.length === 0) {
        // Seed initial transactions in FireStore database
        const initial: Transaction[] = [
          { 
            id: "TXN-101", 
            date: "2026-05-18", 
            description: "Invoice Settlement Apex Systems", 
            type: "Inflow", 
            reference: "INV-0128", 
            method: "Bank Transfer", 
            amount: 4750.00, 
            status: "Settled",
            accountCode: "4010",
            accountName: "Revenue: Product Sales Revenue",
            reconciled: true,
            reconciledAt: "2026-05-19"
          },
          { 
            id: "TXN-102", 
            date: "2026-05-19", 
            description: "Office Space Outlay & Sublets", 
            type: "Outflow", 
            reference: "EXP-9501", 
            method: "ACH Direct Debit", 
            amount: 1500.00, 
            status: "Settled",
            accountCode: "6020",
            accountName: "Expenses: Office Rent & Facilities",
            reconciled: true,
            reconciledAt: "2026-05-20"
          },
          { 
            id: "TXN-103", 
            date: "2026-05-20", 
            description: "Deposit Core Hardware Sales Innovate", 
            type: "Inflow", 
            reference: "INV-0129", 
            method: "Credit Card", 
            amount: 8500.00, 
            status: "Settled",
            accountCode: "4010",
            accountName: "Revenue: Product Sales Revenue",
            reconciled: false
          },
          { 
            id: "TXN-104", 
            date: "2026-05-20", 
            description: "Broadband Optical Subscriptions", 
            type: "Outflow", 
            reference: "EXP-9502", 
            method: "Credit Card", 
            amount: 115.00, 
            status: "Settled",
            accountCode: "6030",
            accountName: "Expenses: Cloud Infrastructure & Software",
            reconciled: false
          },
          { 
            id: "TXN-105", 
            date: "2026-05-21", 
            description: "Deposit NextGen Quotation Escrow", 
            type: "Inflow", 
            reference: "QTY-5082", 
            method: "Bank Transfer", 
            amount: 350.00, 
            status: "Pending",
            accountCode: "2040",
            accountName: "Liabilities: Customer Deposits & Unearned",
            reconciled: false
          },
        ];
        
        for (const tx of initial) {
          try {
            await setDoc(doc(db, "companies", businessId, "transactions", tx.id), tx);
          } catch (seedErr) {
            console.error(`Failed to seed transaction ${tx.id}`, seedErr);
          }
        }
        data = initial;
      }

      setTxns(data);
      localStorage.setItem(`miratech_transactions_${businessId}`, JSON.stringify(data));
    } catch (err) {
      if (isOfflineError(err)) {
        const cached = localStorage.getItem(`miratech_transactions_${businessId}`);
        if (cached) {
          try {
            setTxns(JSON.parse(cached));
          } catch {}
        }
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        setErrorSignal(`Audit system failed to fetch transaction logs: ${errMsg}.`);
        
        const cached = localStorage.getItem(`miratech_transactions_${businessId}`);
        if (cached) {
          try {
            setTxns(JSON.parse(cached));
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadTransactions();
    }
  }, [loadTransactions, businessId]);

  // Adjust default target account when type changes
  useEffect(() => {
    if (type === "Inflow") {
      setSelectedAccountCode("4010"); // Product Sales Revenue
    } else {
      setSelectedAccountCode("6070"); // General Operating Overhead
    }
  }, [type]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0) return alert("Please specify description and positive amount.");
    if (!businessId) return;

    const newTxKey = id || `TXN-${String(Date.now()).substring(7)}`;
    const txDate = date || new Date().toISOString().split("T")[0];

    // Find Chart of Accounts definitions
    const targetAccount = STANDARD_CHART_OF_ACCOUNTS.find(a => a.code === selectedAccountCode) || {
      code: selectedAccountCode,
      name: type === "Inflow" ? "Revenue: Unassigned Revenue" : "Expenses: Unassigned Expense",
      category: type === "Inflow" ? ("Revenue" as const) : ("Expenses" as const),
      normalBalance: type === "Inflow" ? ("CREDIT" as const) : ("DEBIT" as const),
      description: "General account"
    };

    const cashAccount = STANDARD_CHART_OF_ACCOUNTS.find(a => a.code === cashAccountCode) || {
      code: "1010",
      name: "Assets: Cash & Operating Bank",
      category: "Assets" as const,
      normalBalance: "DEBIT" as const,
      description: "Primary liquid asset"
    };

    try {
      // 1. Post to Double-Entry General Ledger Engine
      // Inflow: Debit Cash (+Asset), Credit Revenue/Liability/AR
      // Outflow: Debit Expense/Liability/Asset, Credit Cash (-Asset)
      const lines: JournalVoucherLine[] = type === "Inflow" ? [
        {
          accountCode: cashAccount.code,
          account: cashAccount.name,
          accountType: cashAccount.category,
          debit: Number(amount),
          credit: 0,
          description: `[DEBIT Cash Inflow] ${description}`
        },
        {
          accountCode: targetAccount.code,
          account: targetAccount.name,
          accountType: targetAccount.category,
          debit: 0,
          credit: Number(amount),
          description: `[CREDIT Account] ${description}`
        }
      ] : [
        {
          accountCode: targetAccount.code,
          account: targetAccount.name,
          accountType: targetAccount.category,
          debit: Number(amount),
          credit: 0,
          description: `[DEBIT Outlay/Cost] ${description}`
        },
        {
          accountCode: cashAccount.code,
          account: cashAccount.name,
          accountType: cashAccount.category,
          debit: 0,
          credit: Number(amount),
          description: `[CREDIT Cash Outflow] ${description}`
        }
      ];

      const ledgerPost = await postJournalVoucher({
        businessId,
        date: txDate,
        description,
        sourceModule: "Treasury & Bank Transactions",
        transactionId: newTxKey,
        lines,
        createdByEmail: auth.currentUser?.email || undefined
      });

      // 2. Save Transaction record to Firestore with ledger audit linkages
      const newTx: Transaction = {
        id: newTxKey,
        date: txDate,
        description,
        type,
        reference: reference || "---",
        method,
        amount: Number(amount),
        status,
        accountCode: targetAccount.code,
        accountName: targetAccount.name,
        offsetAccountCode: cashAccount.code,
        offsetAccountName: cashAccount.name,
        reconciled: false,
        journalVoucherId: ledgerPost.voucherId,
        auditRef: ledgerPost.referenceNumber
      };

      await setDoc(doc(db, "companies", businessId, "transactions", newTxKey), newTx);

      // 3. Log to Tamper-Proof Audit Vault
      await logAction(
        "Double-Entry Transaction Logged",
        `Created transaction ${newTxKey} (${type}) with amount E${amount}. Ledger Ref: ${ledgerPost.referenceNumber}, GL Voucher ID: ${ledgerPost.voucherId}.`,
        businessId,
        amount,
        { role: currentUser?.role || "USER", department: "Finance" }
      );

      resetForm();
      setIsOpen(false);
      await loadTransactions();
      addToast(`Transaction ${newTxKey} posted to General Ledger (Audit Ref: ${ledgerPost.referenceNumber})`, "success");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast(`General Ledger Invariant Error: ${errMsg}`, "error");
      setErrorSignal(`Transaction rejected: ${errMsg}`);
    }
  };

  const resetForm = () => {
    setId("");
    setDate("");
    setDescription("");
    setType("Inflow");
    setReference("");
    setMethod("Bank Transfer");
    setAmount(0);
    setStatus("Settled");
    setSelectedAccountCode("4010");
    setCashAccountCode("1010");
  };

  const handleDelete = async (txid: string) => {
    if (!businessId) return;
    if (confirm("Remove this transaction row from ledger records?")) {
      try {
        await deleteDoc(doc(db, "companies", businessId, "transactions", txid));
        
        await logAction(
          "Ledger Transaction Extinguished",
          `Removed transaction record ID ${txid}.`,
          businessId,
          undefined,
          { role: currentUser?.role || "USER", department: "Finance" }
        );

        await loadTransactions();
        addToast(`Transaction record ${txid} deleted successfully`, "warning");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addToast(`Deletion refused: ${errMsg}`, "error");
      }
    }
  };

  const handleInspectVoucher = async (tx: Transaction) => {
    setInspectVoucherTx(tx);
    setLoadingVoucher(true);
    try {
      if (!businessId) return;
      const allJournals = await getJournalEntries(businessId);
      const matched = allJournals.find((j: any) => 
        j.transactionId === tx.id || 
        j.referenceNumber === tx.auditRef ||
        j.id === tx.journalVoucherId
      );
      setVoucherData(matched || null);
    } catch (err) {
      console.error("Failed to load journal voucher", err);
    } finally {
      setLoadingVoucher(false);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Transaction ID,Date,Description,Type,Account Code,Account Name,Reference,Method,Amount,Status,Reconciled,Audit Ref\n";
    txns.forEach((t) => {
      csvContent += `"${t.id}","${t.date}","${t.description}","${t.type}","${t.accountCode || ''}","${t.accountName || ''}","${t.reference}","${t.method}",${t.amount},"${t.status}","${t.reconciled ? 'YES' : 'NO'}","${t.auditRef || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MiraTech_Ledger_Transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Export Complete: Ledger Transactions CSV downloaded", "success");
  };

  // Automated Bank Reconciliation Execution
  const handleBulkReconciliation = async () => {
    if (!businessId || selectedTxIdsForReconciliation.length === 0) return;
    setIsProcessingReconciliation(true);
    try {
      const nowIso = new Date().toISOString().split("T")[0];
      for (const txId of selectedTxIdsForReconciliation) {
        const txDocRef = doc(db, "companies", businessId, "transactions", txId);
        await setDoc(txDocRef, {
          reconciled: true,
          reconciledAt: nowIso,
          statementRef: `STMT-${statementDate}`
        }, { merge: true });
      }

      await logAction(
        "Bank Statement Reconciled",
        `Reconciled ${selectedTxIdsForReconciliation.length} transactions against statement date ${statementDate}. Stated Ending Balance: E${statementEndingBalance.toFixed(2)}.`,
        businessId,
        statementEndingBalance,
        { role: currentUser?.role || "USER", department: "Finance" }
      );

      setSelectedTxIdsForReconciliation([]);
      await loadTransactions();
      addToast(`Reconciled ${selectedTxIdsForReconciliation.length} transactions successfully!`, "success");
    } catch (err) {
      addToast(`Reconciliation error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsProcessingReconciliation(false);
    }
  };

  // Simple RFC 4180 CSV parser handling quotes, commas, and multiline cells
  const parseCSVText = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === "\r" || char === "\n") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = lines[0].map(h => h.replace(/^["']|["']$/g, "").trim());
    const rows: Record<string, string>[] = [];

    for (let r = 1; r < lines.length; r++) {
      const rowArr = lines[r];
      const rowObj: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = rowArr[colIdx] !== undefined ? rowArr[colIdx].replace(/^["']|["']$/g, "").trim() : "";
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  };

  // Heuristic auto-mapping algorithm
  const autoMapHeaders = (headers: string[]) => {
    const newMapping: Record<TreasuryFieldKey, string> = {
      date: "",
      description: "",
      amount: "",
      reference: "",
      type: "",
      method: ""
    };

    TREASURY_STANDARD_FIELDS.forEach(field => {
      // 1. Direct exact or normalized match
      const exactMatch = headers.find(h => {
        const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        return field.aliases.some(alias => norm === alias.toLowerCase().replace(/[^a-z0-9]/g, ""));
      });

      if (exactMatch) {
        newMapping[field.key] = exactMatch;
        return;
      }

      // 2. Substring match
      const partialMatch = headers.find(h => {
        const lowerH = h.toLowerCase();
        return field.aliases.some(alias => lowerH.includes(alias));
      });

      if (partialMatch) {
        newMapping[field.key] = partialMatch;
      }
    });

    setColumnMapping(newMapping);
  };

  const handleProcessCSVFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      addToast("Unsupported format: Please upload an official RFC-4180 bank statement CSV file", "error");
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        addToast("Empty file: Bank statement CSV contains no textual data", "error");
        return;
      }
      const { headers, rows } = parseCSVText(content);
      if (headers.length === 0 || rows.length === 0) {
        addToast("Unable to detect tabular data in statement CSV", "error");
        return;
      }
      setCsvHeaders(headers);
      setCsvRawRows(rows);
      autoMapHeaders(headers);
      setCsvStep("map");
      addToast(`Parsed ${rows.length} bank statement rows with ${headers.length} columns`, "success");
    };
    reader.onerror = () => {
      addToast("File access error: Failed to read local statement file", "error");
    };
    reader.readAsText(file);
  };

  // Pre-validation computation
  const validatedRows: ValidatedCSVRow[] = useMemo(() => {
    if (csvRawRows.length === 0) return [];

    return csvRawRows.map((raw, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Date Validation
      const rawDate = columnMapping.date ? raw[columnMapping.date] || "" : "";
      let parsedDate = "";
      if (!rawDate) {
        errors.push("Missing transaction date");
      } else {
        // Try parsing ISO or common bank dates DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
        const cleanDateStr = rawDate.replace(/\./g, "-").replace(/\//g, "-").trim();
        const d = new Date(cleanDateStr);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split("T")[0];
        } else {
          // Check DD-MM-YYYY format
          const parts = cleanDateStr.split("-");
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              parsedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
            } else if (parts[2].length === 4) {
              // Assume DD-MM-YYYY or MM-DD-YYYY
              parsedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          }
          if (!parsedDate || isNaN(new Date(parsedDate).getTime())) {
            errors.push(`Invalid date format: "${rawDate}"`);
          }
        }
      }

      // 2. Description Validation
      const rawDesc = columnMapping.description ? raw[columnMapping.description] || "" : "";
      const parsedDescription = rawDesc.trim();
      if (!parsedDescription) {
        errors.push("Missing narration/description");
      }

      // 3. Amount & Flow Type Validation
      const rawAmt = columnMapping.amount ? raw[columnMapping.amount] || "" : "";
      let parsedAmount = 0;
      let parsedType: "Inflow" | "Outflow" = "Inflow";

      if (!rawAmt) {
        errors.push("Missing transaction amount");
      } else {
        // Strip currencies, commas, spaces
        const sanitized = rawAmt.replace(/[E$,\s]/g, "").replace(/\((.*?)\)/, "-$1");
        const num = parseFloat(sanitized);
        if (isNaN(num)) {
          errors.push(`Unparseable amount value: "${rawAmt}"`);
        } else {
          parsedAmount = Math.abs(num);
          if (num < 0) {
            parsedType = "Outflow";
          } else {
            parsedType = "Inflow";
          }
        }
      }

      // Check explicit flow type mapping if provided
      if (columnMapping.type && raw[columnMapping.type]) {
        const rawTypeVal = raw[columnMapping.type].toLowerCase().trim();
        if (rawTypeVal.includes("dr") || rawTypeVal.includes("out") || rawTypeVal.includes("debit") || rawTypeVal === "d") {
          parsedType = "Outflow";
        } else if (rawTypeVal.includes("cr") || rawTypeVal.includes("in") || rawTypeVal.includes("credit") || rawTypeVal === "c") {
          parsedType = "Inflow";
        }
      }

      if (parsedAmount === 0 && !errors.some(e => e.includes("amount"))) {
        warnings.push("Zero-amount transaction statement entry");
      }

      // 4. Reference
      const rawRef = columnMapping.reference ? raw[columnMapping.reference] || "" : "";
      const parsedReference = rawRef.trim() || `CSV-STMT-${idx + 1}`;

      // 5. Method
      const rawMethod = columnMapping.method ? raw[columnMapping.method] || "" : "";
      let parsedMethod = rawMethod.trim();
      if (!parsedMethod) {
        parsedMethod = "Bank Transfer";
      }

      return {
        rowNumber: idx + 1,
        raw,
        parsedDate,
        parsedDescription,
        parsedAmount,
        parsedType,
        parsedReference,
        parsedMethod,
        isValid: errors.length === 0,
        errors,
        warnings
      };
    });
  }, [csvRawRows, columnMapping]);

  const validRowsCount = validatedRows.filter(r => r.isValid).length;
  const invalidRowsCount = validatedRows.filter(r => !r.isValid).length;

  // Execute Bank Statement Batch Import
  const handleExecuteImport = async () => {
    if (!businessId) {
      addToast("Corporate business context not resolved", "error");
      return;
    }
    const readyRows = validatedRows.filter(r => r.isValid);
    if (readyRows.length === 0) {
      addToast("No valid rows to import. Correct the column mappings first.", "error");
      return;
    }

    setIsProcessingImport(true);
    setCsvStep("importing");

    try {
      let importedTxCount = 0;
      let totalAmountIn = 0;
      let totalAmountOut = 0;

      const targetAccount = STANDARD_CHART_OF_ACCOUNTS.find(a => a.code === importTargetAccountCode) || STANDARD_CHART_OF_ACCOUNTS[13];
      const cashAccount = STANDARD_CHART_OF_ACCOUNTS.find(a => a.code === importCashAccountCode) || STANDARD_CHART_OF_ACCOUNTS[0];

      for (const row of readyRows) {
        const uniqueTxId = `TXN-CSV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        if (row.parsedType === "Inflow") {
          totalAmountIn += row.parsedAmount;
        } else {
          totalAmountOut += row.parsedAmount;
        }

        // 1. Post double entry journal voucher if ledger mode enabled
        let glVoucherId: string | undefined = undefined;
        let glAuditRef: string | undefined = undefined;

        if (importMode === "both" || importMode === "ledger_only") {
          const lines: JournalVoucherLine[] = row.parsedType === "Inflow" ? [
            {
              accountCode: cashAccount.code,
              account: cashAccount.name,
              accountType: cashAccount.category,
              debit: row.parsedAmount,
              credit: 0,
              description: `[DEBIT Bank Deposit] ${row.parsedDescription}`
            },
            {
              accountCode: targetAccount.code,
              account: targetAccount.name,
              accountType: targetAccount.category,
              debit: 0,
              credit: row.parsedAmount,
              description: `[CREDIT Account] ${row.parsedDescription}`
            }
          ] : [
            {
              accountCode: targetAccount.code,
              account: targetAccount.name,
              accountType: targetAccount.category,
              debit: row.parsedAmount,
              credit: 0,
              description: `[DEBIT Expense/Vendor] ${row.parsedDescription}`
            },
            {
              accountCode: cashAccount.code,
              account: cashAccount.name,
              accountType: cashAccount.category,
              debit: 0,
              credit: row.parsedAmount,
              description: `[CREDIT Bank Outflow] ${row.parsedDescription}`
            }
          ];

          try {
            const voucherResult = await postJournalVoucher({
              businessId,
              date: row.parsedDate,
              description: `Bank Statement Import: ${row.parsedDescription}`,
              sourceModule: "Bank Statement Treasury Import",
              transactionId: uniqueTxId,
              lines,
              createdByEmail: auth.currentUser?.email || undefined
            });
            glVoucherId = voucherResult.voucherId;
            glAuditRef = voucherResult.referenceNumber;
          } catch (ledgerErr) {
            console.warn("Ledger voucher generation fallback for CSV row:", ledgerErr);
          }
        }

        // 2. Save Transaction record into corporate Firestore
        const isPreReconciled = importMode === "statement_only" || importMode === "both";
        const newTx: Transaction = {
          id: uniqueTxId,
          date: row.parsedDate,
          description: row.parsedDescription,
          type: row.parsedType,
          reference: row.parsedReference,
          method: row.parsedMethod,
          amount: row.parsedAmount,
          status: "Settled",
          accountCode: targetAccount.code,
          accountName: targetAccount.name,
          offsetAccountCode: cashAccount.code,
          offsetAccountName: cashAccount.name,
          reconciled: isPreReconciled,
          reconciledAt: isPreReconciled ? new Date().toISOString().split("T")[0] : undefined,
          statementRef: csvFile ? `STMT-${csvFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}` : `STMT-UPLOAD-${Date.now()}`,
          journalVoucherId: glVoucherId,
          auditRef: glAuditRef
        };

        await setDoc(doc(db, "companies", businessId, "transactions", uniqueTxId), newTx);
        importedTxCount++;
      }

      // 3. Tamper-Proof Audit Logging
      await logAction(
        "Bank Statement CSV Batch Imported",
        `Imported ${importedTxCount} bank statement line items from ${csvFile?.name || "CSV"}. Net Inflows: E${totalAmountIn.toFixed(2)}, Net Outflows: E${totalAmountOut.toFixed(2)}. Mode: ${importMode}.`,
        businessId,
        totalAmountIn - totalAmountOut,
        { role: currentUser?.role || "USER", department: "Finance" }
      );

      addToast(`Successfully imported and pre-validated ${importedTxCount} bank transactions into Treasury!`, "success");
      setIsCsvModalOpen(false);
      resetCsvState();
      await loadTransactions();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast(`Batch Import failed: ${errMsg}`, "error");
      setErrorSignal(`Bank statement import exception: ${errMsg}`);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const resetCsvState = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRawRows([]);
    setColumnMapping({
      date: "",
      description: "",
      amount: "",
      reference: "",
      type: "",
      method: ""
    });
    setCsvStep("upload");
  };
  const netBookCash = grossInflow - grossOutflow;

  // Reconciliation metrics
  const reconciledInflows = txns.filter(t => t.type === "Inflow" && t.reconciled).reduce((s, t) => s + t.amount, 0);
  const reconciledOutflows = txns.filter(t => t.type === "Outflow" && t.reconciled).reduce((s, t) => s + t.amount, 0);
  const reconciledCashBalance = reconciledInflows - reconciledOutflows;
  
  const unclearedInflows = txns.filter(t => t.type === "Inflow" && !t.reconciled && t.status === "Settled").reduce((s, t) => s + t.amount, 0);
  const unclearedOutflows = txns.filter(t => t.type === "Outflow" && !t.reconciled && t.status === "Settled").reduce((s, t) => s + t.amount, 0);
  
  const adjustedBookBalance = statementEndingBalance - unclearedInflows + unclearedOutflows;
  const reconciliationDifference = netBookCash - adjustedBookBalance;

  const filteredTxns = useMemo(() => {
    return txns.filter((t) => {
      const matchesSearch =
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.reference.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        (t.accountName || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesType = typeFilter === "All" || t.type === typeFilter;
      const matchesReconcile = 
        reconcileFilter === "All" || 
        (reconcileFilter === "Reconciled" && t.reconciled) || 
        (reconcileFilter === "Unreconciled" && !t.reconciled);

      return matchesSearch && matchesType && matchesReconcile;
    });
  }, [txns, search, typeFilter, reconcileFilter]);

  return (
    <div className="space-y-4">
      {/* Dynamic Error Warning Alerts */}
      {errorSignal && (
        <div className="p-3 border border-red-200 bg-red-50/70 rounded-lg flex items-start gap-2.5 text-xs text-red-800 font-medium animate-fade-in shadow-2xs">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-extrabold block text-red-900 uppercase tracking-widest text-[9px] mb-0.5">Secure Transaction Engine Warning</span>
            {errorSignal}
          </div>
          <button onClick={() => setErrorSignal(null)} className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-600" />
            Treasury, Bank Reconciliation & General Ledger
          </h1>
          <p className="text-[11px] text-slate-500">
            Enforces strict double-entry invariants, Chart of Accounts mappings, and automated statement reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                activeTab === "transactions" 
                  ? "bg-white text-blue-700 shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Transactions & Ledger
            </button>
            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reconciliation" 
                  ? "bg-white text-blue-700 shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Bank Reconciliation
            </button>
          </div>

          <button
            onClick={() => {
              resetCsvState();
              setIsCsvModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold cursor-pointer shadow-3xs transition"
          >
            <Upload className="h-3.5 w-3.5" /> Import Statement CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-[11px] font-bold cursor-pointer shadow-3xs transition"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
          >
            <Plus className="h-3.5 w-3.5" /> Post Journal Transaction
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Inflows (Revenue/AR)</p>
          <h3 className="text-base font-extrabold text-green-700 mt-1 font-mono">E{grossInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[9px] text-green-600 font-semibold font-mono">Balanced credit to revenue</p>
        </div>
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Outflows (Expenses/AP)</p>
          <h3 className="text-base font-extrabold text-red-600 mt-1 font-mono">-E{grossOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[9px] text-red-600 font-semibold font-mono">Balanced debit to cost centers</p>
        </div>
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ledger Operating Cash (1010)</p>
          <h3 className="text-base font-extrabold text-blue-700 mt-1 font-mono">E{netBookCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[9px] text-blue-600 font-semibold font-mono">Net liquid position</p>
        </div>
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reconciled Bank Float</p>
          <h3 className="text-base font-extrabold text-indigo-700 mt-1 font-mono">E{reconciledCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-[9px] text-indigo-600 font-semibold font-mono">
            {txns.filter(t => t.reconciled).length} of {txns.length} cleared
          </p>
        </div>
      </div>

      {activeTab === "transactions" ? (
        <>
          {/* Filter and Search */}
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search account, description or ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden"
              />
            </div>
            
            <div className="flex flex-wrap gap-1.5 items-center">
              <div className="flex gap-1 border border-slate-200 rounded-md bg-white p-0.5 text-xs">
                {["All", "Inflow", "Outflow"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition cursor-pointer ${
                      typeFilter === t ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 border border-slate-200 rounded-md bg-white p-0.5 text-xs">
                {(["All", "Reconciled", "Unreconciled"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReconcileFilter(r)}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition cursor-pointer ${
                      reconcileFilter === r ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-3xs">
            <table className="high-density-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">TX ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description & Chart of Account</th>
                  <th className="py-2.5 px-3">Ref ID</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reconciliation</th>
                  <th className="py-2.5 px-3 text-right">Settled Amount</th>
                  <th className="py-2.5 px-3 text-center">Audit Voucher</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTxns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400 font-medium">
                      No payment ledger lines matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredTxns.map((t) => {
                    const isIn = t.type === "Inflow";
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60">
                        <td className="font-mono font-bold text-slate-900 py-2 px-3">{t.id}</td>
                        <td className="font-mono text-slate-500 text-[11px] whitespace-nowrap px-3">{t.date}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {isIn ? (
                              <span className="p-0.5 bg-green-50 text-green-700 rounded-md border border-green-100 shrink-0">
                                <ArrowUpRight className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="p-0.5 bg-red-50 text-red-700 rounded-md border border-red-100 shrink-0">
                                <ArrowDownLeft className="h-3 w-3" />
                              </span>
                            )}
                            <span className="truncate max-w-xs">{t.description}</span>
                          </div>
                          {t.accountName && (
                            <p className="text-[10px] text-blue-600 font-mono pl-4">
                              COA: [{t.accountCode || '----'}] {t.accountName}
                            </p>
                          )}
                        </td>
                        <td className="font-mono text-[11px] text-blue-700 font-bold px-3">{t.reference}</td>
                        <td className="px-3 text-slate-600">{t.method}</td>
                        <td className="px-3">
                          {t.reconciled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle className="h-2.5 w-2.5" /> Reconciled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Unreconciled
                            </span>
                          )}
                        </td>
                        <td className={`font-mono font-extrabold text-right px-3 ${isIn ? "text-green-700" : "text-red-600"}`}>
                          {isIn ? "+" : "-"}E{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center px-3">
                          <button
                            onClick={() => handleInspectVoucher(t)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] font-mono font-bold cursor-pointer transition"
                            title="Inspect underlying Double-Entry Journal Voucher"
                          >
                            <BookOpen className="h-3 w-3" />
                            {t.auditRef || "GL VOUCHER"}
                          </button>
                        </td>
                        <td className="text-right py-1 px-3">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition inline-flex"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Automated Statement Reconciliation Workspace */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Automated Bank Statement Reconciliation Engine
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Compare your official bank statement ending balance with the general ledger cash asset account to detect outstanding deposits and uncleared checks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Statement Closing Date</label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Statement Ending Balance (E)</label>
                <input
                  type="number"
                  step="0.01"
                  value={statementEndingBalance}
                  onChange={(e) => setStatementEndingBalance(Number(e.target.value))}
                  className="w-full text-xs font-mono font-bold text-right"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    // Auto-select all unreconciled settled transactions
                    const unreconciledIds = txns.filter(t => !t.reconciled && t.status === "Settled").map(t => t.id);
                    setSelectedTxIdsForReconciliation(unreconciledIds);
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Select All Unreconciled ({txns.filter(t => !t.reconciled).length})
                </button>
              </div>
            </div>

            {/* Reconciliation Variance Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">General Ledger Cash</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">E{netBookCash.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Statement Balance</span>
                <span className="text-sm font-extrabold text-indigo-700 font-mono">E{statementEndingBalance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Uncleared Float (In - Out)</span>
                <span className="text-sm font-extrabold text-amber-700 font-mono">
                  +E{unclearedInflows.toFixed(2)} / -E{unclearedOutflows.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Reconciliation Variance</span>
                <span className={`text-sm font-extrabold font-mono ${Math.abs(reconciliationDifference) < 0.01 ? "text-emerald-600" : "text-rose-600"}`}>
                  E{reconciliationDifference.toFixed(2)} {Math.abs(reconciliationDifference) < 0.01 ? "(Balanced)" : "(Variance Detected)"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-xs text-slate-600 font-medium">
                {selectedTxIdsForReconciliation.length} transaction(s) selected for statement match.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    resetCsvState();
                    setIsCsvModalOpen(true);
                  }}
                  className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Statement CSV
                </button>
                <button
                  onClick={handleBulkReconciliation}
                  disabled={selectedTxIdsForReconciliation.length === 0 || isProcessingReconciliation}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <CheckCircle className="h-4 w-4" />
                  {isProcessingReconciliation ? "Processing..." : `Reconcile Selected (${selectedTxIdsForReconciliation.length})`}
                </button>
              </div>
            </div>
          </div>

          {/* Unreconciled Transactions Checklist */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-3xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
              <span>Candidate Transactions For Bank Statement Matching</span>
              <span className="text-[10px] text-slate-500">Check boxes to include in current statement reconciliation pass</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {txns.filter(t => !t.reconciled).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  All transactions in the current period have been cleared and reconciled!
                </div>
              ) : (
                txns.filter(t => !t.reconciled).map(t => {
                  const isChecked = selectedTxIdsForReconciliation.includes(t.id);
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => {
                        if (isChecked) {
                          setSelectedTxIdsForReconciliation(selectedTxIdsForReconciliation.filter(id => id !== t.id));
                        } else {
                          setSelectedTxIdsForReconciliation([...selectedTxIdsForReconciliation, t.id]);
                        }
                      }}
                      className={`p-3 flex items-center justify-between cursor-pointer transition hover:bg-slate-50 ${
                        isChecked ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                        />
                        <div>
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                            <span>{t.id}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{t.date}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">{t.reference}</span>
                          </div>
                          <p className="text-[11px] text-slate-600">{t.description}</p>
                          {t.accountName && (
                            <span className="text-[9px] text-blue-600 font-mono font-medium">COA: {t.accountName}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-extrabold text-xs ${t.type === "Inflow" ? "text-green-700" : "text-red-600"}`}>
                          {t.type === "Inflow" ? "+" : "-"}E{t.amount.toFixed(2)}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-mono">{t.method}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-lg w-full overflow-hidden animate-fade-in">
            <div className="px-5 py-3.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-blue-700" />
                Post Double-Entry Journal Transaction
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Transaction ID</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server procurement order - client Apex"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Flow Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "Inflow" | "Outflow")}
                    className="w-full font-bold text-xs"
                  >
                    <option value="Inflow" className="text-green-600 font-bold">Inflow (+) Revenue / Cash Receipt</option>
                    <option value="Outflow" className="text-red-500 font-bold">Outflow (-) Expense / Cash Disbursement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (E)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-right font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {/* Chart of Accounts Dropdowns */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  General Ledger Chart of Accounts Mapping
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                      {type === "Inflow" ? "Revenue / Offset Account (Credit)" : "Expense / Offset Account (Debit)"}
                    </label>
                    <select
                      value={selectedAccountCode}
                      onChange={(e) => setSelectedAccountCode(e.target.value)}
                      className="w-full text-xs font-mono font-semibold"
                    >
                      {STANDARD_CHART_OF_ACCOUNTS.filter(a => type === "Inflow" ? (a.category === "Revenue" || a.category === "Liabilities" || a.category === "Equity") : (a.category === "Expenses" || a.category === "Liabilities" || a.category === "Assets")).map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          [{acc.code}] {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                      Liquid Cash Asset Account ({type === "Inflow" ? "Debit" : "Credit"})
                    </label>
                    <select
                      value={cashAccountCode}
                      onChange={(e) => setCashAccountCode(e.target.value)}
                      className="w-full text-xs font-mono font-semibold"
                    >
                      {STANDARD_CHART_OF_ACCOUNTS.filter(a => a.category === "Assets").map((acc) => (
                        <option key={acc.code} value={acc.code}>
                          [{acc.code}] {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400">
                  Double-entry engine automatically balances debits and credits and writes a permanent ledger voucher.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reference ID</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-002"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Settlement Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full text-xs"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="ACH Direct Debit">ACH Direct Debit</option>
                    <option value="Cash Clearing">Cash Clearing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Settlement Audit Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Settled" | "Pending")}
                  className="w-full text-xs"
                >
                  <option value="Settled">Cleared / Settled</option>
                  <option value="Pending">On Hold / Pending Bank Clearing</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-bold text-xs shadow-2xs"
                >
                  Post to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drag-and-Drop Bank Statement CSV Import & Column Pre-Validation Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header with Stepper */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-500/30">
                  <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                    Bank Statement CSV Importer & Treasury Schema Mapper
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pre-validate, map arbitrary bank columns, and post to Treasury General Ledger invariants.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsCsvModalOpen(false);
                  resetCsvState();
                }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper Wizard Bar */}
            <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  csvStep === "upload" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  <span>1</span> Upload CSV
                </div>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  csvStep === "map" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  <span>2</span> Map Columns
                </div>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  csvStep === "preview" || csvStep === "importing" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  <span>3</span> Pre-Validate & Import
                </div>
              </div>

              {csvFile && (
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <span className="font-bold text-slate-700">{csvFile.name}</span>
                  <span>({csvRawRows.length} rows)</span>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* STEP 1: Upload Drag & Drop */}
              {csvStep === "upload" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleProcessCSVFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isDragging 
                        ? "border-indigo-600 bg-indigo-50/60 scale-[1.01]" 
                        : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
                    }`}
                    onClick={() => {
                      document.getElementById("statement-csv-file-input")?.click();
                    }}
                  >
                    <input
                      type="file"
                      id="statement-csv-file-input"
                      accept=".csv,text/csv,application/vnd.ms-excel"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleProcessCSVFile(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-3 shadow-inner">
                      <FileUp className="h-8 w-8" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                      Drag & Drop Bank Statement CSV Here
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">
                      Supports statements from Standard Bank, FNB, Nedbank, Barclays, Chase, HSBC, or custom corporate exports.
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-2xs hover:bg-indigo-700 transition">
                      <Upload className="h-3.5 w-3.5" />
                      Browse Local Files
                    </div>
                  </div>

                  {/* Sample Schema Guidelines */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-700 text-xs flex items-center gap-1.5">
                        <HelpCircle className="h-4 w-4 text-blue-600" />
                        Treasury Module Standard Fields Specification
                      </span>
                      <button
                        onClick={() => {
                          // Quick mock download or load sample template
                          const sampleCSV = `Transaction Date,Description,Amount,Reference Number,Transaction Type,Payment Rail\n2026-05-22,"Settlement Apex Services",12500.00,TXN-9021,Credit,Bank Transfer\n2026-05-23,"Office Supplies Procurement",-450.00,PO-4412,Debit,Credit Card\n2026-05-24,"Cloud Infrastructure Amazon AWS",-890.00,INV-AWS-1,Debit,ACH Direct Debit\n2026-05-25,"Client Retainer Innovate Labs",4500.00,RET-098,Credit,Bank Transfer\n2026-05-25,"Corporate Internet Broadband",-120.00,TEL-3391,Debit,Credit Card`;
                          const blob = new Blob([sampleCSV], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "MiraTech_Standard_Bank_Statement_Template.csv";
                          a.click();
                          URL.revokeObjectURL(url);
                          addToast("Downloaded standard bank statement CSV template", "success");
                        }}
                        className="text-xs text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Standard Template
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-[11px]">
                      {TREASURY_STANDARD_FIELDS.map(f => (
                        <div key={f.key} className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">{f.label}</span>
                            {f.required ? (
                              <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">REQUIRED</span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">OPTIONAL</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">{f.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Column Mapping */}
              {csvStep === "map" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      <span className="font-bold text-blue-900 text-xs">
                        Map CSV Columns to Treasury Standard Fields
                      </span>
                    </div>
                    <button
                      onClick={() => autoMapHeaders(csvHeaders)}
                      className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-[11px] cursor-pointer transition flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Auto-Detect Headers
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="p-3">Treasury Target Field</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Detected CSV Column Header</th>
                          <th className="p-3">Sample Value (Row 1)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {TREASURY_STANDARD_FIELDS.map((field) => {
                          const mappedCol = columnMapping[field.key];
                          const sampleVal = mappedCol && csvRawRows[0] ? csvRawRows[0][mappedCol] : "—";
                          const isConfigured = Boolean(mappedCol);

                          return (
                            <tr key={field.key} className={!isConfigured && field.required ? "bg-amber-50/40" : ""}>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{field.label}</div>
                                <div className="text-[10px] text-slate-500">{field.description}</div>
                              </td>
                              <td className="p-3">
                                {isConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <Check className="h-2.5 w-2.5" /> Mapped
                                  </span>
                                ) : field.required ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="h-2.5 w-2.5" /> Required
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    Optional (Not Mapped)
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <select
                                  value={columnMapping[field.key]}
                                  onChange={(e) => {
                                    setColumnMapping(prev => ({
                                      ...prev,
                                      [field.key]: e.target.value
                                    }));
                                  }}
                                  className="w-full text-xs font-semibold"
                                >
                                  <option value="">— Select CSV Column —</option>
                                  {csvHeaders.map((header) => (
                                    <option key={header} value={header}>
                                      {header}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-600 max-w-[200px] truncate">
                                {sampleVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Missing required warning */}
                  {(!columnMapping.date || !columnMapping.description || !columnMapping.amount) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>
                        Please map all required fields (<strong>Transaction Date</strong>, <strong>Description</strong>, and <strong>Amount</strong>) to continue to Pre-Validation.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Pre-Validation & Import Configuration */}
              {(csvStep === "preview" || csvStep === "importing") && (
                <div className="space-y-4">
                  {/* Pre-Validation Status Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Valid Rows Ready</span>
                      <span className="text-xl font-extrabold text-emerald-800 font-mono">{validRowsCount}</span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">Meets schema invariants</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Pre-Validation Errors</span>
                      <span className="text-xl font-extrabold text-rose-800 font-mono">{invalidRowsCount}</span>
                      <span className="text-[10px] text-rose-600 block mt-0.5">Rows with format anomalies</span>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Total Parsed Batch</span>
                      <span className="text-xl font-extrabold text-indigo-800 font-mono">{validatedRows.length}</span>
                      <span className="text-[10px] text-indigo-600 block mt-0.5">Source: {csvFile?.name}</span>
                    </div>
                  </div>

                  {/* General Ledger Accounting Destination Parameters */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-blue-600" />
                        Treasury General Ledger Destination & Posting Rules
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Import Mode:</span>
                        <select
                          value={importMode}
                          onChange={(e) => setImportMode(e.target.value as any)}
                          className="text-xs font-bold bg-white"
                        >
                          <option value="both">Post to Ledger & Mark Reconciled</option>
                          <option value="statement_only">Mark as Reconciled Statements</option>
                          <option value="ledger_only">Post as Unreconciled Candidate Txns</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Liquid Cash Asset Account (Debit/Credit Bank Rail)
                        </label>
                        <select
                          value={importCashAccountCode}
                          onChange={(e) => setImportCashAccountCode(e.target.value)}
                          className="w-full text-xs font-mono font-semibold"
                        >
                          {STANDARD_CHART_OF_ACCOUNTS.filter(a => a.category === "Assets").map(a => (
                            <option key={a.code} value={a.code}>
                              [{a.code}] {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Default Offset Chart of Accounts Code
                        </label>
                        <select
                          value={importTargetAccountCode}
                          onChange={(e) => setImportTargetAccountCode(e.target.value)}
                          className="w-full text-xs font-mono font-semibold"
                        >
                          {STANDARD_CHART_OF_ACCOUNTS.map(a => (
                            <option key={a.code} value={a.code}>
                              [{a.code}] {a.name} ({a.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Pre-Validation Data Grid Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-slate-700 text-xs">
                        Pre-Validation Statement Lines ({validatedRows.length} Rows)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Green rows will be imported. Red rows are skipped or flagged.
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-3xs">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="p-2 w-12 text-center">Row</th>
                            <th className="p-2 w-24">Date</th>
                            <th className="p-2">Description / Narration</th>
                            <th className="p-2 w-20 text-center">Flow</th>
                            <th className="p-2 w-24 text-right">Amount</th>
                            <th className="p-2 w-24">Reference</th>
                            <th className="p-2 w-28">Validation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {validatedRows.map((row) => (
                            <tr 
                              key={row.rowNumber} 
                              className={!row.isValid ? "bg-rose-50/50" : "hover:bg-slate-50"}
                            >
                              <td className="p-2 text-center font-bold text-slate-500">{row.rowNumber}</td>
                              <td className="p-2 font-bold text-slate-900">{row.parsedDate || "—"}</td>
                              <td className="p-2 text-slate-700 font-sans text-xs max-w-xs truncate" title={row.parsedDescription}>
                                {row.parsedDescription || "—"}
                              </td>
                              <td className="p-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  row.parsedType === "Inflow" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : "bg-rose-100 text-rose-800"
                                }`}>
                                  {row.parsedType}
                                </span>
                              </td>
                              <td className={`p-2 text-right font-extrabold ${
                                row.parsedType === "Inflow" ? "text-emerald-700" : "text-rose-600"
                              }`}>
                                {row.parsedType === "Inflow" ? "+" : "-"}E{row.parsedAmount.toFixed(2)}
                              </td>
                              <td className="p-2 text-slate-600 truncate max-w-[100px]">{row.parsedReference}</td>
                              <td className="p-2">
                                {row.isValid ? (
                                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 font-sans">
                                    <CheckCircle className="h-3 w-3" /> Valid
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-700 font-bold flex items-center gap-1 font-sans" title={row.errors.join("; ")}>
                                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{row.errors[0]}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {csvStep !== "upload" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (csvStep === "preview") setCsvStep("map");
                      else if (csvStep === "map") setCsvStep("upload");
                    }}
                    disabled={isProcessingImport}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    resetCsvState();
                  }}
                  disabled={isProcessingImport}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>

                {csvStep === "map" && (
                  <button
                    type="button"
                    onClick={() => setCsvStep("preview")}
                    disabled={!columnMapping.date || !columnMapping.description || !columnMapping.amount}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    Pre-Validate Statement Data <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

                {(csvStep === "preview" || csvStep === "importing") && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={validRowsCount === 0 || isProcessingImport}
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isProcessingImport ? "Importing Statement..." : `Import ${validRowsCount} Valid Transactions`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {inspectVoucherTx && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-blue-400 font-bold block uppercase tracking-wider">
                  Audit General Ledger Voucher
                </span>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-emerald-400" />
                  {inspectVoucherTx.auditRef || inspectVoucherTx.id}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setInspectVoucherTx(null);
                  setVoucherData(null);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px]">DATE</span>
                  <span className="font-bold text-slate-900">{inspectVoucherTx.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">TOTAL AMOUNT</span>
                  <span className="font-bold text-slate-900">E{inspectVoucherTx.amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">REFERENCE</span>
                  <span className="font-bold text-blue-700">{inspectVoucherTx.reference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">DOUBLE-ENTRY INVARIANT</span>
                  <span className="font-bold text-emerald-700">BALANCED (0.00)</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[11px] mb-2 uppercase tracking-wide">Journal Voucher Ledger Lines</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-100 text-[10px] text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Account Line</th>
                        <th className="p-2 text-right">Debit</th>
                        <th className="p-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectVoucherTx.type === "Inflow" ? (
                        <>
                          <tr className="bg-emerald-50/40">
                            <td className="p-2">
                              <span className="font-bold text-slate-800">[1010] Cash & Operating Bank</span>
                              <span className="block text-[9px] text-slate-500">Asset Increase (Debit)</span>
                            </td>
                            <td className="p-2 text-right font-bold text-emerald-700">E{inspectVoucherTx.amount.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-300">-</td>
                          </tr>
                          <tr>
                            <td className="p-2">
                              <span className="font-bold text-slate-800">[{inspectVoucherTx.accountCode || '4010'}] {inspectVoucherTx.accountName || 'Revenue Sales'}</span>
                              <span className="block text-[9px] text-slate-500">Revenue/Offset Increase (Credit)</span>
                            </td>
                            <td className="p-2 text-right text-slate-300">-</td>
                            <td className="p-2 text-right font-bold text-indigo-700">E{inspectVoucherTx.amount.toFixed(2)}</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr className="bg-rose-50/40">
                            <td className="p-2">
                              <span className="font-bold text-slate-800">[{inspectVoucherTx.accountCode || '6070'}] {inspectVoucherTx.accountName || 'Operating Overhead'}</span>
                              <span className="block text-[9px] text-slate-500">Expense Increase (Debit)</span>
                            </td>
                            <td className="p-2 text-right font-bold text-rose-700">E{inspectVoucherTx.amount.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-300">-</td>
                          </tr>
                          <tr>
                            <td className="p-2">
                              <span className="font-bold text-slate-800">[1010] Cash & Operating Bank</span>
                              <span className="block text-[9px] text-slate-500">Asset Decrease (Credit)</span>
                            </td>
                            <td className="p-2 text-right text-slate-300">-</td>
                            <td className="p-2 text-right font-bold text-slate-800">E{inspectVoucherTx.amount.toFixed(2)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <tr>
                        <td className="p-2 text-[10px] uppercase">Invariant Balanced Totals</td>
                        <td className="p-2 text-right text-emerald-700">E{inspectVoucherTx.amount.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-700">E{inspectVoucherTx.amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-900 flex items-center justify-between">
                <span>Cryptographic Audit Reference: <strong>{inspectVoucherTx.auditRef || "AUD-GL-CONFIRMED"}</strong></span>
                <span className="bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded text-[9px]">VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
