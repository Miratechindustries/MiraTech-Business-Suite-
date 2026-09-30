'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import PromoVideoTrailer from '../components/public/PromoVideoTrailer';
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
  Globe,
  CheckSquare,
  PlayCircle
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../lib/subscriptions';
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
      title: "Executive Intelligence & Ledger",
      desc: "Real-time P&L insights, gross billing summaries, dual-entry cash flows, and exportable CSV/PDF financial reports."
    },
    {
      icon: Users,
      title: "HR, Personnel Roster & Payroll",
      desc: "Maintain employee directories, track scheduled absences and annual leave, compute tax deductions, and disburse digital payslips."
    },
    {
      icon: FolderKanban,
      title: "Project Workspaces & Sprints",
      desc: "Register client engagements, track milestone timelines, allocate budgets, and disburse funds with granular governance."
    },
    {
      icon: Receipt,
      title: "Corporate Quotations & Invoicing",
      desc: "Draft professional price quotes with letterhead branding, tax calculations, and instant conversion into active tax invoices."
    },
    {
      icon: ShoppingCart,
      title: "POS System & Inventory",
      desc: "Manage walk-in cash sales, barcode scanning, FIFO stock valuation, and automated low-stock threshold alerts."
    },
    {
      icon: ShieldCheck,
      title: "SecOps Audit Trails & RBAC",
      desc: "Cryptographically tamper-proof audit logs tracking every admin action, employee enrollment, and IP whitelist subnet."
    }
  ];

  const faqs = [
    {
      q: "What is MiraTech Business Suite?",
      a: "MiraTech Business Suite is a cloud-based enterprise resource planning (ERP) SaaS platform combining CRM, double-entry accounting, automated payroll, multi-warehouse inventory, and project execution under a unified workspace."
    },
    {
      q: "How does the 14-day free trial work?",
      a: "Every newly provisioned corporate workspace receives full access to their chosen tier for 14 days without charge. You can invite your team and test all financial workflows with zero upfront obligation. Contact miratechindustries@gmail.com for onboarding assistance."
    },
    {
      q: "Who is the Merchant of Record for payments?",
      a: "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders, handling global payments, VAT/tax calculation, and PCI-DSS compliance."
    },
    {
      q: "Can I cancel my subscription at any time?",
      a: "Yes. You can cancel anytime directly from your workspace settings or via the Paddle Customer Portal with zero cancellation fees."
    },
    {
      q: "How can I contact technical support?",
      a: "For all support inquiries, billing questions, or custom integrations, please email our support desk at miratechindustries@gmail.com."
    },
    {
      q: "How is my company data secured?",
      a: "All corporate tenant data is cryptographically isolated with logical tenant boundaries. Data at rest is encrypted using AES-256 GCM hardware encryption and TLS 1.3 in transit."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      {isAuthenticated && (
        <div className="bg-blue-50 border-b border-blue-200 py-2.5 px-4 text-center text-xs font-semibold text-blue-800 flex items-center justify-center gap-2">
          <span>You have an active session in MiraTech Business Suite.</span>
          <Link href="/dashboard" className="underline font-bold text-blue-900 hover:text-blue-700 ml-1">
            Open Dashboard Workspace &rarr;
          </Link>
        </div>
      )}

      <main className="flex-1 space-y-24 py-12 px-4 sm:px-6 lg:px-8">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto pt-6 pb-12 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-blue-700 text-xs font-bold shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Institutional Cloud ERP &amp; Business Management Suite</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-4xl mx-auto space-y-4"
          >
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-tight">
              The Unified Operating System for Enterprise Workspaces
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
              Streamline Sales CRM, Double-Entry Accounting, Invoicing, Payroll, Multi-Warehouse Inventory, and Project Operations in one secure cloud platform.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </Link>
            <Link
              href="/promo"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <PlayCircle className="w-4 h-4 text-blue-400" />
              <span>Watch 4K Commercial (60s)</span>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Sign In</span>
            </Link>
          </motion.div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 pt-2 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>14-Day Free Evaluation</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Paddle Merchant of Record</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>AES-256 GCM Cloud Security</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Cancel Anytime Self-Service</span>
            </span>
          </div>

          {/* UI Showcase Mockup (Professional Solid Theme, No Gradients) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="pt-8 max-w-5xl mx-auto"
          >
            <div className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden text-left">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="ml-2 text-[11px] font-mono text-slate-600">
                    miratechindustries@gmail.com • Corporate Executive Suite
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Secure Tenant
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6 bg-slate-50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Gross Billings</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">R3,255.00</p>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Active Quotations</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Invoiced Receivables</span>
                    <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">R4,611.00</p>
                    <span className="text-[10px] text-slate-500 font-medium mt-1 block">Across Issued Invoices</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Active Roster Size</span>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">2 Personnel</p>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Payroll Operational</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">SecOps Status</span>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">Protected</p>
                    <span className="text-[10px] text-slate-500 font-medium mt-1 block">AES-256 GCM Guard</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Quotations &amp; Estimates</span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-100">PDF Ready</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>QT-FINANCE-1001</span>
                        <span className="font-bold text-slate-900">R358.00</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>Client: Mira Mazibuko</span>
                        <span className="text-emerald-600 font-bold">Approved</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Support Email</span>
                        <span className="text-blue-600 font-mono text-[10px]">miratechindustries@gmail.com</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">HR Absences &amp; Leave</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-100">Active Roster</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>Vuyo Neville (Director)</span>
                        <span className="text-emerald-600 font-bold">Active Operational</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>Annual Leave Logged</span>
                        <span className="text-blue-600 font-medium">4 Days Approved</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Contract Type</span>
                        <span className="text-slate-900 font-medium">Full-time Permanent</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">SecOps &amp; Audit Logs</span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold border border-indigo-100">Cryptographic</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>Audit Group: Admin</span>
                        <span className="font-mono text-[10px]">Verified Valid</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span>Host IP: 41.211.35.10</span>
                        <span className="text-emerald-600 font-bold">Secure</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Tenant Signature</span>
                        <span className="text-slate-500 font-mono text-[10px]">Immutable</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* 4K COMMERCIAL PROMO TRAILER SECTION */}
        <section id="trailer" className="max-w-7xl mx-auto space-y-6">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Official 60-Second Commercial Video
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              See MiraTech Operating at Enterprise Speed
            </h2>
            <p className="text-sm text-slate-600">
              Watch our product trailer featuring AI voiceover narration, 4K visual transitions, and interactive production script controls.
            </p>
          </div>

          <PromoVideoTrailer />
        </section>

        {/* SERVICES & MODULE PREVIEW SECTION */}
        <section className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Modular Business Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Professional Enterprise Services &amp; Modules
            </h2>
            <p className="text-sm text-slate-600">
              Engineered with clean, professional solid styling (zero gradients) and comprehensive department controls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modules.map((m, idx) => {
              const IconComp = m.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="bg-white border border-slate-200 hover:border-blue-400 p-6 rounded-2xl space-y-3 shadow-xs transition-all"
                >
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 w-fit">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{m.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {m.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* PADDLE MERCHANT OF RECORD BANNER (Solid Theme, No Gradients) */}
        <section className="max-w-7xl mx-auto">
          <div className="bg-blue-900 text-white rounded-3xl p-8 sm:p-12 shadow-lg space-y-6 border border-blue-800">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-800 text-blue-100 text-xs font-bold border border-blue-700">
                  <CreditCard className="w-4 h-4 text-blue-200" />
                  <span>Authorized Merchant of Record</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Global Billing Handled Exclusively by Paddle.com
                </h3>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-normal">
                  Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders. Paddle handles global payments, automated sales tax calculation (VAT, GST, Sales Tax), Level 1 PCI-DSS encryption, and customer inquiries at miratechindustries@gmail.com.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-white hover:bg-slate-100 text-blue-900 font-bold text-xs rounded-xl shadow-sm transition text-center"
                >
                  View Subscription Plans
                </Link>
                <Link
                  href="/refund"
                  className="px-6 py-3 bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl border border-blue-700 transition text-center"
                >
                  Refund &amp; Cancellation Policy
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-blue-800 text-xs text-blue-100">
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

        {/* PRICING PLANS */}
        <section className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Simple &amp; Scalable Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Five Tiered Plans Engineered for Every Organization
            </h2>
            <p className="text-sm text-slate-600">
              Start with a 14-day evaluation trial. Upgrade or cancel anytime with zero lock-in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isPopular = plan.id === 'professional';
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                    isPopular
                      ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md relative'
                      : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                      Most Popular
                    </span>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-base text-slate-900">{plan.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 min-h-[36px]">
                        {plan.description}
                      </p>
                    </div>
                    <div>
                      <span className="text-3xl font-black text-slate-900">R{plan.price}</span>
                      <span className="text-xs text-slate-500">/mo</span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-3">
                      <p><strong>Admins:</strong> {plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}</p>
                      <p><strong>Staff Seats:</strong> {plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}</p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100">
                    <Link
                      href={`/register?plan=${plan.id}`}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-center transition ${
                        isPopular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
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
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-slate-600">
              Clear answers regarding MiraTech Business Suite, trial terms, and Paddle billing. Contact miratechindustries@gmail.com for inquiries.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-colors shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-bold text-sm text-slate-900">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* FINAL CTA BANNER (Solid Theme, No Gradients) */}
        <section className="max-w-7xl mx-auto">
          <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Empower your enterprise with MiraTech Business Suite
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-xl">
                Provision your secure workspace today with our 14-day free trial. Contact miratechindustries@gmail.com for assistance.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition text-center whitespace-nowrap active:scale-95"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/support"
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition text-center whitespace-nowrap"
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
