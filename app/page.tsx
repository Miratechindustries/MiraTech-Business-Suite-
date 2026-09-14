'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import { 
  Building2, 
  TrendingUp, 
  Receipt, 
  Users, 
  Box, 
  FolderKanban, 
  ShoppingCart, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Lock, 
  CreditCard, 
  Clock, 
  Layers, 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  Cpu,
  Globe
} from 'lucide-react';
import { SUBSCRIPTION_PLANS, getPlanPrice } from '../lib/subscriptions';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsub();
  }, []);

  const modules = [
    {
      icon: TrendingUp,
      title: "Sales & Client CRM",
      desc: "Manage customer profiles, lead attribution, interactive quotations, and deal pipelines that convert directly into revenue invoices."
    },
    {
      icon: Receipt,
      title: "Finance & Double-Entry Ledger",
      desc: "Balanced debit-and-credit journal entries, multi-currency accounts, automated VAT tax calculation, and downloadable payment receipts."
    },
    {
      icon: Users,
      title: "Automated HR & Payroll",
      desc: "Maintain employee directories, track departmental assignments, compute statutory tax deductions, and disburse digital payslips."
    },
    {
      icon: Box,
      title: "Multi-Warehouse Inventory",
      desc: "Real-time stock valuation using FIFO, automated low-stock warnings, multi-location transfers, and automated invoice SKU deductions."
    },
    {
      icon: FolderKanban,
      title: "Project Workspaces & Tasks",
      desc: "Coordinate client deliverables with Kanban sprint boards, task assignments, milestone tracking, and project budgeting."
    },
    {
      icon: ShoppingCart,
      title: "Procurement & 3-Way Match",
      desc: "Eliminate corporate spend fraud by matching Purchase Orders against Receiving Goods Notes and Vendor Accounts Payable Invoices."
    },
    {
      icon: Layers,
      title: "Operations & Department Routing",
      desc: "Dynamic workspace permissions with custom roles (Super Admin, Manager, Accountant, Staff) and automated task escalation."
    },
    {
      icon: BarChart3,
      title: "Executive BI & Analytics",
      desc: "Live Profit & Loss (P&L) statements, cash flow velocity forecasts, and AI-assisted financial health digests powered by Gemini."
    },
    {
      icon: ShieldCheck,
      title: "Zero-Trust Security & Auditing",
      desc: "Rigorous tenant partition isolation, hardware-backed AES-256 GCM encryption at rest, TLS 1.3 in transit, and immutable SecOps audit trails."
    }
  ];

  const faqs = [
    {
      q: "What is MiraTech Business Suite?",
      a: "MiraTech Business Suite is a cloud-based enterprise resource planning (ERP) and business management SaaS platform. It combines CRM, double-entry accounting, VAT invoicing, automated payroll, multi-warehouse inventory, and project execution under a unified, high-security cloud architecture."
    },
    {
      q: "How does the 14-day free trial work?",
      a: "Every newly provisioned corporate workspace receives full access to their chosen tier for 14 days without charge. You can invite your team, test all financial workflows, and evaluate features with zero upfront obligation. You can cancel at any time during the trial."
    },
    {
      q: "Who is the Merchant of Record for payments?",
      a: "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle handles payments, sales tax calculation (VAT, GST, Sales Tax), PCI-DSS Level 1 compliance, and customer order inquiries."
    },
    {
      q: "Can I cancel my subscription at any time?",
      a: "Yes. You can cancel your subscription anytime with one click directly from within your workspace (under Settings > Subscriptions) or through the Paddle Customer Portal. There are no cancellation fees, and your account remains active until the end of your paid billing period."
    },
    {
      q: "What is your refund policy?",
      a: "We offer a 14-day money-back guarantee on all annual subscription plans upon written request to our finance desk. For complete details, review our published Refund & Cancellation Policy."
    },
    {
      q: "How is my company data secured?",
      a: "All corporate tenant data is cryptographically isolated with logical tenant boundaries. Data at rest is encrypted using AES-256 GCM hardware encryption, data in transit enforces TLS 1.3, and all administrative actions are recorded in immutable audit logs."
    }
  ];

  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      {/* Authenticated user quick banner */}
      {isAuthenticated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs font-semibold text-amber-300 flex items-center justify-center gap-2">
          <span>You have an active session in MiraTech Business Suite.</span>
          <Link href="/dashboard" className="underline font-bold text-white hover:text-amber-200">
            Open Dashboard Workspace &rarr;
          </Link>
        </div>
      )}

      <main className="flex-1 space-y-24 py-12 px-4 sm:px-6 lg:px-8">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto pt-6 pb-12 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0B132B] border border-amber-500/30 text-amber-400 text-xs font-bold shadow-md animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Cloud-Based Enterprise Management & Modular ERP SaaS</span>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              The Unified Operating System for Growing Enterprises
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Streamline Sales & CRM, Dual-Entry Accounting, Invoicing, Automated Payroll, Multi-Warehouse Inventory, and Project Operations in one secure cloud platform.
            </p>
          </div>

          {/* Hero Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-[#0B132B] hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <span>Sign In to Workspace</span>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-2 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>14-Day Free Evaluation</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Paddle Merchant of Record</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>AES-256 GCM Cloud Security</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Cancel Anytime Self-Service</span>
            </span>
          </div>

          {/* Interactive UI Mockup Showcase */}
          <div className="pt-8 max-w-5xl mx-auto">
            <div className="relative rounded-2xl p-1 bg-gradient-to-b from-amber-500/30 via-slate-800 to-slate-900 shadow-2xl shadow-black/80">
              <div className="bg-[#0B132B] rounded-xl overflow-hidden border border-slate-800 text-left">
                {/* Window Chrome Header */}
                <div className="bg-[#080E21] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                    <span className="ml-2 text-[11px] font-mono text-slate-400">
                      miratechsuite.com/dashboard • Enterprise Master Tenant
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Live Cloud Sync
                    </span>
                  </div>
                </div>

                {/* Mockup Dashboard Content */}
                <div className="p-6 space-y-6">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gross Monthly Revenue</span>
                      <p className="text-xl sm:text-2xl font-black text-white mt-1">$148,250.00</p>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                        &uarr; +18.4% vs last month
                      </span>
                    </div>

                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pending Tax Invoices</span>
                      <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">24 Active</p>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        $42,800.00 in A/R
                      </span>
                    </div>

                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Inventory Health</span>
                      <p className="text-xl sm:text-2xl font-black text-white mt-1">1,842 SKUs</p>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                        99.2% in stock
                      </span>
                    </div>

                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payroll Run Velocity</span>
                      <p className="text-xl sm:text-2xl font-black text-white mt-1">48 Employees</p>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                        Disbursed & Balanced
                      </span>
                    </div>
                  </div>

                  {/* Operational Modules Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Recent Transactions</span>
                        <span className="text-[10px] text-amber-400">Double-Entry</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-300">Client Apex Global (Inv #1042)</span>
                          <span className="text-emerald-400 font-bold">+$12,400.00</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-300">Logistics Supplier PO #809</span>
                          <span className="text-rose-400 font-bold">-$3,850.00</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-300">Warehouse Bulk Stock FIFO</span>
                          <span className="text-slate-400">Balanced</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Procurement 3-Way Match</span>
                        <span className="text-[10px] text-emerald-400">Verified</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-300">PO #892 &bull; Delta Hardware</span>
                          <span className="text-emerald-400 font-mono text-[11px]">Match: 100%</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80">
                          <span className="text-slate-300">PO #893 &bull; Cloud Hosting</span>
                          <span className="text-emerald-400 font-mono text-[11px]">Match: 100%</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-300">PO #894 &bull; Raw Materials</span>
                          <span className="text-amber-400 font-mono text-[11px]">Pending GRN</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#111A38] border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">SecOps Audit Log</span>
                        <span className="text-[10px] text-blue-400">Cryptographic</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-800/80 text-[11px]">
                          <span className="text-slate-300">Tax Invoice #1042 Signed</span>
                          <span className="text-slate-500 font-mono">14:02:18 UTC</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/80 text-[11px]">
                          <span className="text-slate-300">Payroll Run Executed</span>
                          <span className="text-slate-500 font-mono">11:30:05 UTC</span>
                        </div>
                        <div className="flex justify-between py-1 text-[11px]">
                          <span className="text-slate-300">KMS Key Rotation</span>
                          <span className="text-emerald-400 font-mono">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ENTERPRISE MODULES GRID */}
        <section className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Modular Business Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Every Department Under One Single Unified Pane
            </h2>
            <p className="text-sm text-slate-400">
              MiraTech Business Suite integrates every core operational department into a cohesive, collaborative workspace with zero data fragmentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modules.map((m, idx) => {
              const IconComp = m.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#0B132B] border border-slate-800 hover:border-slate-700 p-6 rounded-2xl space-y-3 transition-all shadow-lg"
                >
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 w-fit">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">{m.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
            >
              <span>Explore all enterprise features and architectural capabilities &rarr;</span>
            </Link>
          </div>
        </section>

        {/* PADDLE MERCHANT OF RECORD BANNER */}
        <section className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-[#0B132B] via-[#0E1736] to-[#0B132B] border border-amber-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                  <CreditCard className="w-4 h-4" />
                  <span>Authorized Merchant of Record</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Global Billing Handled Exclusively by Paddle.com
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders. Paddle handles global payments, automated sales tax calculation (VAT, GST, Sales Tax), Level 1 PCI-DSS encryption, and customer order inquiries.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition text-center"
                >
                  View Subscription Plans
                </Link>
                <Link
                  href="/refund"
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition text-center"
                >
                  Refund & Cancellation Policy
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automatic 14-day money-back guarantee for annual plans</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Self-service cancellation anytime via Settings</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Official VAT/tax compliant invoices sent automatically</span>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING OVERVIEW PREVIEW */}
        <section className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Simple & Scalable Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Five Tiered Plans Engineered for Every Organization
            </h2>
            <p className="text-sm text-slate-400">
              Start with a 14-day evaluation trial. Upgrade or cancel anytime with zero lock-in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isPopular = plan.id === 'professional';
              return (
                <div
                  key={plan.id}
                  className={`bg-[#0B132B] rounded-2xl p-6 flex flex-col justify-between border ${
                    isPopular
                      ? 'border-amber-500 ring-1 ring-amber-500/30 shadow-xl'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-base text-white">{plan.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 min-h-[36px]">
                        {plan.description}
                      </p>
                    </div>
                    <div>
                      <span className="text-3xl font-black text-white">${plan.price}</span>
                      <span className="text-xs text-slate-400">/mo</span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1 border-t border-slate-800/80 pt-3">
                      <p><strong>Admins:</strong> {plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}</p>
                      <p><strong>Staff Seats:</strong> {plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}</p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-800">
                    <Link
                      href={`/register?plan=${plan.id}`}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-center ${
                        isPopular
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <span>Start Trial</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/pricing"
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              Compare full plan features and annual discounts &rarr;
            </Link>
          </div>
        </section>

        {/* SECURITY & TRUST SECTION */}
        <section className="max-w-7xl mx-auto">
          <div className="bg-[#0B132B] border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-8 shadow-xl">
            <div className="max-w-2xl space-y-2">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                Institutional Trust & Compliance
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                Engineered with Zero-Trust Security at the Core
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Your business financial records and employee data are protected with enterprise-tier defenses.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white text-sm">AES-256 GCM</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cryptographic encryption at rest with automated hardware key rotation via Google Cloud KMS.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white text-sm">Multi-Tenant Isolation</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Strict logical database boundaries preventing any cross-company visibility or data leakage.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-white text-sm">TLS 1.3 In Transit</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All browser and API transactions enforce strict TLS 1.3 with Perfect Forward Secrecy.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h4 className="font-bold text-white text-sm">99.95% Availability SLA</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  High-availability multi-region clusters with automated daily transactional rollbacks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-slate-400">
              Clear answers regarding MiraTech Business Suite, trial terms, and Paddle billing.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40"
                  >
                    <span className="font-bold text-sm text-white">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 rounded-3xl p-8 sm:p-12 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                Empower your enterprise with MiraTech Business Suite
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 max-w-xl">
                Provision your secure workspace today with our 14-day free trial. Backed by Paddle Merchant of Record compliance.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="px-8 py-3.5 bg-[#0B132B] hover:bg-[#111A38] text-white font-bold text-xs rounded-xl shadow-xl transition text-center whitespace-nowrap"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/support"
                className="px-6 py-3.5 bg-slate-900/20 hover:bg-slate-900/30 text-slate-950 font-bold text-xs rounded-xl border border-slate-950/20 transition text-center whitespace-nowrap"
              >
                Contact Support Desk
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
