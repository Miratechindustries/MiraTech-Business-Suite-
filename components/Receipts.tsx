"use client";

import { useState, useEffect, useRef } from "react";
import { collection, doc, getDocs, updateDoc, deleteDoc, query, orderBy, getDoc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore, useToastStore } from "../lib/store";
import { logAction } from "../lib/audit";
import { uploadToDrive } from "../lib/drive";
import { FileCheck, Search, Trash, Download, Loader2, Eye, X } from "lucide-react";
// import jsPDF from "jspdf";
import safeHtml2Canvas from "../lib/safeHtml2canvas";

interface Receipt {
  id?: string;
  ownerId: string;
  number: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  paymentMethod: string;
  date: string;
  amount: number;
  status: "completed" | "refunded";
  driveFileId?: string;
  department?: string;
}

interface CompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
}

export default function Receipts({ departmentId }: { departmentId?: string }) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  // Local auth shadowing to redirect all queries to the correct shared company workspace
  const auth = {
    ...importAuth,
    get currentUser() {
      const liveUser = importAuth.currentUser;
      if (!liveUser) return null;
      const companyId = currentUser?.companyId || currentUser?.businessId || liveUser.uid;
      return {
        ...liveUser,
        uid: companyId,
        getIdToken: (forceRefresh?: boolean) => liveUser.getIdToken(forceRefresh),
        getIdTokenResult: (forceRefresh?: boolean) => liveUser.getIdTokenResult(forceRefresh),
      } as any;
    }
  };

  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [search, setSearch] = useState("");

  // Preview & Export Modal
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);

  const fetchReceiptsAndCompany = async () => {
    const user = auth.currentUser;
    if (!user || !currentUser) return;

    setLoading(true);
    const receiptsPath = `companies/${user.uid}/receipts`;
    try {
      // Fetch settings
      const compSnap = await getDoc(doc(db, "companies", user.uid));
      if (compSnap.exists()) {
        const compData = compSnap.data() as CompanyDetails;
        setCompany(compData);
        localStorage.setItem(`miratech_offline_company_${user.uid}`, JSON.stringify(compData));
      } else {
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${user.uid}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
      }

      // Fetch receipts with explicit check
      const rRef = collection(db, "companies", user.uid, "receipts");
      const querySnap = await getDocs(query(rRef, orderBy("number", "desc")));
      const itemsList: Receipt[] = [];
      querySnap.forEach((docSnap) => {
        itemsList.push({ id: docSnap.id, ...docSnap.data() } as Receipt);
      });
      const finalRecs = departmentId ? itemsList.filter(rec => rec.department === departmentId) : itemsList;
      setReceipts(finalRecs);
      localStorage.setItem(`miratech_offline_receipts_${user.uid}`, JSON.stringify(itemsList));
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn("[Receipts Offline Fallback] Loading data from local cache.");
        const cachedCompany = localStorage.getItem(`miratech_offline_company_${user.uid}`);
        if (cachedCompany) setCompany(JSON.parse(cachedCompany));
        const cachedRecs = localStorage.getItem(`miratech_offline_receipts_${user.uid}`);
        if (cachedRecs) {
          const rawList = JSON.parse(cachedRecs) as Receipt[];
          setReceipts(departmentId ? rawList.filter(rec => rec.department === departmentId) : rawList);
        } else {
          setReceipts([]);
        }
      } else {
        handleFirestoreError(err, OperationType.GET, receiptsPath);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceiptsAndCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleDelete = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const receiptPath = `companies/${user.uid}/receipts/${id}`;
    let isOffline = false;
    try {
      await deleteDoc(doc(db, "companies", user.uid, "receipts", id));

      // Log database audit trail
      await logAction(
        "Receipt Extinguished",
        `Permanently deleted receipt ID: ${id}`,
        user.uid
      );
    } catch (err) {
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.DELETE, receiptPath);
        return;
      }
      isOffline = true;
      console.warn("[Receipts Offline Delete] Deleting receipt locally.");
    }

    // Reflect deletion in local cache of receipts
    const cachedRecs = localStorage.getItem(`miratech_offline_receipts_${user.uid}`);
    if (cachedRecs) {
      const recsList: Receipt[] = JSON.parse(cachedRecs);
      const updatedList = recsList.filter((r) => r.id !== id);
      localStorage.setItem(`miratech_offline_receipts_${user.uid}`, JSON.stringify(updatedList));
      if (isOffline) {
        setReceipts(updatedList);
      }
    }

    addToast("Receipt deleted successfully closeout", "warning");
    if (!isOffline) {
      fetchReceiptsAndCompany();
    }
  };

  const handleExportPDF = async () => {
    if (!pdfAreaRef.current || !previewReceipt) return;

    try {
      const element = pdfAreaRef.current;
      const canvas = await safeHtml2Canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      
      const pdfBlob = pdf.output('blob');
      const fileName = `Receipt_${previewReceipt.number}.pdf`;
      
      // Save PDF locally first to ensure of physical download success
      pdf.save(fileName);
      addToast(`Export Complete: Saved PDF ${fileName}`, "success");

      // Attempt background Google Drive backup gracefully
      try {
        const fileId = await uploadToDrive(pdfBlob, fileName);
        const user = auth.currentUser;
        if (user && previewReceipt.id) {
          await updateDoc(doc(db, "companies", user.uid, "receipts", previewReceipt.id), {
            driveFileId: fileId
          });
          fetchReceiptsAndCompany();
          addToast("Receipt backed up to Google Drive successfully!", "info");
        }
      } catch (driveErr: any) {
        console.warn("Google Drive skip/backup failed:", driveErr.message);
      }
    } catch (err) {
      console.error("PDF printing failed:", err);
      addToast(`System Error: PDF generation failed. Reason: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  const filteredReceipts = receipts.filter((rec) => {
    if (departmentId && rec.department !== departmentId) return false;
    return (
      rec.clientName.toLowerCase().includes(search.toLowerCase()) ||
      rec.number.toLowerCase().includes(search.toLowerCase()) ||
      rec.invoiceNumber.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Settle Ledgers & Receipts</h1>
          <p className="text-[11px] text-slate-500">View proven client payments and settled ledger records.</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-2 items-center">
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-450">
            <Search className="h-3.5 w-3.5 text-slate-405" />
          </span>
          <input
            type="text"
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-550" />
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="border border-dashed border-slate-250 rounded-lg p-6 text-center text-slate-400">
          <FileCheck className="h-8 w-8 mx-auto text-slate-305 mb-1.5" />
          <p className="text-xs font-extrabold text-slate-700">No receipts recorded</p>
          <p className="text-[10px] text-slate-450 mt-0.5">Receipts are automatically logged upon recording billing invoice payments.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-blue-100/70 rounded-lg shadow-3xs">
          <table className="high-density-table w-full text-left border-collapse">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Invoice Ref</th>
                <th>Client</th>
                <th>Settled Date</th>
                <th>Method</th>
                <th>Paid Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredReceipts.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{rec.number}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{rec.invoiceNumber}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold">{rec.clientName}</div>
                    <div className="text-[10px] text-slate-400">{rec.clientEmail}</div>
                  </td>
                  <td className="py-3.5 px-4">{rec.date}</td>
                  <td className="py-3.5 px-4 text-slate-500">{rec.paymentMethod}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">E{rec.amount.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    <button
                      onClick={() => setPreviewReceipt(rec)}
                      title="Preview Receipt Doc"
                      className="p-1 text-slate-600 hover:bg-slate-50 rounded-md cursor-pointer inline-flex"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id!)}
                      title="Remove"
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer inline-flex"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* A4 Printable Receipt Template */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-4xl w-full">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-sm font-semibold text-slate-800">Review Receipt: {previewReceipt.number}</span>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 border border-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition"
                >
                  <Download className="h-3.5 w-3.5" /> A4 PDF
                </button>
                <button
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1 px-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* A4 Printable Paper Template */}
            <div className="p-6 bg-slate-100 overflow-x-auto max-h-[70vh]">
              <div
                ref={pdfAreaRef}
                style={{ width: "210mm", minHeight: "297mm" }}
                className="mx-auto bg-white p-[20mm] border border-slate-200 shadow-sm relative text-slate-800 font-sans"
              >
                {/* Letterhead Logo Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                  <div>
                    {company?.letterheadLogo ? (
                      <img
                        src={company.letterheadLogo}
                        alt="Corporate Symbol"
                        className="max-h-20 object-contain mb-2"
                      />
                    ) : (
                      <span className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        {company?.name || "Corporate Ledger"}
                      </span>
                    )}
                    <h1 className="text-2xl font-black text-slate-900 tracking-wider">OFFICIAL RECEIPTS</h1>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-800">{company?.name}</p>
                    <p>{company?.email}</p>
                    <p>{company?.phone}</p>
                    <p className="whitespace-pre-line max-w-[200px]">{company?.address}</p>
                  </div>
                </div>

                {/* Main Receipt Content Card */}
                <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-4 text-xs my-8 max-w-xl mx-auto">
                  <div className="text-center border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value Cleared</span>
                    <h2 className="text-3xl font-black text-slate-900 mt-1">E{previewReceipt.amount.toLocaleString()}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    <div>
                      <span className="text-slate-400 font-medium block">Receipt Reference:</span>
                      <strong className="text-slate-900 text-sm font-mono">{previewReceipt.number}</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block">Invoice Referencing:</span>
                      <strong className="text-slate-900 text-sm font-mono">{previewReceipt.invoiceNumber}</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block">Cleared Date:</span>
                      <span className="text-slate-700 font-medium">{previewReceipt.date}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block">Settle Channel Hook:</span>
                      <span className="text-slate-700 font-medium">{previewReceipt.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-400 font-medium block mb-1">Cleared Customer details:</span>
                    <p className="font-bold text-slate-900">{previewReceipt.clientName}</p>
                    <p className="text-slate-500">{previewReceipt.clientEmail}</p>
                  </div>
                </div>

                {/* Footer sign */}
                <div className="absolute bottom-[20mm] left-[20mm] right-[20mm] text-center border-t border-slate-150 pt-5 text-[10px] text-slate-400">
                  Payments are processed and settled atomically. This file represents an official financial receipt issued on {previewReceipt.date} by {company?.name}.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
