"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Headphones, 
  X, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  HelpCircle,
  Building2,
  Mail,
  User,
  MessageSquare,
  LifeBuoy,
  FileText
} from "lucide-react";
import { useUserStore } from "../lib/store";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

interface SupportMessage {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  isAdminReply?: boolean;
  imageUrl?: string;
  createdAt?: any;
}

interface QuickSupportFABProps {
  currentCompany?: {
    id?: string;
    name?: string;
    subscriptionStatus?: string;
    subscriptionPlanId?: string;
  } | null;
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
}

export default function QuickSupportFAB({
  currentCompany,
  isOpenExternal,
  onCloseExternal,
}: QuickSupportFABProps) {
  const { currentUser } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"form" | "chat">("form");
  const [mounted, setMounted] = useState(false);

  // Quick Inquiry Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("General Inquiry");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  // Live Chat State
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync external open request
  useEffect(() => {
    if (typeof isOpenExternal === "boolean") {
      setIsOpen(isOpenExternal);
      if (isOpenExternal) {
        setActiveView("form");
      }
    }
  }, [isOpenExternal]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-fill user data on mount or when user/company resolves
  useEffect(() => {
    setName((prev) => {
      if (prev) return prev;
      return currentUser?.displayName || auth.currentUser?.displayName || "";
    });
    setEmail((prev) => {
      if (prev) return prev;
      return currentUser?.email || auth.currentUser?.email || "";
    });
    setCompanyName((prev) => {
      if (prev) return prev;
      return currentCompany?.name || "";
    });
    if (currentCompany?.subscriptionStatus === "trialing") {
      setCategory("Evaluation & Trial Assistance");
    }
  }, [currentUser, currentCompany]);

  // Live chat subscription when in chat view
  useEffect(() => {
    if (!isOpen || activeView !== "chat") return;
    try {
      const q = query(collection(db, "SupportMessages"), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: SupportMessage[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
        });
        setMessages(list);
      }, (err) => {
        console.warn("[QuickSupportFAB] SupportMessages stream warning:", err.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("[QuickSupportFAB] Failed to subscribe to messages:", e);
    }
  }, [isOpen, activeView]);

  useEffect(() => {
    if (isOpen && activeView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeView]);

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    if (onCloseExternal) {
      onCloseExternal();
    }
  };

  const handleResetForm = () => {
    setSubject("");
    setMessage("");
    setSuccessTicket(null);
    setError(null);
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please specify a valid corporate or work email.");
      return;
    }

    if (!subject.trim()) {
      setError("Please specify an inquiry subject.");
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      setError("Please provide descriptive inquiry details (min. 5 characters).");
      return;
    }

    setSubmitting(true);

    try {
      const activeUser = auth.currentUser;
      const payload = {
        name: name.trim() || "Enterprise User",
        email: email.trim().toLowerCase(),
        companyName: companyName.trim() || currentCompany?.name || "Corporate Tenant",
        companyId: currentCompany?.id || currentUser?.companyId || null,
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        userId: activeUser?.uid || currentUser?.id || null,
      };

      // 1. Call server API route for robust persistence & Brevo dispatch
      const res = await fetch("/api/support/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit support inquiry.");
      }

      setSuccessTicket(data.ticketNumber || `MIRA-SUP-${Math.floor(100000 + Math.random() * 900000)}`);
    } catch (err: any) {
      console.warn("[QuickSupportFAB] API issue, fallback to direct Firestore:", err.message);

      // Fallback: Direct write to client Firestore
      try {
        const fallbackTicket = `MIRA-SUP-${Math.floor(100000 + Math.random() * 900000)}`;
        await addDoc(collection(db, "SupportMessages"), {
          id: fallbackTicket,
          userId: auth.currentUser?.uid || currentUser?.id || "anonymous",
          userEmail: email.trim().toLowerCase(),
          userName: name.trim() || "Corporate User",
          companyId: currentCompany?.id || null,
          message: `[${category} - ${priority.toUpperCase()} PRIORITY]\nSubject: ${subject.trim()}\n\n${message.trim()}`,
          createdAt: serverTimestamp(),
          isQuickInquiry: true,
          ticketNumber: fallbackTicket,
        });

        setSuccessTicket(fallbackTicket);
      } catch (fbErr: any) {
        setError(err.message || "Failed to register inquiry. Please retry or email miratechindustries@gmail.com directly.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendLiveChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat) return;

    setSendingChat(true);
    try {
      const activeUser = auth.currentUser;
      await addDoc(collection(db, "SupportMessages"), {
        userId: activeUser?.uid || currentUser?.id || "guest",
        userEmail: activeUser?.email || currentUser?.email || email || "guest@miratech.io",
        userName: activeUser?.displayName || currentUser?.displayName || name || "Corporate User",
        companyId: currentCompany?.id || null,
        message: chatMessage.trim(),
        createdAt: serverTimestamp(),
      });
      setChatMessage("");
    } catch (err: any) {
      console.error("[QuickSupportFAB] Failed to dispatch chat message:", err);
    } finally {
      setSendingChat(false);
    }
  };

  if (!mounted) return null;

  const content = (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 font-sans">
        <button
          type="button"
          id="btn-quick-support-fab"
          onClick={() => {
            setIsOpen(true);
            setActiveView("form");
          }}
          className="group relative flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer border border-slate-700/80 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
          title="Open Quick Support Contact Form"
        >
          {/* Live indicator beacon */}
          <div className="relative flex items-center justify-center">
            <Headphones className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-slate-900" />
            </span>
          </div>

          <div className="text-left">
            <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-300">
              Immediate Help
            </span>
            <span className="block text-xs font-bold text-white tracking-tight">
              Quick Support
            </span>
          </div>
        </button>
      </div>

      {/* Quick Support Dialog Modal */}
      {isOpen && (
        <div 
          id="modal-quick-support-form"
          className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
            {/* Modal Top Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white tracking-tight truncate">
                      MiraTech Support Desk
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex-shrink-0">
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Enterprise assistance, evaluation trials, and billing.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  id="btn-close-quick-support"
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Quick Contact Form vs Live Chat) */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
              <button
                type="button"
                id="tab-btn-quick-inquiry-form"
                onClick={() => setActiveView("form")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === "form"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Quick Contact Form</span>
              </button>

              <button
                type="button"
                id="tab-btn-live-chat-session"
                onClick={() => setActiveView("chat")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === "chat"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Chat Session</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {activeView === "form" ? (
                /* VIEW 1: Quick Support Contact Form */
                successTicket ? (
                  /* Success Confirmation View */
                  <div className="py-6 px-4 text-center space-y-4 animate-fade-in">
                    <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                        Support Inquiry Registered
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        Your inquiry has been assigned to our on-call technical desk. A confirmation record has been logged for <strong className="text-slate-800">{email}</strong>.
                      </p>
                    </div>

                    {/* Ticket Reference Badge */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-sm mx-auto text-left space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Ticket Reference:</span>
                        <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          #{successTicket}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Estimated SLA:</span>
                        <span className="font-bold text-slate-700">15 – 30 Minutes</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Priority Queue:</span>
                        <span className="font-bold uppercase text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {priority}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                      >
                        Submit Another Inquiry
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-6 py-2.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-sm"
                      >
                        Return to Dashboard
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Fields */
                  <form onSubmit={handleSubmitInquiry} className="space-y-4">
                    {error && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Contact Info (Row) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Full Name</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Work Email *</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Category & Priority (Row) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          Inquiry Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="Evaluation & Trial Assistance">Evaluation &amp; Trial Assistance</option>
                          <option value="General Inquiry">General Inquiry</option>
                          <option value="Technical Support & Incident">Technical Support &amp; Incident</option>
                          <option value="Billing & Subscriptions">Billing &amp; Subscriptions</option>
                          <option value="Feature Request">Feature Request</option>
                          <option value="Security & Compliance">Security &amp; Compliance</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          Priority Level
                        </label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="normal">Normal (Standard SLA)</option>
                          <option value="high">High (Operational Impact)</option>
                          <option value="urgent">Urgent (System Blocker)</option>
                        </select>
                      </div>
                    </div>

                    {/* Subject Line */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Subject Line *
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g., Question regarding trial evaluation or module access"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {/* Message / Inquiry Details */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <label className="font-bold text-slate-700">
                          Inquiry Details *
                        </label>
                        <span className="text-slate-400 text-[10px]">
                          {message.length} characters
                        </span>
                      </div>
                      <textarea
                        required
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe what you need assistance with, steps to reproduce, or evaluation questions..."
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                      />
                    </div>

                    {/* Direct Contact Notice */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-500">
                      <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span>For urgent direct escalation, contact </span>
                        <a 
                          href="mailto:miratechindustries@gmail.com" 
                          className="text-indigo-600 font-bold hover:underline"
                        >
                          miratechindustries@gmail.com
                        </a>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        id="btn-submit-quick-support-form"
                        disabled={submitting}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Transmitting...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit Immediate Inquiry</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                /* VIEW 2: Live Chat Session */
                <div className="flex flex-col h-[380px] -m-2">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                    <div className="text-center py-1">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                        Live Technical Support Channel
                      </span>
                    </div>

                    {messages.length === 0 ? (
                      <div className="text-center py-10 px-4 space-y-2">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">Direct Live Chat</h4>
                        <p className="text-[11px] text-slate-500">
                          Send a message below. Technical engineers will respond in real time.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.userId === (auth.currentUser?.uid || currentUser?.id);
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                          >
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="text-[10px] font-bold text-slate-500">
                                {isMe ? 'You' : msg.userName}
                              </span>
                            </div>
                            <div
                              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-4xs ${
                                isMe
                                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs font-medium'
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleSendLiveChatMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!chatMessage.trim() || sendingChat}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                    >
                      {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}
