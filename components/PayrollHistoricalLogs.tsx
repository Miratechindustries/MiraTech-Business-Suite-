"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth as importAuth } from "../lib/firebase"; 
import { useUserStore } from "../lib/store";
import { FileText, Loader2, Eye, Download, X } from "lucide-react";
import jsPDF from "jspdf";
import safeHtml2canvas from "../lib/safeHtml2canvas";

interface HistoryLog {
  id: string;
  employeeName: string;
  payPeriod: string;
  netSalary: number;
  date: any;
  adjustments?: string;
  businessId: string;
}

export default function PayrollHistoricalLogs() {
  const { currentUser } = useUserStore();
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);

  // Derive businessId to match tenant
  const businessId = currentUser?.companyId || currentUser?.businessId || importAuth.currentUser?.uid || "SYSTEM";

  const handleExportPDF = async (log: HistoryLog, silent: boolean = false) => {
    // If not silent, show modal, else use hidden container
    if (!silent) setSelectedLog(log);
    
    // Give time to render
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const targetElement = silent ? document.getElementById('hidden-pdf-container') : pdfAreaRef.current;
        if (!targetElement) { resolve(); return; }
        
          try {
          const canvas = await safeHtml2canvas(targetElement, { scale: 2, useCORS: true });
          if (!canvas) throw new Error("Canvas generation failed");
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdf = new jsPDF("p", "mm", "a4");
          const imgWidth = 210;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
          pdf.save(`${log.employeeName || "Payslip"}.pdf`);
        } catch (err) {
          console.error("PDF generation failed:", err);
          alert("Failed to generate PDF. Please try again.");
        } finally {
          if (!silent) setSelectedLog(null);
          resolve();
        }
      }, 500);
    });
  };

  const handleDownloadAll = async () => {
    // Render each log in hidden container
    for (const log of logs) {
        // We need a way to render the log content without showing it
        // Or simply iterate and use the same template content
        
        // Let's create a temporary hidden div with the content for the log
        const container = document.getElementById('hidden-pdf-container');
        if (!container) continue;
        
        // This is a bit hacky but it should work: populate directly
        container.innerHTML = `
          <h2 class="text-xl font-bold mb-2">Payslip: ${log.employeeName}</h2>
          <p>Period: ${log.payPeriod}</p>
          <p>Net Amount: $${log.netSalary}</p>
          <p>Adjustments: ${log.adjustments || "None"}</p>
        `;
        
        await handleExportPDF(log, true);
    }
  };

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const q = query(
            collection(db, "payslips"),
            where("businessId", "==", businessId),
            orderBy("date", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as HistoryLog[];
        setLogs(data);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [businessId]);

  if (loading) return <div className="p-6 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">Payroll Historical Logs</h3>
        <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-200">
           <Download className="w-4 h-4" /> Download All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-slate-400 uppercase text-[10px] tracking-wider border-b">
            <tr>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Pay Period</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Net Amount</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b hover:bg-slate-50">
                <td className="py-3 px-4 font-bold">{log.employeeName}</td>
                <td className="py-3 px-4">{log.payPeriod}</td>
                <td className="py-3 px-4">{log.date?.toDate ? new Date(log.date?.toDate()).toLocaleDateString() : "N/A"}</td>
                <td className="py-3 px-4 font-mono font-bold">${log.netSalary?.toFixed(2)}</td>
                <td className="py-3 px-4">
                  <button onClick={() => setSelectedLog(log)} className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer">
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div id="hidden-pdf-container" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}></div>
      
      {/* PDF Generation/Preview Hidden Area */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6">
            <div className="flex justify-between items-center mb-4 no-print">
               <h3 className="text-lg font-bold">Payslip Preview</h3>
               <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-slate-900 cursor-pointer">
                 <X className="w-5 h-5" />
               </button>
            </div>
            <div ref={pdfAreaRef} className="w-full bg-white text-slate-850 p-6 shadow-2xl border border-slate-200 rounded-lg flex flex-col gap-3 min-h-[640px] text-[10px] font-sans">
                {/* Template Header */}
                <div className="border-b border-slate-900 pb-2 mb-2 flex justify-between">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">ABC Company</h2>
                        <p className="text-2xs text-slate-500 whitespace-pre-line">{"Street Address\nCity, State, Zip"}</p>
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">PAYSLIP</h2>
                </div>
                
                {/* Pay period / Date */}
                <div className="grid grid-cols-2 gap-4 bg-slate-100 p-2 font-bold border border-slate-300 rounded-md">
                    <div>Pay Period: <span className="font-normal">{selectedLog.payPeriod}</span></div>
                    <div>Date of Payment: <span className="font-normal">{selectedLog.date?.toDate ? new Date(selectedLog.date?.toDate()).toLocaleDateString() : "N/A"}</span></div>
                </div>

                {/* Employee Information */}
                <div className="border border-slate-900 rounded-md overflow-hidden">
                    <div className="bg-slate-800 text-white font-bold p-1 px-2 text-center text-xs">Employee Information</div>
                    <div className="grid grid-cols-2 gap-x-4 p-2 text-[10px]">
                    <div>Name: <span className="font-bold">{selectedLog.employeeName}</span></div>
                    <div>Department: <span className="font-bold">N/A</span></div>
                    <div>Employee ID: <span className="font-bold">N/A</span></div>
                    <div>Role: <span className="font-bold">N/A</span></div>
                    </div>
                </div>

                {/* Financial Table */}
                <div className="border border-slate-900 rounded-md overflow-hidden text-[10px]">
                    <div className="bg-slate-800 text-white font-bold p-1 text-center">Summary</div>
                    <div className="p-2 space-y-1">
                        <div className="flex justify-between font-bold"><span>Net Pay</span> <span>${selectedLog.netSalary.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Adjustments</span> <span>{selectedLog.adjustments || "—"}</span></div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="mt-auto text-center text-[8px] text-slate-400 font-medium">
                    Powered by MiraTech Industries ©
                </div>
            </div>
            <div className="flex gap-2 mt-4 no-print">
              <button 
                  onClick={() => handleExportPDF(selectedLog)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                  <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
