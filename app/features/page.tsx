'use client';

import React from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { 
  Building2, 
  BarChart3, 
  Receipt, 
  FileText, 
  Users, 
  Box, 
  FolderKanban, 
  ShoppingCart, 
  TrendingUp, 
  Layers, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  Database,
  Sparkles,
  Search,
  FileCheck2,
  Cpu
} from 'lucide-react';

export default function FeaturesPage() {
  const modules = [
    {
      id: "sales",
      title: "Sales, CRM & Quotation Pipelines",
      badge: "Commercial Operations",
      description: "Convert prospect inquiries into signed contracts with end-to-end quotation workflows, client directories, and deal tracking.",
      icon: TrendingUp,
      capabilities: [
        "Interactive quotation builder with auto-calculated taxes, line items, and discounts",
        "Comprehensive client CRM directory with credit tracking and contact rosters",
        "Direct conversion from approved quotations into tax invoices with a single click",
        "Automated customer notification dispatches and digital document histories"
      ]
    },
    {
      id: "finance",
      title: "Finance, Dual-Entry Accounting & Ledgering",
      badge: "Financial Control",
      description: "Institutional-grade financial integrity powered by double-entry bookkeeping, multi-currency ledgering, and real-time reconciliation.",
      icon: Receipt,
      capabilities: [
        "Double-entry journal records guaranteeing balanced debit and credit entries",
        "Multi-currency support (USD, EUR, GBP, ZAR) with automated exchange calculation",
        "Complete accounts receivable (A/R) and accounts payable (A/P) ledgers",
        "Integrated payment proof receipts with downloadable PDF certificates"
      ]
    },
    {
      id: "invoicing",
      title: "Tax Invoices & Billing Operations",
      badge: "Revenue Governance",
      description: "Create, dispatch, and track VAT-compliant commercial invoices with real-time status synchronization and overdue aging alerts.",
      icon: FileText,
      capabilities: [
        "Customizable corporate letterhead branding and logo placement",
        "Paddle Merchant of Record integration for automated tax/VAT compliance",
        "Real-time status tracking: Draft, Sent, Paid, Overdue, and Cancelled",
        "Print-ready A4 PDF invoice generation with embedded verification hashes"
      ]
    },
    {
      id: "payroll",
      title: "HR Governance & Automated Payroll",
      badge: "Workforce Management",
      description: "Maintain accurate staff rosters, department assignments, salary structures, and automated payroll distributions.",
      icon: Users,
      capabilities: [
        "Employee directory with designation, bank accounts, and national identity tracking",
        "Automated gross-to-net salary disbursements with statutory deductions",
        "Historical payroll logs and digital payslip generation",
        "Role-based access controls limiting compensation visibility to authorized HR managers"
      ]
    },
    {
      id: "inventory",
      title: "Multi-Warehouse Inventory & Stock Control",
      badge: "Supply Chain",
      description: "Full visibility over warehouse stock levels, item valuations, SKU movements, and automated replenishment triggers.",
      icon: Box,
      capabilities: [
        "Real-time stock valuation using FIFO and weighted average costing",
        "Automated low-stock warnings preventing unexpected backorders",
        "Multi-location warehouse bin tracking and transfer ledgers",
        "Seamless deduction when dispatching finalized customer invoices"
      ]
    },
    {
      id: "procurement",
      title: "Procurement & 3-Way Match Verification",
      badge: "Spend Control",
      description: "Mitigate corporate spend fraud by automating 3-way matching between Purchase Orders, Receiving Goods Notes, and Vendor Invoices.",
      icon: ShoppingCart,
      capabilities: [
        "Supplier catalogue management with vetted payment terms",
        "Purchase order requisition and multi-stage approval hierarchies",
        "Automated 3-way matching algorithm flagging price and quantity discrepancies",
        "Accounts payable reconciliation preventing duplicate supplier disbursements"
      ]
    },
    {
      id: "projects",
      title: "Project Workspaces & Sprint Execution",
      badge: "Delivery & Execution",
      description: "Orchestrate complex cross-functional client deliverables with task boards, milestone tracking, and resource allocation.",
      icon: FolderKanban,
      capabilities: [
        "Kanban sprint boards with drag-and-drop workflow status columns",
        "Project budgeting and labor hour attribution linked to customer billing",
        "Milestone achievement tracking with automated team notification relays",
        "Document attachment vaults for project deliverables and contracts"
      ]
    },
    {
      id: "reporting",
      title: "Executive Reporting & Business Intelligence",
      badge: "Executive Insights",
      description: "Real-time Profit & Loss (P&L), balance sheets, cash-flow run rates, and AI-assisted financial anomaly detection.",
      icon: BarChart3,
      capabilities: [
        "Automated P&L statements and revenue breakdown graphs by department",
        "Cash flow forecasts tracking historical collection velocity",
        "AI executive digests powered by Gemini generating actionable growth insights",
        "Instant one-click exports to CSV and spreadsheet formats"
      ]
    },
    {
      id: "security",
      title: "Zero-Trust Security & Audit Compliance",
      badge: "SecOps & Privacy",
      description: "Military-grade data protection engineered with tenant isolation boundaries, cryptographic audit logs, and 99.95% uptime guarantees.",
      icon: ShieldCheck,
      capabilities: [
        "Logical multi-tenant isolation enforcing zero cross-company data leakage",
        "AES-256 GCM hardware encryption at rest and TLS 1.3 encryption in transit",
        "Granular Role-Based Access Control (RBAC): Super Admin, Manager, Accountant, Staff",
        "Immutable SecOps audit logs timestamping all user actions and system changes"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Modular Enterprise Cloud Architecture</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              Every Workflow You Need to Run Your Enterprise
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              MiraTech Business Suite replaces fragmented point solutions with a unified, modular ERP platform. Built on Google Cloud with Paddle Merchant of Record billing.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/pricing"
                className="px-6 py-2.5 bg-[#0B132B] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs rounded-xl transition-all"
              >
                View Subscription Plans
              </Link>
            </div>
          </div>

          {/* Core Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {modules.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={mod.id}
                  id={mod.id}
                  className="bg-[#0B132B] border border-slate-800 rounded-2xl p-7 space-y-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full">
                        {mod.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg text-white">{mod.title}</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Key Capabilities:
                      </span>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {mod.capabilities.map((cap, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                    <Link
                      href="/pricing"
                      className="font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                    >
                      <span>Check Plan Inclusions</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Architecture & Infrastructure Section */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl space-y-8">
            <div className="max-w-2xl space-y-2">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                Enterprise Infrastructure
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Resilient Cloud Architecture Engineered for Enterprise Trust
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                MiraTech Business Suite is deployed on institutional-grade Google Cloud multi-region clusters with zero-trust security principles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white text-sm">Tenant Isolation</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every company workspace operates within a cryptographically isolated partition preventing cross-tenant leakage.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white text-sm">AES-256 & TLS 1.3</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hardware-backed AES-256 GCM encryption at rest with automated key rotation and mandatory TLS 1.3 in transit.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-white text-sm">Paddle MoR Billing</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Level 1 PCI-DSS certified payment processing with automated global VAT/Sales tax calculation and self-service portal.
                </p>
              </div>

              <div className="p-5 bg-[#111A38] border border-slate-800 rounded-xl space-y-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                <h4 className="font-bold text-white text-sm">99.95% Availability SLA</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Continuous hot-failover replication across redundant cloud zones with automated daily transactional rollbacks.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Strip */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 rounded-2xl p-8 sm:p-10 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl font-black tracking-tight">
                Ready to explore all modules live?
              </h3>
              <p className="text-xs font-semibold text-slate-900 max-w-xl">
                Start your 14-day free trial today. Explore CRM, Invoices, Payroll, Inventory, and Projects with zero upfront charges.
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3 bg-[#0B132B] hover:bg-[#111A38] text-white font-bold text-xs rounded-xl shadow-xl transition-all cursor-pointer whitespace-nowrap"
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
