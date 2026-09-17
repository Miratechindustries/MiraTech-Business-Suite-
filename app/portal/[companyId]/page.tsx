"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { LifeBuoy, Send, ShieldCheck, Sparkles, CheckCircle2, Clock, MessageSquare, Building2, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

interface SupportMessage {
  id: string;
  companyId: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  isAdminReply?: boolean;
  status?: "open" | "in-progress" | "resolved";
  imageUrl?: string;
  createdAt?: any;
}

export default function CompanyCustomerPortal() {
  const params = useParams();
  const companyId = (params?.companyId as string) || "miratech-default";

  const [companyName, setCompanyName] = useState("MiraTech Enterprise Partner");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Company Info
  useEffect(() => {
    async function fetchCompany() {
      try {
        const docRef = doc(db, "companies", companyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) setCompanyName(data.name);
        } else {
          // Check users collection as fallback
          const userSnap = await getDoc(doc(db, "users", companyId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (uData.name || uData.companyName) setCompanyName(uData.name || uData.companyName);
          }
        }
      } catch (e) {
        console.error("Error fetching company info:", e);
      }
    }
    fetchCompany();
  }, [companyId]);

  // Real-time listener for support messages for this company
  useEffect(() => {
    try {
      const q = query(
        collection(db, "SupportMessages"),
        where("companyId", "==", companyId),
        orderBy("createdAt", "asc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: SupportMessage[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
        });
        setMessages(list);
        setLoading(false);
      }, (err) => {
        console.error("Error loading company support tickets:", err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to setup listener:", e);
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !customerEmail.trim() || sending) return;

    setSending(true);
    try {
      let imageUrl = "";
      if (imagePreview) {
        imageUrl = imagePreview;
      }

      await addDoc(collection(db, "SupportMessages"), {
        companyId,
        userId: customerEmail.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        userEmail: customerEmail.trim(),
        userName: customerName.trim() || customerEmail.split('@')[0],
        message: newMessage.trim() || "Attached screenshot/image",
        isAdminReply: false,
        status: "open",
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp()
      });
      setNewMessage("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to submit support ticket:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">{companyName}</h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Client Support Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Direct secure communication channel with {companyName} customer success desk.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Encrypted Relay</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl flex-1 flex flex-col overflow-hidden min-h-[600px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Support Conversation &amp; Ticket Feed</h2>
              <p className="text-xs text-slate-500">Submit your query below or track existing requests in real-time.</p>
            </div>
            <span className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
              Company ID: {companyId}
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="text-center py-20 text-xs text-slate-400">Loading secure support feed...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20 space-y-3 max-w-md mx-auto">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Welcome to {companyName} Support</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Have a question about your order, service, or technical integration? Enter your details and message below to open a ticket instantly.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.isAdminReply ? 'items-start' : 'items-end'} space-y-1`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-slate-700">{msg.userName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({msg.userEmail})</span>
                    {msg.isAdminReply && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">
                        {companyName} Support Agent
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      msg.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {msg.status || 'open'}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                      msg.isAdminReply
                        ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs font-medium'
                        : 'bg-indigo-600 text-white rounded-tr-xs'
                    }`}
                  >
                    {msg.message}
                    {msg.imageUrl && (
                      <div className="mt-2.5">
                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.imageUrl}
                            alt="Attached screenshot"
                            className="max-h-48 rounded-xl object-cover border border-white/20 hover:opacity-95 transition shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        </a>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75 font-mono">
                      <span>Ticket #{msg.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmitTicket} className="p-4 bg-white border-t border-slate-200 space-y-3">
            {imagePreview && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl w-fit">
                <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-300" referrerPolicy="no-referrer" />
                <div className="text-xs">
                  <span className="font-bold text-slate-700 block">Attached Screenshot</span>
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-red-600 hover:text-red-700 font-bold text-[11px] underline cursor-pointer"
                  >
                    Remove attachment
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your Full Name / Company"
                className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-slate-800"
              />
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Your Email Address (for replies & tracking)"
                className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-slate-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="portal-file-input"
              />
              <label
                htmlFor="portal-file-input"
                className="px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 border border-slate-200"
                title="Attach Screenshot"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="hidden sm:inline">Attach</span>
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your support request or issue..."
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-slate-800"
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !imageFile) || !customerEmail.trim() || sending}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shadow-md flex items-center gap-2 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Submit Ticket</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Powered by MiraTech Enterprise Customer Operations Backbone • Secure Multi-Tenant Client Portal
      </footer>
    </div>
  );
}
