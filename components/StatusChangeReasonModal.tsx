'use client'

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface StatusChangeReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  businessName: string;
  newStatus: string;
}

export default function StatusChangeReasonModal({ isOpen, onClose, onConfirm, businessName, newStatus }: StatusChangeReasonModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Confirm Status Change</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Changing status of <strong>{businessName}</strong> to <strong>{newStatus}</strong>.
          Please provide a reason (optional):
        </p>
        <textarea
          className="w-full p-2 border rounded-lg mb-4"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for change..."
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
          <button 
            onClick={() => { onConfirm(reason); onClose(); }} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
