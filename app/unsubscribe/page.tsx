'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sliders, 
  Mail, 
  ExternalLink,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);

  // If token is present, automatically process the unsubscribe
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const processUnsubscribe = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/email/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          setUnsubscribed(true);
        } else {
          setError(data.error || 'The unsubscribe link appears to be invalid or has expired.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError('A network error occurred while communicating with the unsubscribe service.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    processUnsubscribe();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail || !manualEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    setManualSubmitted(true);
    setError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 sm:py-24">
      <div 
        id="unsubscribe-card"
        className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm text-left"
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              MiraTech Business Suite
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Email Communication Governance &amp; Unsubscribe Center
            </p>
          </div>
        </div>

        {/* State 1: Loading Token */}
        {loading && (
          <div className="py-12 text-center space-y-4">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-slate-600">
              Processing your unsubscribe request securely...
            </p>
          </div>
        )}

        {/* State 2: Successfully Unsubscribed */}
        {!loading && unsubscribed && (
          <div className="py-8 space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-emerald-950">
                  You have been unsubscribed from MiraTech Business Suite marketing emails.
                </h2>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Your marketing preferences have been updated immediately across our notification infrastructure.
                </p>
              </div>
            </div>

            {/* Essential Transactional Notice */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Notice regarding essential account and billing messages</span>
              </div>
              <p className="leading-relaxed">
                You will continue to receive essential account, billing, security, and subscription-related messages (such as password verification, payment invoices, subscription renewal notices, and corporate workspace alerts) where required to maintain your active account or subscription.
              </p>
            </div>

            {/* Preference Center CTA */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Prefer to receive specific announcements only?
              </div>
              {token ? (
                <Link
                  id="btn-manage-preferences"
                  href={`/email-preferences?token=${encodeURIComponent(token)}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Customize Email Preferences</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  id="btn-manage-preferences-general"
                  href="/email-preferences"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Open Preference Center</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* State 3: Error or Invalid Token */}
        {!loading && error && (
          <div className="py-8 space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-amber-950">
                  Unsubscribe Request Requires Verification
                </h2>
                <p className="text-sm text-amber-800 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If your email client altered the link or you navigated here directly, you can sign in to your workspace or contact our customer support desk to adjust your communication settings directly.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                Sign In to Account
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
              >
                Customer Support Desk
              </Link>
            </div>
          </div>
        )}

        {/* State 4: Direct Page Access without Token */}
        {!loading && !token && !unsubscribed && !error && (
          <div className="py-8 space-y-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              To unsubscribe from marketing emails without logging in, please click the secure <strong>“Unsubscribe from marketing emails”</strong> link located in the footer of any email you received from MiraTech Business Suite.
            </p>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="text-xs font-semibold text-slate-900">
                Are you an active workspace customer?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                You can manage all your notification categories and corporate team alerts directly from the Email Preferences portal or by signing into your MiraTech dashboard.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href="/email-preferences"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Go to Email Preferences</span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-300 transition"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Footer Identity & Statutory Disclaimer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>MiraTech Industries &amp; Software Solutions Ltd.</span>
            <span>Support: <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a></span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <span>•</span>
            <Link href="/refund" className="hover:underline">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center">
        <Suspense fallback={
          <div className="py-24 text-center text-slate-500 text-sm">
            Loading unsubscribe preferences...
          </div>
        }>
          <UnsubscribeContent />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
