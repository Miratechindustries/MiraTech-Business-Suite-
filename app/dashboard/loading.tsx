import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-64 rounded-lg bg-slate-100 dark:bg-slate-900" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[400px] rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-[400px] rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
      
      <div className="h-64 rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
