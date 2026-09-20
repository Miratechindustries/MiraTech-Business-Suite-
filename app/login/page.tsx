'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Mail, 
  Lock, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  HelpCircle
} from 'lucide-react';
import { auth, emailSignIn, googleSignIn, resetUserPassword } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      await emailSignIn(cleanEmail, cleanPassword);
      router.push('/dashboard');
    } catch (err: any) {
      const isInvalidCred = err?.code === 'auth/invalid-credential' || 
                            err?.code === 'auth/wrong-password' || 
                            err?.code === 'auth/user-not-found' ||
                            err?.message?.includes('Invalid email or password');
      
      if (isInvalidCred) {
        if (cleanEmail.toLowerCase().endsWith('@gmail.com')) {
          setError('Invalid email or password. If you registered via Google Workspace / Gmail, please click "Continue with Google" below or reset your password.');
        } else {
          setError('Invalid email or password. Please verify your credentials or use the password reset link below.');
        }
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
      }
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await googleSignIn();
      router.push('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was closed before completing. Please try again.');
      } else {
        setError(err.message || 'Google Sign-In failed.');
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your registered corporate email address to receive a password reset link.');
      return;
    }

    setResetLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await resetUserPassword(cleanEmail);
      setSuccessMsg(`A password reset link has been dispatched to ${cleanEmail}. Please check your inbox and follow the instructions.`);
      setIsResetMode(false);
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset email. Please verify the address.');
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 font-sans">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 relative">
          <div className="mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Landing Page</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200 mb-2">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isResetMode ? 'Reset Your Password' : 'Sign In to Workspace'}
            </h1>
            <p className="text-xs text-slate-600">
              {isResetMode 
                ? 'Enter your corporate email address to receive secure reset instructions.' 
                : 'Access your MiraTech Business Suite tenant, ledgers, and operational tools.'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                {error.includes('Invalid email or password') && (
                  <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError('');
                      }}
                      className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      Reset Password
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Sign In with Google
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-semibold">{successMsg}</p>
            </div>
          )}

          {/* Password Reset Form */}
          {isResetMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Corporate Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {resetLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setError('');
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          ) : (
            /* Standard Login Form */
            <form onSubmit={handleEmailLogin} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Corporate Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Sign In to Tenant</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {!isResetMode && (
            <>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[11px] text-slate-400 uppercase font-semibold">Or</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="text-center pt-2 text-xs text-slate-600">
                Don&apos;t have an active workspace?{' '}
                <Link 
                  href={email ? `/register?email=${encodeURIComponent(email)}` : '/register'} 
                  className="font-bold text-blue-600 hover:underline"
                >
                  Start 14-Day Trial
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
