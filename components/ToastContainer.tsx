"use client";

import React from "react";
import { useToastStore } from "../lib/store";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const getIcon = (type: "success" | "error" | "info" | "warning") => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "info":
        return <Info className="h-4 w-4 text-sky-600" />;
    }
  };

  const getStyles = (type: "success" | "error" | "info" | "warning") => {
    switch (type) {
      case "success":
        return "bg-emerald-50/95 border-emerald-200 text-emerald-950";
      case "error":
        return "bg-red-50/95 border-red-200 text-red-950";
      case "warning":
        return "bg-amber-50/95 border-amber-200 text-amber-955";
      case "info":
        return "bg-sky-50/95 border-sky-200 text-sky-955";
    }
  };

  const getHeader = (type: "success" | "error" | "info" | "warning") => {
    switch (type) {
      case "success":
        return "Success";
      case "error":
        return "System Warning / Error";
      case "warning":
        return "Attention Needed";
      case "info":
        return "System Status Notification";
    }
  };

  return (
    <div 
      id="toast-container" 
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none p-4 md:p-0"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            id={`toast-${toast.id}`}
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md ${getStyles(
              toast.type
            )}`}
          >
            <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">
                {getHeader(toast.type)}
              </span>
              <p className="text-xs font-semibold leading-relaxed font-sans">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5 rounded-md hover:bg-slate-200/40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
