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
  Cpu,
  Check
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise Software Capabilities</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Comprehensive ERP Features &amp; Modules
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              MiraTech Business Suite is a cloud-based business management SaaS platform for small and medium-sized businesses. It provides tools for CRM and sales, invoicing and finance, inventory, human resources, projects, procurement, marketing, operations, and business reporting through a single web application.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {modules.map((mod) => {
              const IconComp = mod.icon;
              return (
                <div 
                  key={mod.id}
                  id={mod.id}
                  className="bg-white border border-slate-200 rounded-2xl p-7 space-y-5 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {mod.badge}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-bold text-lg text-slate-900">{mod.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Key Capabilities:</span>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {mod.capabilities.map((cap, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <span>Get started with {mod.title} &rarr;</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center max-w-4xl mx-auto space-y-6 shadow-xs">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Ready to unify your business operations?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
              Provision your isolated corporate workspace with a 14-day free evaluation trial. Secure recurring billing handled by Paddle.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/pricing"
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition"
              >
                View Pricing &amp; Plans
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
