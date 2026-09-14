'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { Shield, FileText, CheckCircle, Mail, ExternalLink, ArrowRight } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-slate-800 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <FileText className="w-3.5 h-3.5" />
              <span>Master Cloud Services Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Terms of Service & Conditions of Use
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span><strong>Effective Date:</strong> January 1, 2026</span>
              <span>•</span>
              <span><strong>Version:</strong> v3.0 (Paddle MoR & Enterprise SLA Aligned)</span>
              <span>•</span>
              <span><strong>Corporate Entity:</strong> MiraTech Industries</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#0B132B] p-4 rounded-xl border border-slate-800">
              Please read these Terms of Service carefully before utilizing MiraTech Business Suite. By creating an account, registering a corporate tenant, or using any software module, you agree to be legally bound by these terms.
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-sm text-white">Agreement Sections</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-400">
              <a href="#section-1" className="hover:underline">1. Acceptance & Contracting Entity</a>
              <a href="#section-2" className="hover:underline">2. Description of Cloud SaaS Platform</a>
              <a href="#section-3" className="hover:underline">3. Paddle as Merchant of Record</a>
              <a href="#section-4" className="hover:underline">4. Subscription Billing & Auto-Renewal</a>
              <a href="#section-5" className="hover:underline">5. 14-Day Free Evaluation Trial</a>
              <a href="#section-6" className="hover:underline">6. Cancellation & Account Termination</a>
              <a href="#section-7" className="hover:underline">7. Customer Data Ownership & Security</a>
              <a href="#section-8" className="hover:underline">8. Service Level Agreement (SLA 99.95%)</a>
              <a href="#section-9" className="hover:underline">9. Prohibited Conduct & Acceptable Use</a>
              <a href="#section-10" className="hover:underline">10. Contact & Legal Notices</a>
            </div>
          </div>

          {/* Legal Text Content */}
          <div className="space-y-10 text-xs sm:text-sm text-slate-300 leading-relaxed">
            {/* Section 1 */}
            <section id="section-1" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                1. Acceptance & Contracting Entity
              </h2>
              <p>
                This Master Cloud Services Agreement (&quot;Agreement&quot;) constitutes a legally binding contract between the corporate subscriber (&quot;Customer&quot;, &quot;you&quot;, or &quot;tenant&quot;) and <strong>MiraTech Industries</strong> (&quot;MiraTech&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
              </p>
              <p>
                By registering an account, provisioning a workspace, or executing a subscription, you confirm that you possess the requisite corporate authority to bind your organization to this Agreement. If you do not possess such authority or do not agree with these terms, you must refrain from accessing the platform.
              </p>
            </section>

            {/* Section 2 */}
            <section id="section-2" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                2. Description of Cloud SaaS Platform
              </h2>
              <p>
                MiraTech Business Suite is an enterprise cloud resource planning (ERP) and business operations software-as-a-service (SaaS) platform. The service provides modular capabilities including Sales & CRM, Quotations, Invoicing, Receipts, Double-Entry Financial Ledgers, Automated HR & Payroll, Multi-Warehouse Inventory Stock Control, Project Management, Procurement 3-Way Matching, and Executive Business Intelligence.
              </p>
            </section>

            {/* Section 3 */}
            <section id="section-3" className="space-y-3 bg-[#0B132B] p-6 rounded-2xl border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Shield className="w-5 h-5" />
                <h2 className="text-lg font-bold text-white">3. Paddle as Merchant of Record</h2>
              </div>
              <p className="text-slate-200">
                Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders. Paddle provides customer service inquiries related to payments, handles returns, and enforces global sales tax / VAT compliance across international jurisdictions.
              </p>
              <p className="text-slate-300">
                When you initiate a checkout or enter billing credentials, you are transacting directly with Paddle.com Market Ltd (or Paddle Payments Ltd) in accordance with Paddle&apos;s Checkout Buyer Terms and Conditions and Privacy Policy. All credit card tokens and payment instruments are processed securely in Level 1 PCI-DSS compliant environments; MiraTech never captures or stores raw card numbers.
              </p>
            </section>

            {/* Section 4 */}
            <section id="section-4" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                4. Subscription Billing, Recurring Cycles & Automatic Renewal
              </h2>
              <p>
                <strong>Recurring Billing:</strong> MiraTech Business Suite plans (Starter, Growth, Professional, Elite, Enterprise) are sold on a subscription basis and renew automatically on a recurring schedule (monthly or annually) until explicitly cancelled.
              </p>
              <p>
                <strong>Prepaid Fees:</strong> Fees are charged in advance on the first day of each billing period. Subscription rates are clearly displayed prior to checkout in your selected currency. Annual billing commitments reflect a 20% discount compared to the standard monthly schedule.
              </p>
              <p>
                <strong>Taxes:</strong> Fees are exclusive of applicable Value Added Tax (VAT), Goods and Services Tax (GST), or regional sales taxes, which are calculated, itemized, and collected by Paddle.com based on your billing jurisdiction. Official VAT/tax-compliant PDF receipts are generated and emailed upon each successful billing cycle.
              </p>
              <p>
                <strong>Payment Failures:</strong> In the event of a declined charge, Paddle will retry collection according to automated retry schedules. A 7-day administrative grace period applies before tenant access is restricted to read-only mode.
              </p>
            </section>

            {/* Section 5 */}
            <section id="section-5" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                5. 14-Day Free Evaluation Trial
              </h2>
              <p>
                Every newly provisioned corporate workspace receives a full-featured 14-day evaluation trial of their chosen plan. The trial allows organizations to evaluate all modules, invite team members, and configure ledgers.
              </p>
              <p>
                No charges are executed during the trial period. If you do not wish to continue into a paid recurring subscription, you may cancel at any point prior to the conclusion of the 14-day trial without obligation or charge.
              </p>
            </section>

            {/* Section 6 */}
            <section id="section-6" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                6. Cancellation & Account Termination
              </h2>
              <p>
                <strong>Self-Service Cancellation:</strong> You may cancel your subscription at any time without fees, penalties, or early termination charges. Cancellation can be completed directly within your workspace under <em>Settings &gt; Subscriptions</em>, or via the self-service Paddle Customer Portal.
              </p>
              <p>
                <strong>Continuity of Service:</strong> Upon cancelling, your workspace remains fully operational until the end of your current prepaid billing period.
              </p>
              <p>
                <strong>Refunds:</strong> Refund eligibility is governed exclusively by our published{' '}
                <Link href="/refund" className="text-amber-400 underline hover:text-amber-300">
                  Refund & Cancellation Policy
                </Link>. Annual plans qualify for a 14-day money-back guarantee from the initial payment date.
              </p>
            </section>

            {/* Section 7 */}
            <section id="section-7" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                7. Customer Data Ownership & Cryptographic Security
              </h2>
              <p>
                <strong>Ownership:</strong> Customer retains exclusive proprietary title to all business records, invoices, client records, inventory items, and financial data stored within their workspace.
              </p>
              <p>
                <strong>Tenant Isolation:</strong> MiraTech guarantees that customer data is logically isolated using tenant UID keys, enforced by collection-level security rules preventing any cross-tenant data access.
              </p>
              <p>
                <strong>Encryption:</strong> Data at rest is encrypted using AES-256 GCM hardware encryption. All data in transit enforces TLS 1.3 with Perfect Forward Secrecy.
              </p>
              <p>
                <strong>Data Export:</strong> Customer maintains the right to export financial ledgers, audit logs, and transaction tables in standard formats (CSV, XLSX, PDF) at any time.
              </p>
            </section>

            {/* Section 8 */}
            <section id="section-8" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                8. Service Level Agreement (SLA) & Availability
              </h2>
              <p>
                MiraTech commits to an operational uptime percentage of <strong>99.95%</strong> across all production cloud clusters, excluding scheduled maintenance windows announced with at least 48 hours advance notice.
              </p>
              <p>
                If uptime falls below 99.95% during any calendar month, Customer may request proportional service credits applied to subsequent billing cycles upon written request to billing@miratechsuite.com.
              </p>
            </section>

            {/* Section 9 */}
            <section id="section-9" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                9. Prohibited Conduct & Acceptable Use
              </h2>
              <p>
                Customer agrees not to: (a) issue fictitious invoices or utilize the platform for fraudulent commercial activities; (b) attempt to reverse engineer, decompile, or probe infrastructure API endpoints; (c) transmit malicious code or ransomware; (d) circumvent multi-tenant access controls; or (e) transmit unsolicited commercial spam through quotation notification relays.
              </p>
            </section>

            {/* Section 10 */}
            <section id="section-10" className="space-y-3">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
                10. Contact Information & Legal Notices
              </h2>
              <p>
                Formal statutory notices, contract inquiries, or dispute communications should be directed to our corporate legal desk:
              </p>
              <div className="bg-[#0B132B] p-5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <p><strong>Corporate Entity:</strong> MiraTech Industries</p>
                <p><strong>Primary Support & Legal Desk:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-amber-400 underline">miratechindustries@gmail.com</a></p>
                <p><strong>Regulatory & DPO Email:</strong> <a href="mailto:legal@miratechsuite.com" className="text-amber-400 underline">legal@miratechsuite.com</a></p>
                <p><strong>Merchant of Record:</strong> Paddle.com Market Ltd, Judd House, 18-29 Mora Street, London EC1V 8BT, United Kingdom</p>
              </div>
            </section>
          </div>

          {/* Quick Links Footer Strip */}
          <div className="border-t border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex gap-4">
              <Link href="/privacy" className="text-amber-400 hover:underline">
                View Privacy Policy &rarr;
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
