'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, ArrowLeft, ShieldCheck } from 'lucide-react';
import CompanyCreation from '../../components/CompanyCreation';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Landing Page</span>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                <Building2 className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  MiraTech Company Registration &amp; Onboarding
                </h1>
                <p className="text-xs text-slate-600">
                  Provision your isolated workspace with a 14-day free trial. Paddle Merchant of Record billing.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                <span>Existing User? Sign In</span>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8">
            <CompanyCreation />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
