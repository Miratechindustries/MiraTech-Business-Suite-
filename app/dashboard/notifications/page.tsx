'use client'

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { Notification } from '@/lib/types';
import { Bell, Info, AlertTriangle, CheckCircle2, XCircle, Trash2, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAppStore();

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
    return unsub;
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-rose-500" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
        <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline">
           <CheckCheck className="h-4 w-4" /> Mark all as read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`group relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${
                n.isRead 
                  ? 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 opacity-70' 
                  : 'border-blue-100 bg-blue-50/20 dark:border-blue-900/20 dark:bg-blue-900/10 shadow-sm shadow-blue-500/5'
              }`}
            >
              <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.isRead ? 'bg-slate-50 dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                 {getTypeIcon(n.type)}
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold ${n.isRead ? 'text-slate-700' : 'text-slate-900 dark:text-white'}`}>{n.title}</h3>
                  <span className="text-[10px] font-medium text-slate-400">{new Date(n.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
              </div>
              {!n.isRead && (
                <button 
                  onClick={() => markAsRead(n.id)}
                  className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-600"
                />
              )}
              <button className="absolute bottom-4 right-4 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-500">
                 <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl dark:border-slate-800">
             <Bell className="mx-auto h-12 w-12 text-slate-200" />
             <p className="mt-4 font-bold text-slate-900 dark:text-white">You&apos;re all caught up!</p>
             <p className="text-sm text-slate-500">We&apos;ll alert you when something important happens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
