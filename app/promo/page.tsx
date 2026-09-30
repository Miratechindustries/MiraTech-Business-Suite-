'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import PromoVideoTrailer from '../../components/public/PromoVideoTrailer';
import { ArrowLeft, Sparkles, Building2, PlayCircle, ShieldCheck } from 'lucide-react';

export default function PromoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      <PublicHeader />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MiraTech 4K Commercial Studio</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Experience the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">Future of Business Operations</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Watch our official 60-second product commercial showcasing how MiraTech Business Suite unifies ledger accounting, automated payroll, POS inventory, and SecOps compliance.
          </p>
        </div>

        {/* 4K Video Commercial Engine */}
        <PromoVideoTrailer />

        {/* Bottom CTA Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-900/40 via-slate-900 to-indigo-900/40 border border-blue-500/30 text-center space-y-6 max-w-4xl mx-auto shadow-2xl">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">Ready to Transform Your Corporate Workspace?</h3>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">
              Start your 14-day zero-obligation enterprise trial today. Full access to all 8 operational modules.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/#pricing"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl transition"
            >
              Start 14-Day Free Trial
            </Link>
            <Link
              href="/#modules"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition"
            >
              Explore Full Module Breakdown
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
