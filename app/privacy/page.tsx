'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { ShieldCheck, Lock, Database, Mail, ArrowRight } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-slate-200 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data Protection & Privacy Notice</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Global Privacy Policy
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span><strong>Effective Date:</strong> January 1, 2026</span>
              <span>•</span>
              <span><strong>Version:</strong> v2.4</span>
              <span>•</span>
              <span><strong>Corporate Entity:</strong> MiraTech Industries / MiraTech Business Suite</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              MiraTech Industries is committed to protecting corporate and individual data privacy. This policy explains how MiraTech Business Suite captures, encrypts, processes, and purges personal and organizational data in accordance with international data protection frameworks including GDPR and POPIA.
            </p>
          </div>

          {/* Core Privacy Text */}
          <div className="space-y-10 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                1. Data Controller & Corporate Identity
              </h2>
              <p>
                MiraTech Business Suite is operated by <strong>MiraTech Industries</strong>. When you create a corporate workspace, MiraTech acts primarily as a <strong>Data Processor</strong> (or Service Provider) for the tenant data you upload, while Customer serves as the <strong>Data Controller</strong>.
              </p>
              <p>
                For account registration, identity credentials, and direct billing interactions, MiraTech and its reseller Paddle act as independent controllers in accordance with applicable privacy statutes.
              </p>
            </section>

            <section className="space-y-3 bg-blue-50/70 p-6 rounded-2xl border border-blue-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>2. Payment Processing & Paddle as Merchant of Record</span>
              </h2>
              <p className="text-slate-800 font-medium">
                All payment transactions, credit card handling, and subscription checkouts are processed exclusively through our online reseller and Merchant of Record, <strong>Paddle.com Market Ltd</strong>.
              </p>
              <p className="text-slate-700">
                Payment instrument data (credit card numbers, CVC, expiry dates) is transmitted directly to Paddle&apos;s Level 1 PCI-DSS certified infrastructure. MiraTech never stores, inspects, or processes sensitive credit card numbers on our application servers. Paddle&apos;s privacy practices are governed by the Paddle Privacy Policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
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
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
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
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                5. Third-Party Subprocessors
              </h2>
              <p>
                To provide high-availability cloud infrastructure, MiraTech engages vetted enterprise subprocessors bound by Data Processing Agreements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1 shadow-xs">
                  <strong className="text-slate-900 block">Paddle.com Market Ltd</strong>
                  <p className="text-xs text-slate-600">Merchant of Record, global billing, tax collection, and payment fraud prevention.</p>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1 shadow-xs">
                  <strong className="text-slate-900 block">Google Cloud Platform &amp; Firebase</strong>
                  <p className="text-xs text-slate-600">Secure cloud database storage, authentication, and container hosting infrastructure.</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                6. Data Retention, Export & Deletion
              </h2>
              <p>
                Customers retain full rights to export their workspace financial data and employee records at any time in CSV or PDF format. Upon subscription cancellation and account termination, tenant data is archived for 30 days before undergoing secure cryptographic purging across our clusters.
              </p>
            </section>

            <section className="space-y-3 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
                7. Privacy Requests & Contact Information
              </h2>
              <p>
                For all privacy-related inquiries, data access requests, or deletion notices, please contact our data protection desk:
              </p>
              <div className="space-y-1 text-xs pt-1">
                <p><strong>Entity:</strong> MiraTech Industries / MiraTech Business Suite</p>
                <p><strong>Privacy Desk Email:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a></p>
                <p><strong>Support Phone:</strong> <a href="tel:+26879427339" className="text-blue-600 underline font-mono">+268 7942 7339</a> / <a href="tel:+26876427339" className="text-blue-600 underline font-mono">+268 7642 7339</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
