'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, ShieldAlert, Headphones } from 'lucide-react';
import { logError } from '../lib/firebase';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MiraTech ErrorBoundary Caught]', error, errorInfo);

    // Automatically log runtime & gateway faults to Firestore error_logs for Master Admin Dashboard
    try {
      const errMessage = error?.message || String(error);
      const isGatewayOr500 =
        errMessage.includes('500') ||
        errMessage.includes('Billing') ||
        errMessage.includes('Paddle') ||
        errMessage.includes('Gateway') ||
        errMessage.includes('HTTP');

      logError(error, {
        source: isGatewayOr500 ? 'BillingGateway / HTTP 500' : 'ErrorBoundary',
        severity: isGatewayOr500 ? 'Critical' : 'High',
        componentStack: errorInfo?.componentStack || null,
        url: typeof window !== 'undefined' ? window.location.href : '',
      }).catch(() => {});
    } catch (e) {
      console.warn('[ErrorBoundary Logging Note]:', e);
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleContactSupport = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/support';
    }
  };

  render() {
    if (this.state.hasError) {
      const errorStr = this.state.error?.toString() || '';
      const is500OrBilling =
        errorStr.includes('500') ||
        errorStr.includes('Billing') ||
        errorStr.includes('Paddle') ||
        errorStr.includes('Gateway') ||
        errorStr.includes('HTTP');

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500"></div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                  {is500OrBilling ? 'Billing & Gateway Fault Isolation' : 'System Exception Fault'}
                </span>
                <h1 className="text-base font-extrabold text-white mt-1">
                  {this.props.fallbackTitle || 'MiraTech Workspace Module Recovery'}
                </h1>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                {is500OrBilling
                  ? 'A billing gateway or server HTTP 500 error was intercepted. This fault has been logged automatically to the Master Admin Dashboard error logs.'
                  : 'An unexpected runtime exception occurred in this workspace module. MiraTech APM has isolated the fault to preserve workspace state.'}
              </p>
              {this.state.error && (
                <div className="text-[11px] font-mono text-red-300 bg-red-950/40 p-2.5 rounded-lg border border-red-900/50 overflow-x-auto leading-relaxed">
                  {this.state.error.toString()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleContactSupport}
                className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20 cursor-pointer"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Contact Support</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
              <span>Logged to Master Admin Dashboard Logs</span>
              <a href="/support" className="text-amber-400 hover:underline flex items-center gap-1 font-bold">
                <span>Support Desk &rarr;</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
