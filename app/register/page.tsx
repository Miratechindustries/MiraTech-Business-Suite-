'use client';

import Link from 'next/link';
import { Building2, ArrowLeft, ShieldCheck } from 'lucide-react';
import CompanyCreation from '../../components/CompanyCreation';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B132B] p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Building2 className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  MiraTech Company Registration & Onboarding
                </h1>
                <p className="text-xs text-slate-400">
                  Provision your isolated workspace with a 14-day free trial. Paddle Merchant of Record billing.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#111A38] border border-slate-700 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <span>Existing User? Sign In</span>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8">
            <CompanyCreation />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

