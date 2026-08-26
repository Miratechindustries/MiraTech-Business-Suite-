"use client";

import { motion } from "motion/react";
import { useUserStore } from "../lib/store";
import { 
  Users, 
  Coins, 
  BadgeDollarSign, 
  Box, 
  BarChart3, 
  ShieldCheck, 
  FolderKanban, 
  HeartHandshake, 
  ShoppingCart, 
  Layers, 
  Settings,
  ArrowRight,
  Sparkles,
  Building2,
  TrendingUp,
  Lock
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../lib/subscriptions";
import { checkCompanyPlanAccess } from "../lib/planAccess";

interface DepartmentConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  tabId: string;
  subtitle: string;
}

const DEPARTMENTS: DepartmentConfig[] = [
  { id: "sales", name: "Sales & CRM", description: "Administer client relationships, invoices, and quotation pipelines.", subtitle: "Invoices & Quotation Funnel", icon: BadgeDollarSign, color: "#3B82F6", tabId: "sales" },
  { id: "finance", name: "Finance & Accounting", description: "Track ledger cashflows, balances, receipts, and outflows.", subtitle: "Settle Ledgers & Inflows", icon: Coins, color: "#4F46E5", tabId: "finance" },
  { id: "hr", name: "HR & Payroll", description: "Manage company employees, compensation structures, and payslips.", subtitle: "Active Staff & Pay Logs", icon: Users, color: "#10B981", tabId: "hr" },
  { id: "inventory", name: "Inventory Stock", description: "Review and organize physical corporate products, catalogs, and SKU reserves.", subtitle: "Stock Levels & SKU Registry", icon: Box, color: "#F59E0B", tabId: "inventory" },
  { id: "projects", name: "Projects & Tasks", description: "Track active milestones, task distributions, and sprint roadmaps.", subtitle: "Sprint Milestones & Task Boards", icon: FolderKanban, color: "#06B6D4", tabId: "projects" },
  { id: "reports", name: "Reports & Analytics", description: "Consolidated system performance, graphs, and performance sheets.", subtitle: "Analytics Trends & Sheets", icon: BarChart3, color: "#8B5CF6", tabId: "reports" },
  { id: "support", name: "Customer Support", description: "Process customer ticketing queues and review user grades.", subtitle: "Ticketing & Customer Sat", icon: HeartHandshake, color: "#EC4899", tabId: "support" },
  { id: "procurement", name: "Procurement", description: "Control partner suppliers and manage bulk purchase orders.", subtitle: "Suppliers & Supplier Orders", icon: ShoppingCart, color: "#0EA5E9", tabId: "procurement" },
  { id: "pos", name: "POS System", description: "Manage walk-in sales and cash drawer operations.", subtitle: "Cash Sales & Drawer Logs", icon: ShoppingCart, color: "#10B981", tabId: "pos" },
  { id: "marketing", name: "Marketing Hub", description: "Create, target, and monitor campaign workflows and pipelines.", subtitle: "Campaign Pipelines & Funnels", icon: TrendingUp, color: "#EC4899", tabId: "marketing" },
  { id: "audit", name: "Security Audit Logs", description: "Log immutable ledger actions and compliance operations.", subtitle: "SecOps Compliance & Trails", icon: ShieldCheck, color: "#64748B", tabId: "audit" },
  { id: "executive", name: "Executive Lounge", description: "Review consolidated business KPIs and high-level strategic feed.", subtitle: "C-Suite PDF & Sync Panels", icon: Layers, color: "#F43F5E", tabId: "executive" },
];

interface DepartmentsHubProps {
  company: any;
  onSelectTab: (tabId: string) => void;
}

export default function DepartmentsHub({ company, onSelectTab }: DepartmentsHubProps) {
  const { currentUser } = useUserStore();

  const enabledModules = company?.enabledModules || company?.modules || [
    "sales", "finance", "hr", "inventory", "projects", "reports", "support", "procurement", "pos", "marketing", "audit", "executive"
  ];

  const visibleDeps = DEPARTMENTS.filter(dep => enabledModules.includes(dep.id));

  // Determine user-specific default department greeting
  const getUserGreeting = () => {
    if (currentUser?.role === "MASTER_ADMIN") {
      return "Master Administrator Portal";
    } else if (currentUser?.role === "BUSINESS_ADMIN") {
      return "Business Owner Command Panel";
    } else {
      return "Corporate Workspace Clerk";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Dynamic Header Card */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-3xs"
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-150">
              <Building2 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-55 border border-slate-200 px-2.5 py-0.5 rounded-full">
              {getUserGreeting()}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Welcome back, {currentUser?.email?.split('@')[0]}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Manage your daily tasks and access corporate divisions. Select an active department workspace node below.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center shrink-0">
          <div className="bg-slate-50 border border-slate-200 p-2.5 px-3.5 rounded-xl text-center shadow-3xs">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Active Portals</span>
            <span className="font-mono text-xl font-extrabold text-blue-600 tracking-tight">{visibleDeps.length} Nodes</span>
          </div>
        </div>
      </motion.div>

      {/* Grid Portals Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
          Operational Corporate Departments
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDeps.map((dep, index) => {
            const IconComponent = dep.icon;
            const planCheck = checkCompanyPlanAccess(company, dep.id);
            const isLocked = !planCheck.allowed && currentUser?.role !== "MASTER_ADMIN";

            return (
              <motion.div
                key={dep.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.4 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => onSelectTab(dep.tabId)}
                className={`bg-white border p-5 rounded-2xl flex flex-col justify-between min-h-[175px] shadow-3xs transition group cursor-pointer ${
                  isLocked 
                    ? "border-slate-200 hover:border-indigo-300 hover:shadow-md" 
                    : "border-slate-200 hover:shadow-md hover:border-slate-300"
                }`}
              >
                {/* Upper section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span 
                      className="p-2 rounded-xl text-white flex items-center justify-center shadow-3xs"
                      style={{ backgroundColor: dep.color }}
                    >
                      <IconComponent className="w-4 h-4" />
                    </span>
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-md">
                        <Lock className="w-2.5 h-2.5" /> {planCheck.requiredPlanName}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                        {dep.subtitle}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-slate-905 tracking-tight group-hover:text-blue-600 transition flex items-center gap-1.5">
                      {dep.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed line-clamp-2">
                      {dep.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Trigger action */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100/50 mt-4 text-[10px] font-extrabold text-blue-600 group-hover:translate-x-0.5 transition duration-150">
                  <span className="uppercase tracking-wider">
                    {isLocked ? `Unlock with ${planCheck.requiredPlanName}` : "Access Corporate Node"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: dep.color }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
