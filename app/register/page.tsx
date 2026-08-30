'use client';

import { useRouter } from 'next/navigation';
import { Landmark, ArrowLeft, Building2 } from 'lucide-react';
import CompanyCreation from '../../components/CompanyCreation';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                MiraTech Company Registration & Onboarding
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Complete your company profile, select your subscription tier (checkout stage), and provision your workspace.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <CompanyCreation />
        </div>
      </div>
    </div>
  );
}

