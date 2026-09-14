'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { ShieldCheck, Lock, Database, Mail, ArrowRight } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data Protection & Privacy Notice</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Global Privacy Policy
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span><strong>Effective Date:</strong> January 1, 2026</span>
              <span>•</span>
              <span><strong>Version:</strong> v2.4</span>
              <span>•</span>
              <span><strong>Corporate Entity:</strong> MiraTech Industries</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#0B132B] p-4 rounded-xl border border-slate-800">
              MiraTech Industries committed to protecting corporate and individual data privacy. This policy explains how MiraTech Business Suite captures, encrypts, processes, and purges personal and organizational data in accordance with international data protection frameworks including GDPR and POPIA.
            </p>
          </div>

          {/* Core Privacy Text */}
          <div className="space-y-10 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. Data Controller & Corporate Identity
              </h2>
              <p>
                MiraTech Business Suite is operated by <strong>MiraTech Industries</strong>. When you create a corporate workspace, MiraTech acts primarily as a <strong>Data Processor</strong> (or Service Provider) for the tenant data you upload, while Customer serves as the <strong>Data Controller</strong>.
              </p>
              <p>
                For account registration, identity credentials, and direct billing interactions, MiraTech and its reseller Paddle act as independent controllers in accordance with applicable privacy statutes.
              </p>
            </section>

            <section className="space-y-3 bg-[#0B132B] p-6 rounded-2xl border border-amber-500/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>2. Payment Processing & Paddle as Merchant of Record</span>
              </h2>
              <p className="text-slate-200">
                All payment transactions, credit card handling, and subscription checkouts are processed exclusively through our online reseller and Merchant of Record, <strong>Paddle.com Market Ltd</strong>.
              </p>
              <p className="text-slate-300">
                Payment instrument data (credit card numbers, CVC, expiry dates) is transmitted directly to Paddle&apos;s Level 1 PCI-DSS certified infrastructure. MiraTech never stores, inspects, or processes sensitive credit card numbers on our application servers. Paddle&apos;s privacy practices are governed by the Paddle Privacy Policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                3. Categories of Data Collected
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account Credentials:</strong> Corporate email address, administrator name, phone number, and cryptographic salted authentication hashes.
                </li>
                <li>
                  <strong>Tenant Operational Data:</strong> Customer rosters, supplier registries, quotation line items, VAT invoices, payment receipts, payroll ledgers, and inventory counts entered into your workspace.
                </li>
                <li>
                  <strong>Security & Telemetry Records:</strong> Anonymized IP addresses, browser user-agent tokens, TLS session logs, and SecOps audit timestamps strictly utilized for fraud prevention and system security.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. Multi-Tenant Cryptographic Isolation
              </h2>
              <p>
                Every customer workspace operates within a logically isolated database partition. All Firestore and database queries enforce strict tenant UID filtering, preventing cross-organization visibility.
              </p>
              <p>
                Data at rest is secured via <strong>AES-256 GCM</strong> encryption with automated Google Cloud KMS key rotation. All communications between your browser and our cloud edge enforce <strong>TLS 1.3</strong> encryption with Perfect Forward Secrecy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. Third-Party Subprocessors
              </h2>
              <p>
                To provide high-availability cloud infrastructure, MiraTech engages vetted enterprise subprocessors bound by Data Processing Agreements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-1">
                  <h4 className="font-bold text-white text-xs">Google Cloud Platform</h4>
                  <p className="text-[11px] text-slate-400">Cloud Run compute, Firestore databases, Cloud KMS encryption keys.</p>
                </div>
                <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-1">
                  <h4 className="font-bold text-white text-xs">Paddle.com Market Ltd</h4>
                  <p className="text-[11px] text-slate-400">Merchant of Record, subscription billing, payment gateway, and sales tax compliance.</p>
                </div>
                <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-1">
                  <h4 className="font-bold text-white text-xs">Firebase (Google LLC)</h4>
                  <p className="text-[11px] text-slate-400">Authentication tokens, password reset security, and user session lifecycle.</p>
                </div>
                <div className="p-4 bg-[#0B132B] border border-slate-800 rounded-xl space-y-1">
                  <h4 className="font-bold text-white text-xs">Google Gemini Cloud API</h4>
                  <p className="text-[11px] text-slate-400">Zero-retention AI reporting summaries; customer data is never used to train foundation models.</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                6. Data Retention, Portability & Deletion
              </h2>
              <p>
                Customer operational data is retained for the active duration of your subscription. Upon account closure, Customer maintains a 30-day window to export all financial ledgers, audit logs, and transaction tables in XLSX and JSON formats before database de-provisioning.
              </p>
              <p>
                Following account termination, workspace documents and indices are permanently scrubbed using digital sanitization protocols, subject only to statutory tax retention obligations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                7. Data Subject Rights & Contact Desk
              </h2>
              <p>
                Under GDPR, POPIA, and international regulations, authorized individuals may request data access, rectification, portability, or erasure by contacting our compliance desk:
              </p>
              <div className="bg-[#0B132B] p-5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <p><strong>Data Protection Desk:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-amber-400 underline">miratechindustries@gmail.com</a></p>
                <p><strong>Regulatory Office:</strong> <a href="mailto:privacy@miratechsuite.com" className="text-amber-400 underline">privacy@miratechsuite.com</a></p>
                <p><strong>Mailing Address:</strong> MiraTech Industries, Corporate Legal Affairs, Mbabane / Johannesburg</p>
              </div>
            </section>
          </div>

          {/* Quick Links Footer Strip */}
          <div className="border-t border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex gap-4">
              <Link href="/terms" className="text-amber-400 hover:underline">
                View Terms of Service &rarr;
              </Link>
              <Link href="/refund" className="text-amber-400 hover:underline">
                View Refund & Cancellation Policy &rarr;
              </Link>
            </div>
            <Link
              href="/register"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
