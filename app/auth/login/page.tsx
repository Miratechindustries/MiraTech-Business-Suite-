'use client'

import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, Chrome, Loader2 } from 'lucide-react';
import { handleAppError, notifySuccess } from '@/lib/error-handler';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        notifySuccess("Welcome back!", "Redirecting to your dashboard...");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        notifySuccess("Account created!", "Setting up your workspace...");
      }
      router.push('/dashboard');
    } catch (error) {
      handleAppError(error, isLogin ? "Sign In Failed" : "Sign Up Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setIsLoading(true);
    try {
      await signInWithPopup(auth, provider);
      notifySuccess("Signed in with Google", "Welcome!");
      router.push('/dashboard');
    } catch (error) {
      handleAppError(error, "Google Authentication Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20 italic text-2xl">
            M
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
            {isLogin ? 'Sign in to Mira' : 'Join Mira Suite'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {isLogin ? "Welcome back to your business hub" : "Start your business management journey"}
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleAuth}>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                placeholder="yours@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                {isLogin ? 'Sign In' : 'Sign Up'}
              </>
            )}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-4 text-slate-400 dark:bg-slate-900">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 active:scale-95"
        >
          <Chrome className="h-5 w-5 text-blue-500" />
          Google Account
        </button>

        <p className="text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-bold text-blue-600 hover:underline"
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
