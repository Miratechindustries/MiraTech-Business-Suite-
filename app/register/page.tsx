'use client';

import { useRouter } from 'next/navigation';
import { Landmark, ArrowLeft, ShieldAlert } from 'lucide-react';
import { motion } from "motion/react";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center space-y-6">
        
        {/* Branding */}
        <div className="space-y-2">
          <span className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
            <Landmark className="h-8 w-8 text-[#0066FF]" />
          </span>
          <h1 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
            MiraTech Corporate Gateway
          </h1>
          <p className="text-xs text-slate-500 font-medium">Isolated Corporate Multi-Tenant Environment</p>
        </div>

        {/* Warning Indicator */}
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-left space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs uppercase tracking-wide">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-600" /> Administrative Notice
          </div>
          <p className="text-xs text-amber-700 leading-normal font-sans">
            <strong>Public registration is strictly deactivated.</strong> Consistent with security requirements, corporate tenant environments and login accounts are provisioned exclusively by the System Master Admin.
          </p>
        </div>

        <div className="text-xs text-slate-500 font-medium leading-relaxed">
          If your company has already been established, please contact your Organization Administrator or refer to your invitation email to retrieve your email and password credentials.
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F172A] text-white hover:bg-slate-900 font-bold text-xs rounded-xl shadow-md transition duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go to Login Gateway
        </button>

      </div>
    </div>
  );
}
