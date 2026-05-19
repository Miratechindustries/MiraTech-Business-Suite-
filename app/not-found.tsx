import Link from 'next/link'
import { FileQuestion, MoveLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-50 dark:bg-blue-900/10">
          <FileQuestion className="h-12 w-12 text-blue-500" />
        </div>
        
        <h1 className="mt-8 text-4xl font-black text-slate-900 dark:text-white">404</h1>
        <h2 className="mt-2 text-xl font-bold text-slate-700 dark:text-slate-300">Page not found</h2>
        <p className="mt-4 text-slate-500 dark:text-slate-400">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
        </p>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 active:scale-95"
          >
            <MoveLeft className="h-4 w-4" />
            Back to Safety
          </Link>
        </div>
      </div>
    </div>
  )
}
