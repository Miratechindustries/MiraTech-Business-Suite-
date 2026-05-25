"use client";

export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
      <div className="h-10 bg-slate-100 rounded w-full"></div>
      <div className="h-10 bg-slate-100 rounded w-full"></div>
      <div className="h-10 bg-slate-100 rounded w-full"></div>
    </div>
  );
}
