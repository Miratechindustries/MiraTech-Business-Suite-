'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, ShieldCheck, Mail, Globe, Lock, ExternalLink, PhoneCall } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-600 text-xs font-sans">
      {/* Merchant of Record & Trust Highlight Strip */}
      <div className="border-b border-blue-100 bg-blue-50/70 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-slate-900 font-bold text-xs">Paddle Merchant of Record Protection</h4>
              <p className="text-[11px] text-slate-600 max-w-2xl mt-0.5">
                Payments, recurring subscriptions, and global tax compliance (VAT, GST, Sales Tax) are processed securely by Paddle.com Market Ltd as the Merchant of Record for MiraTech Business Suite.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-600 shrink-0 font-medium">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>TLS 1.3 &amp; AES-256</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>14-Day Evaluation Trial</span>
            <span className="text-slate-300">•</span>
            <Link href="/refund" className="text-blue-600 hover:underline font-semibold">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand & Mission */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">MiraTech Business Suite</span>
            </Link>
            <p className="text-slate-600 text-xs leading-relaxed max-w-sm">
              Institutional-grade cloud business management &amp; ERP SaaS engineered for agile, scaling enterprises. Unify Sales &amp; CRM, Dual-Entry Accounting, Invoicing, Payroll, Multi-Warehouse Inventory, and Operations under a single resilient architecture.
            </p>
            <div className="pt-2 text-[11px] text-slate-600 space-y-1">
              <p><strong className="text-slate-800">Corporate Entity:</strong> MiraTech Industries</p>
              <p><strong className="text-slate-800">Support Desk:</strong> <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 hover:underline">miratechindustries@gmail.com</a></p>
              <p><strong className="text-slate-800">Business Phone:</strong> <a href="tel:+26879427339" className="text-blue-600 hover:underline font-mono">+268 7942 7339</a> / <a href="tel:+26876427339" className="text-blue-600 hover:underline font-mono">+268 7642 7339</a></p>
            </div>
          </div>

          {/* Column: Core Modules */}
          <div className="space-y-3">
            <h5 className="text-slate-900 font-bold text-xs tracking-wider uppercase">ERP Modules</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/features#sales" className="hover:text-blue-600 transition-colors">Sales &amp; CRM Directory</Link></li>
              <li><Link href="/features#finance" className="hover:text-blue-600 transition-colors">Finance &amp; Double Ledger</Link></li>
              <li><Link href="/features#invoicing" className="hover:text-blue-600 transition-colors">Invoices &amp; Quotations</Link></li>
              <li><Link href="/features#payroll" className="hover:text-blue-600 transition-colors">HR &amp; Automated Payroll</Link></li>
              <li><Link href="/features#inventory" className="hover:text-blue-600 transition-colors">Multi-Warehouse Inventory</Link></li>
              <li><Link href="/features#procurement" className="hover:text-blue-600 transition-colors">Procurement &amp; 3-Way Match</Link></li>
              <li><Link href="/features#projects" className="hover:text-blue-600 transition-colors">Project Workspaces</Link></li>
            </ul>
          </div>

          {/* Column: Pricing & Tiers */}
          <div className="space-y-3">
            <h5 className="text-slate-900 font-bold text-xs tracking-wider uppercase">Subscriptions</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Starter Plan ($49/mo)</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Growth Plan ($99/mo)</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Professional Plan ($199/mo)</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Elite Plan ($349/mo)</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Enterprise Plan ($599/mo)</Link></li>
              <li><Link href="/pricing" className="hover:text-blue-600 transition-colors">Compare All Features</Link></li>
              <li><Link href="/register" className="text-blue-600 font-bold hover:underline">Start 14-Day Free Trial</Link></li>
            </ul>
          </div>

          {/* Column: Legal & Compliance */}
          <div className="space-y-3">
            <h5 className="text-slate-900 font-bold text-xs tracking-wider uppercase">Legal &amp; Governance</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund" className="hover:text-blue-600 transition-colors font-semibold text-blue-600">Refund &amp; Cancellation Policy</Link></li>
              <li><Link href="/support" className="hover:text-blue-600 transition-colors">Customer Support Desk</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Paddle Reseller Notice */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>
            © {new Date().getFullYear()} MiraTech Industries. All rights reserved. MiraTech Business Suite is a trademark of MiraTech Industries.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/refund" className="hover:text-slate-900 transition-colors">Refunds &amp; Cancellations</Link>
            <Link href="/support" className="hover:text-slate-900 transition-colors">Support</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Workspace Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
