'use client'

import React from 'react';
import { X } from 'lucide-react';
import { Business } from '@/lib/types';

interface BusinessDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null;
}

export default function BusinessDetailsModal({ isOpen, onClose, business }: BusinessDetailsModalProps) {
  if (!isOpen || !business) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Business Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-500">Name</label>
            <p className="text-lg font-semibold">{business.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Email</label>
            <p className="text-lg">{business.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Status</label>
            <p className="text-lg uppercase">{business.status}</p>
          </div>
          {/* Add other details if available in Business type (or potentially extend business type) */}
          <div>
            <label className="text-sm font-medium text-slate-500">Phone</label>
            <p className="text-lg">{business.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Address</label>
            <p className="text-lg">{business.address || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500">Currency</label>
            <p className="text-lg">{business.currency}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
