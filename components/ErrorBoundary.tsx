'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../lib/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    logError(error, { 
      componentStack: errorInfo.componentStack,
      severity: 'Critical' 
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <h2 className="text-2xl font-bold text-slate-950 mb-4">Something went wrong.</h2>
            <p className="text-slate-600 mb-6">
              We apologize for the inconvenience. The issue has been automatically reported to our technical team. 
              Please try again in a few moments.
            </p>
            <p className="text-slate-500 text-sm">
              If the problem continues, contact support.
            </p>
            <button 
                onClick={() => window.location.reload()}
                className="mt-6 bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition"
            >
                Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
