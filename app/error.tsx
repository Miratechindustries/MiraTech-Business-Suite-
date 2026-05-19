'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'
import { handleAppError } from '@/lib/error-handler'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    handleAppError(error, 'Application Error')
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
          <AlertCircle className="h-10 w-10 text-rose-500" />
        </div>
        
        <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">Something went wrong</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          An unexpected error occurred in the application. We&apos;ve been notified and are looking into it.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => reset()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
