'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, Loader2, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { auth, emailSignIn, googleSignIn } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If user is already authenticated, redirect straight to dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await emailSignIn(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Failed to sign in. Please verify your corporate credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await googleSignIn();
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google Workspace sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#070D1E] flex flex-col justify-between">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-4">
            Checking authenticated session...
          </p>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D1E] flex flex-col justify-between text-white font-sans">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-[#0B132B] border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 mb-2">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sign In to Workspace
            </h1>
            <p className="text-xs text-slate-400">
              Access your MiraTech Business Suite tenant, ledgers, and operational tools.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Sign In with Email</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-[#0B132B] px-3 text-slate-500">Or Continue With</span>
            </div>
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#111A38] hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google Workspace</span>
          </button>

          {/* New Company Registration CTA */}
          <div className="pt-4 border-t border-slate-800 text-center space-y-2 text-xs">
            <p className="text-slate-400">
              New to MiraTech Business Suite?
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>Provision Company Workspace (14-Day Free Trial)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted Corporate Session</span>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
