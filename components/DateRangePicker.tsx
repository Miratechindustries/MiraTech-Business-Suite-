"use client";

import React from "react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded-lg border border-slate-200">
      <label className="text-xs font-bold text-slate-500 uppercase">From:</label>
      <input
        type="date"
        className="px-2 py-1 border border-slate-300 rounded text-xs"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
      />
      <label className="text-xs font-bold text-slate-500 uppercase">To:</label>
      <input
        type="date"
        className="px-2 py-1 border border-slate-300 rounded text-xs"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
      />
    </div>
  );
}
