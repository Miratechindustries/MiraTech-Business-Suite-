'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RefreshCw, Bell, Clock } from 'lucide-react';

export default function PaddleNotificationsDashboard() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'paddle_notifications'), orderBy('receivedAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching paddle notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          Paddle Webhook Notifications
        </h2>
        <button 
          onClick={fetchNotifications}
          className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No notifications received yet.</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="bg-white p-4 border border-slate-200 rounded-xl shadow-3xs flex items-start gap-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-900">{n.event_type || n.eventType || 'Unknown Event'}</span>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {n.receivedAt ? new Date(n.receivedAt.toDate()).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 mt-2 rounded overflow-x-auto">
                  {JSON.stringify(n, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
