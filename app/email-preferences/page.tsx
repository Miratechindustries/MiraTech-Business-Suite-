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
  Info,
  Save,
  Ban,
  Lock,
  ArrowLeft,
  Sparkles,
  BellRing
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function PreferencesForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string>('Protected Recipient');
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Preference Categories
  const [preferences, setPreferences] = useState({
    marketingEnabled: true,
    productUpdatesEnabled: true,
    newsletterEnabled: true,
    featureAnnouncementsEnabled: true,
    educationalContentEnabled: true,
    promotionalOffersEnabled: true,
  });

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Fetch initial preferences
  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      setLoading(true);
      setStatusMessage(null);

      try {
        let authHeader = '';
        if (auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken();
          authHeader = `Bearer ${idToken}`;
        }

        const url = new URL('/api/email/preferences', window.location.origin);
        if (token) {
          url.searchParams.set('token', token);
        }

        const res = await fetch(url.toString(), {
          headers: authHeader ? { Authorization: authHeader } : {},
        });

        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;

          if (data.preferences) {
            setPreferences({
              marketingEnabled: !!data.preferences.marketingEnabled,
              productUpdatesEnabled: !!data.preferences.productUpdatesEnabled,
              newsletterEnabled: !!data.preferences.newsletterEnabled,
              featureAnnouncementsEnabled: !!data.preferences.featureAnnouncementsEnabled,
              educationalContentEnabled: !!data.preferences.educationalContentEnabled,
              promotionalOffersEnabled: !!data.preferences.promotionalOffersEnabled,
            });
          }
          if (data.maskedEmail) {
            setMaskedEmail(data.maskedEmail);
          }
        } else {
          setStatusMessage({
            text: 'Unable to synchronize your remote preferences. Showing standard defaults.',
            type: 'info',
          });
        }
      } catch (err) {
        if (!isMounted) return;
        setStatusMessage({
          text: 'Network error communicating with the preference manager.',
          type: 'error',
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [token, currentUser]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          token,
          preferences,
          action: 'UPDATE_PREFERENCES',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          text: 'Your email communication preferences have been saved successfully.',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: data.error || 'Failed to save communication preferences.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: 'A network error occurred while updating your preferences.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    setSaving(true);
    setStatusMessage(null);

    try {
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          token,
          action: 'UNSUBSCRIBE_ALL',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPreferences({
          marketingEnabled: false,
          productUpdatesEnabled: false,
          newsletterEnabled: false,
          featureAnnouncementsEnabled: false,
          educationalContentEnabled: false,
          promotionalOffersEnabled: false,
        });
        setStatusMessage({
          text: 'You have been unsubscribed from all optional email communications. Essential transactional notices will remain active.',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: data.error || 'Failed to process unsubscribe request.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: 'A network error occurred while unsubscribing.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (key: keyof typeof preferences) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // If toggling on any marketing channel, marketingEnabled turns true
      if (key !== 'marketingEnabled' && next[key]) {
        next.marketingEnabled = true;
      }
      return next;
    });
  };

  const categoryOptions = [
    {
      id: 'marketingEnabled',
      key: 'marketingEnabled' as const,
      title: 'Marketing & Promotional Communications',
      description: 'Occasional promotional announcements, partner events, and software solution offers.',
    },
    {
      id: 'productUpdatesEnabled',
      key: 'productUpdatesEnabled' as const,
      title: 'Product Updates & Release Notes',
      description: 'Detailed changelogs, new ERP workflow additions, accounting updates, and platform enhancements.',
    },
    {
      id: 'featureAnnouncementsEnabled',
      key: 'featureAnnouncementsEnabled' as const,
      title: 'Major Feature Announcements',
      description: 'Advance previews of major architectural modules, integrations, and new system capabilities.',
    },
    {
      id: 'newsletterEnabled',
      key: 'newsletterEnabled' as const,
      title: 'Monthly Industry & Engineering Newsletter',
      description: 'Curated business intelligence, tax compliance insights, and SaaS scaling case studies.',
    },
    {
      id: 'educationalContentEnabled',
      key: 'educationalContentEnabled' as const,
      title: 'Platform Tips & Best Practices Guides',
      description: 'Actionable guidance on optimizing double-entry bookkeeping, payroll rules, and inventory control.',
    },
    {
      id: 'promotionalOffersEnabled',
      key: 'promotionalOffersEnabled' as const,
      title: 'Exclusive Corporate & Partner Offers',
      description: 'Discounts on additional user seats, custom ERP integrations, and enterprise deployment packages.',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <div 
        id="preference-center-container"
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Email Preference Center
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  MiraTech Business Suite Communication Governance
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>{maskedEmail}</span>
            </div>
          </div>
        </div>

        {/* Informational Toast / Status Message */}
        {statusMessage && (
          <div
            className={`mx-6 sm:mx-8 mt-6 p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : statusMessage.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Optional Communications
            </h2>
            <p className="text-xs text-slate-600">
              Customize which email communications you would like to receive. Changes take effect across our dispatch network immediately.
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500">Loading current preferences...</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {categoryOptions.map((cat) => {
                const checked = preferences[cat.key];
                return (
                  <label
                    key={cat.id}
                    id={`label-${cat.id}`}
                    className="flex items-start justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1 pr-2">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900">
                        {cat.title}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                        {cat.description}
                      </div>
                    </div>
                    <div className="relative inline-flex items-center shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        id={`input-${cat.id}`}
                        checked={checked}
                        onChange={() => toggleCategory(cat.key)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Mandatory Transactional Disclaimer */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Essential Account &amp; Transactional Notice</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Essential service and transactional emails (such as subscription confirmations, company provisioning confirmations, trial expiration notices, payment receipts, subscription renewals, payment failures, subscription cancellations, and security notifications) cannot be disabled where they are required to operate your customer account or subscription.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              id="btn-unsubscribe-all"
              onClick={handleUnsubscribeAll}
              disabled={saving || loading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Unsubscribe from all optional emails</span>
            </button>

            <button
              type="button"
              id="btn-save-preferences"
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>

        {/* Footer Identity & Statutory Links */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-500 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <span>MiraTech Industries &amp; Software Solutions Ltd.</span>
            <span>Support Desk: <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a></span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <span>•</span>
            <Link href="/refund" className="hover:underline">Refund Policy</Link>
            <span>•</span>
            <Link href="/dashboard" className="text-blue-600 hover:underline">Workspace Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailPreferencesPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center">
        <Suspense fallback={
          <div className="py-24 text-center text-slate-500 text-sm">
            Loading email preference center...
          </div>
        }>
          <PreferencesForm />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
