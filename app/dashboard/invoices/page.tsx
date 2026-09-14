"use client";

import dynamic from "next/dynamic";

const DashboardLayout = dynamic(() => import("../../../components/DashboardLayout"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  ),
});

export default function InvoicesPage() {
  return <DashboardLayout defaultTab="invoices" />;
}

