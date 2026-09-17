"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Send, X, Minimize2, LifeBuoy, Sparkles, CheckCircle2, Search, Clock, AlertCircle } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useUserStore } from "../lib/store";

interface SupportMessage {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  isAdminReply?: boolean;
  status?: "open" | "in-progress" | "resolved";
  createdAt?: any;
}

export default function MiraTechSupportChat() {
  const { currentUser } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "tracker">("chat");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ticket tracker state
  const [ticketIdInput, setTicketIdInput] = useState("");
  const [trackedTicket, setTrackedTicket] = useState<SupportMessage | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerError, setTrackerError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const q = query(collection(db, "SupportMessages"), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: SupportMessage[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
        });
        setMessages(list);
      }, (err) => {
        console.error("Error listening to SupportMessages:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to subscribe to SupportMessages:", e);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const user = auth.currentUser || currentUser;
      await addDoc(collection(db, "SupportMessages"), {
        userId: user?.uid || "anonymous",
        userEmail: user?.email || "guest@miratech.internal",
        userName: user?.displayName || user?.email?.split('@')[0] || "Valued User",
        message: newMessage.trim(),
        isAdminReply: false,
        status: "open",
        createdAt: serverTimestamp()
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send support message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleTrackTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = ticketIdInput.trim();
    if (!cleanId) return;

    setTrackerLoading(true);
    setTrackerError("");
    setTrackedTicket(null);

    try {
      const docRef = doc(db, "SupportMessages", cleanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTrackedTicket({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
      } else {
        // Try searching in messages state if live
        const found = messages.find(m => m.id === cleanId);
        if (found) {
          setTrackedTicket(found);
        } else {
          setTrackerError("Ticket ID not found. Please verify the ID and try again.");
        }
      }
    } catch (err) {
      console.error("Error tracking ticket:", err);
      setTrackerError("Failed to fetch ticket status. Please check the ID.");
    } finally {
      setTrackerLoading(false);
    }
  };

  if (!mounted) return null;

  const chatWidget = (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer border border-indigo-400/30"
          title="MiraTech Support Desk"
        >
          <div className="relative">
            <LifeBuoy className="w-5 h-5 animate-pulse text-indigo-100" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-600" />
          </div>
          <div className="text-left">
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">24/7 Desk</span>
            <span className="block text-xs font-bold text-white">MiraTech Support</span>
          </div>
        </button>
      ) : (
        <div className="w-[380px] sm:w-[420px] h-[540px] bg-white border border-slate-200/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <LifeBuoy className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-extrabold tracking-tight">MiraTech Support Desk</h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/80 font-medium">Enterprise Assistance & Engineers</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-indigo-200 hover:text-white transition cursor-pointer"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-indigo-200 hover:text-white transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "chat" ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Chat</span>
            </button>
            <button
              onClick={() => setActiveTab("tracker")}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "tracker" ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track Ticket ID</span>
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                <div className="text-center py-2">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                    Encrypted Support Session
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-2">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">How can we assist your enterprise today?</h4>
                    <p className="text-[11px] text-slate-500">
                      Send a query below. Each message generates a unique Ticket ID for real-time tracking.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === (auth.currentUser?.uid || currentUser?.uid);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] font-bold text-slate-500">
                            {isMe ? 'You' : msg.userName}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">ID: {msg.id.slice(0, 6)}...</span>
                          {msg.isAdminReply && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.2 rounded">
                              Support Agent
                            </span>
                          )}
                        </div>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-4xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs font-medium'
                          }`}
                        >
                          {msg.message}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                            <span className="uppercase font-bold tracking-wider">{msg.status || 'open'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your support query (creates ticket)..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* Ticket Tracker Tab */
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900">Real-Time Ticket Tracker</h4>
                <p className="text-[11px] text-slate-500">Enter your support Ticket ID to inspect its live status, agent replies, and progress.</p>
              </div>

              <form onSubmit={handleTrackTicket} className="flex items-center gap-2">
                <input
                  type="text"
                  value={ticketIdInput}
                  onChange={(e) => setTicketIdInput(e.target.value)}
                  placeholder="Paste Ticket ID (e.g., abc123xyz)..."
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono"
                />
                <button
                  type="submit"
                  disabled={trackerLoading || !ticketIdInput.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
                >
                  {trackerLoading ? 'Searching...' : 'Track'}
                </button>
              </form>

              {trackerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trackerError}</span>
                </div>
              )}

              {trackedTicket && (
                <div className="bg-white border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-sm animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-mono text-slate-400">ID: {trackedTicket.id}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase ${
                      trackedTicket.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                      trackedTicket.status === 'in-progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {trackedTicket.status || 'open'}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-slate-500">{trackedTicket.userName} ({trackedTicket.userEmail})</p>
                    <p className="text-xs text-slate-800 font-medium mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {trackedTicket.message}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Progress Timeline</span>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Ticket received & assigned to MiraTech support desk</span>
                      </div>
                      {trackedTicket.isAdminReply && (
                        <div className="flex items-center gap-2 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Support engineer replied</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(chatWidget, document.body);
}


