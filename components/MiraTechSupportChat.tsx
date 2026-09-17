"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Send, X, Minimize2, LifeBuoy, Sparkles, CheckCircle2 } from "lucide-react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useUserStore } from "../lib/store";

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

export default function MiraTechSupportChat() {
  const { currentUser } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || sending) return;

    setSending(true);
    try {
      const user = auth.currentUser || currentUser;
      let imageUrl = "";
      if (imagePreview) {
        imageUrl = imagePreview;
      }

      await addDoc(collection(db, "SupportMessages"), {
        userId: user?.uid || "anonymous",
        userEmail: user?.email || "guest@miratech.internal",
        userName: user?.displayName || user?.email?.split('@')[0] || "Valued User",
        message: newMessage.trim() || "Attached screenshot/image",
        isAdminReply: false,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp()
      });
      setNewMessage("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to send support message:", err);
    } finally {
      setSending(false);
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
        <div className="w-[360px] sm:w-[400px] h-[520px] bg-white border border-slate-200/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <HeadphonesIcon className="w-5 h-5 text-indigo-200" />
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
                  Send a query below. Our Master Admin support desk and technical engineers are standing by.
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
                      {msg.imageUrl && (
                        <div className="mt-2">
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={msg.imageUrl}
                              alt="Attached screenshot"
                              className="max-h-40 rounded-xl object-cover border border-white/20 hover:opacity-95 transition shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2 shrink-0">
            {imagePreview && (
              <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl w-fit">
                <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-300" referrerPolicy="no-referrer" />
                <div className="text-[11px]">
                  <span className="font-bold text-slate-700 block">Attached</span>
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-red-600 hover:text-red-700 font-bold underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="chat-file-input"
              />
              <label
                htmlFor="chat-file-input"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center border border-slate-200 shrink-0"
                title="Attach Screenshot"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your support query..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !imageFile) || sending}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  return createPortal(chatWidget, document.body);
}

function HeadphonesIcon(props: any) {
  return <LifeBuoy {...props} />;
}
