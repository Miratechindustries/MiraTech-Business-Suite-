"use client";

import dynamic from "next/dynamic";
import { ErrorBoundary } from "../../components/ErrorBoundary";

const DashboardLayout = dynamic(() => import("../../components/DashboardLayout"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-amber-600 border-t-transparent"></div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading MiraTech Workspace...
        </p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return (
    <ErrorBoundary fallbackTitle="MiraTech Workspace Fault Guard">
      <DashboardLayout defaultTab="dashboard" />
    </ErrorBoundary>
  );
}

