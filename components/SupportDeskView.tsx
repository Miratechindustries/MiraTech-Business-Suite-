"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { LifeBuoy, Send, Trash2, CheckCircle2, MessageSquare, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { motion } from "motion/react";

interface SupportMessage {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  isAdminReply?: boolean;
  createdAt?: any;
}

export default function SupportDeskView() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const q = query(collection(db, "SupportMessages"), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: SupportMessage[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SupportMessage);
        });
        setMessages(list);
        setLoading(false);
      }, (err) => {
        console.error("Error fetching support messages:", err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to init support desk listener:", e);
      setLoading(false);
    }
  }, []);

  const [copiedLink, setCopiedLink] = useState(false);

  const copyPortalLink = () => {
    const companyId = auth.currentUser?.uid || "miratech-default";
    const url = `${window.location.origin}/portal/${companyId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const sendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      const adminUser = auth.currentUser;
      const companyId = adminUser?.uid || "miratech-default";
      await addDoc(collection(db, "SupportMessages"), {
        companyId,
        userId: adminUser?.uid || "master-admin",
        userEmail: adminUser?.email || "admin@miratech.internal",
        userName: "MiraTech Support Agent",
        message: replyText.trim(),
        isAdminReply: true,
        status: "in-progress",
        createdAt: serverTimestamp()
      });
      setReplyText("");
    } catch (err) {
      console.error("Failed to send admin reply:", err);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, "SupportMessages", id));
    } catch (err) {
      console.error("Failed to delete support message:", err);
    }
  };

  // Group by user email
  const userConversations = Array.from(new Set(messages.map(m => m.userEmail)));

  const activeMessages = selectedUserEmail 
    ? messages.filter(m => m.userEmail === selectedUserEmail)
    : messages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-4xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200/60">
              Customer Operations
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Real-Time Ticket Feed</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-indigo-600" /> MiraTech Support Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor incoming client queries, respond in real-time, and provide enterprise-grade assistance across all active tenants.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={copyPortalLink}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <MessageSquare className="w-4 h-4" />}
            <span>{copiedLink ? "Link Copied to Clipboard!" : "Copy Client Support Link"}</span>
          </button>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Chat Relay Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conversations Sidebar */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-4xs p-4 flex flex-col h-[600px]">
          <div className="p-2 border-b border-slate-100 mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Clients / Users ({userConversations.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            <button
              onClick={() => setSelectedUserEmail(null)}
              className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                selectedUserEmail === null ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">All Conversations</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${selectedUserEmail === null ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {messages.length}
              </span>
            </button>
            {userConversations.map((email) => {
              const count = messages.filter(m => m.userEmail === email).length;
              const isSelected = selectedUserEmail === email;
              return (
                <button
                  key={email}
                  onClick={() => setSelectedUserEmail(email)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-medium transition flex items-center justify-between ${
                    isSelected ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-bold text-xs">{email}</p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {messages.filter(m => m.userEmail === email).slice(-1)[0]?.message || 'No messages'}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Feed & Reply Box */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-4xs flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                {selectedUserEmail ? `Conversation with ${selectedUserEmail}` : 'All Support Messages Feed'}
              </h3>
              <p className="text-[11px] text-slate-500">Instant bidirectional channel linked to client floating widgets.</p>
            </div>
            {selectedUserEmail && (
              <button
                onClick={() => setSelectedUserEmail(null)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                View All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="text-center py-20 text-xs text-slate-400">Loading support ticket feed...</div>
            ) : activeMessages.length === 0 ? (
              <div className="text-center py-20 space-y-2">
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
                <h4 className="text-xs font-bold text-slate-700">No support messages found</h4>
                <p className="text-[11px] text-slate-400">When users submit queries via the floating support widget, they will appear here instantly.</p>
              </div>
            ) : (
              activeMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.isAdminReply ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold text-slate-700">{msg.userName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({msg.userEmail})</span>
                    {msg.isAdminReply && (
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded">
                        Support Agent
                      </span>
                    )}
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="text-slate-300 hover:text-red-500 transition p-1"
                      title="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-4xs ${
                      msg.isAdminReply
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs font-medium'
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
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <form onSubmit={sendAdminReply} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={selectedUserEmail ? `Reply to ${selectedUserEmail}...` : "Type broadcast or support response..."}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || sending}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Send className="w-4 h-4" />
              <span>Send Reply</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
