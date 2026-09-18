'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  ShieldCheck, 
  Sliders, 
  Search, 
  Filter, 
  RefreshCw, 
  Ban, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  Send, 
  Info, 
  Lock,
  History,
  Check,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { auth } from '@/lib/firebase';

interface PreferenceRecord {
  id: string;
  email: string;
  userId?: string;
  companyId?: string;
  marketingEnabled: boolean;
  productUpdatesEnabled: boolean;
  newsletterEnabled: boolean;
  featureAnnouncementsEnabled: boolean;
  educationalContentEnabled: boolean;
  promotionalOffersEnabled: boolean;
  unsubscribedAt: string | null;
  unsubscribeSource: string | null;
  updatedAt: string;
}

interface AuditLog {
  id: string;
  email: string;
  action: string;
  preferenceCategory?: string;
  source: string;
  timestamp: string;
  details?: string;
}

export default function EmailPreferenceAdmin() {
  const [preferences, setPreferences] = useState<PreferenceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preferences' | 'audit' | 'test'>('preferences');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unsubscribed' | 'active'>('all');

  // Resubscribe Modal State (Guardrail)
  const [resubscribeModalOpen, setResubscribeModalOpen] = useState(false);
  const [targetRecipient, setTargetRecipient] = useState<PreferenceRecord | null>(null);
  const [resubscribeReason, setResubscribeReason] = useState('');
  const [confirmedConsent, setConfirmedConsent] = useState(false);
  const [resubscribing, setResubscribing] = useState(false);
  const [resubscribeError, setResubscribeError] = useState<string | null>(null);

  // Test Email Dispatcher State
  const [testEmail, setTestEmail] = useState('');
  const [testCategory, setTestCategory] = useState<'MARKETING' | 'TRANSACTIONAL'>('MARKETING');
  const [testEmailType, setTestEmailType] = useState('FEATURE_ANNOUNCEMENTS');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchPreferencesAndLogs = async () => {
    setLoading(true);
    try {
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const url = new URL('/api/email/admin/preferences', window.location.origin);
      if (filter !== 'all') url.searchParams.set('filter', filter);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString(), {
        headers: authHeader ? { Authorization: authHeader } : {},
      });

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences || []);
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error('Failed to load email preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferencesAndLogs();
  }, [filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPreferencesAndLogs();
  };

  const openResubscribeModal = (record: PreferenceRecord) => {
    setTargetRecipient(record);
    setResubscribeReason('');
    setConfirmedConsent(false);
    setResubscribeError(null);
    setResubscribeModalOpen(true);
  };

  const handleConfirmResubscribe = async () => {
    if (!targetRecipient) return;
    if (!confirmedConsent) {
      setResubscribeError('You must explicitly certify documented customer consent.');
      return;
    }
    if (!resubscribeReason || resubscribeReason.trim().length < 10) {
      setResubscribeError('Documented customer request reason must be at least 10 characters.');
      return;
    }

    setResubscribing(true);
    setResubscribeError(null);

    try {
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/email/admin/resubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          targetEmail: targetRecipient.email,
          customerInitiatedReason: resubscribeReason.trim(),
          confirmedCustomerConsent: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResubscribeModalOpen(false);
        fetchPreferencesAndLogs();
      } else {
        setResubscribeError(data.error || 'Failed to process resubscription.');
      }
    } catch (err: any) {
      setResubscribeError('A network error occurred.');
    } finally {
      setResubscribing(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail,
          category: testCategory,
          emailType: testEmailType,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      // Refresh audit logs
      fetchPreferencesAndLogs();
    } catch (err: any) {
      setTestResult({ error: 'Failed to dispatch test notification' });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Customer Email Preferences &amp; Unsubscribe Governance
              </h2>
              <p className="text-xs text-slate-500">
                Audited opt-out enforcement, RFC 8058 One-Click compliance, and statutory unsubscribe protection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPreferencesAndLogs()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'preferences'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customer Preference Records ({preferences.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Statutory Audit Logs ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'test'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Pre-Send Verification Simulator</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Preferences Directory */}
      {activeTab === 'preferences' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recipient email or source..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={filter}
                onChange={(e: any) => setFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none"
              >
                <option value="all">All Records</option>
                <option value="unsubscribed">Unsubscribed (Marketing Disabled)</option>
                <option value="active">Active (Marketing Enabled)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Recipient Email</th>
                  <th className="py-3.5 px-4">Marketing Status</th>
                  <th className="py-3.5 px-4">Unsubscribe Details</th>
                  <th className="py-3.5 px-4">Sub-Categories</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preferences.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No matching email preference records found.
                    </td>
                  </tr>
                ) : (
                  preferences.map((record) => {
                    const isUnsub = !record.marketingEnabled;
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                          {record.email}
                        </td>
                        <td className="py-3.5 px-4">
                          {isUnsub ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <Ban className="w-3 h-3 text-red-500" />
                              <span>UNSUBSCRIBED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>SUBSCRIBED</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          {isUnsub ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-800 font-semibold">
                                Via: {record.unsubscribeSource || 'Email Link'}
                              </div>
                              <div className="text-slate-400">
                                {record.unsubscribedAt
                                  ? new Date(record.unsubscribedAt).toLocaleString()
                                  : 'Documented'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${record.productUpdatesEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
                              Updates
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${record.newsletterEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
                              News
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${record.featureAnnouncementsEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
                              Features
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                          {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isUnsub ? (
                            <button
                              onClick={() => openResubscribeModal(record)}
                              className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition inline-flex items-center gap-1"
                              title="Resubscribe requires explicit customer-initiated authorization"
                            >
                              <UserCheck className="w-3 h-3 text-amber-600" />
                              <span>Resubscribe (Customer-Initiated)</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Statutory Email Preference &amp; Dispatch Audit Trail
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Immutable ledger of unsubscribe and pre-send suppression events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Details / Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const isBlocked = log.action === 'PRE_SEND_BLOCKED';
                    const isUnsub = log.action.includes('UNSUBSCRIBE');
                    const isResub = log.action.includes('RESUBSCRIBE');

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBlocked
                                ? 'bg-amber-100 text-amber-800'
                                : isUnsub
                                ? 'bg-red-100 text-red-800'
                                : isResub
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-sans font-medium">
                          {log.email}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans">
                          {log.source}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-sans text-xs">
                          {log.details || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Pre-Send Verification Simulator */}
      {activeTab === 'test' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pre-Send Verification &amp; Email Dispatch Simulator
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Verify the strict transactional vs. marketing email logic in real time. Marketing dispatches to unsubscribed users are automatically blocked before transmission, while essential transactional notices bypass marketing filters.
            </p>
          </div>

          <form onSubmit={handleSendTestEmail} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                required
                placeholder="customer@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Classification
                </label>
                <select
                  value={testCategory}
                  onChange={(e: any) => setTestCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold"
                >
                  <option value="MARKETING">Marketing (Subject to Unsubscribe)</option>
                  <option value="TRANSACTIONAL">Transactional (Essential Notice)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Email Type
                </label>
                <select
                  value={testEmailType}
                  onChange={(e) => setTestEmailType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold"
                >
                  {testCategory === 'MARKETING' ? (
                    <>
                      <option value="FEATURE_ANNOUNCEMENTS">Feature Announcements</option>
                      <option value="NEWSLETTER">Monthly Newsletter</option>
                      <option value="PRODUCT_UPDATES">Product Updates</option>
                      <option value="MARKETING_PROMOTIONAL">Promotional Offers</option>
                    </>
                  ) : (
                    <>
                      <option value="PAYMENT_RECEIPT">Payment Receipt</option>
                      <option value="SUBSCRIPTION_CONFIRMATION">Subscription Confirmation</option>
                      <option value="SECURITY_NOTIFICATION">Security Notice / OTP</option>
                      <option value="SERVICE_NOTICE">Service Notice</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={testSending}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {testSending ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{testSending ? 'Testing Dispatch...' : 'Run Pre-Send Test'}</span>
            </button>
          </form>

          {/* Test Results Display */}
          {testResult && (
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3 max-w-xl">
              <div className="flex items-center gap-2">
                {testResult.result?.blockedByPreferences ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    <Ban className="w-4 h-4 text-amber-600" />
                    <span>PRE-SEND CHECK: BLOCKED (Recipient is Unsubscribed)</span>
                  </span>
                ) : testResult.result?.sent ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>DISPATCH APPROVED &amp; TRANSMITTED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-200">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>DISPATCH FAILED</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-700">
                {testResult.result?.reason || (testResult.result?.sent ? 'Email delivered with compliant legal footer and RFC 8058 headers.' : testResult.error)}
              </p>

              {testResult.result?.auditLogId && (
                <div className="text-[11px] text-slate-500 font-mono">
                  Audit Log ID: {testResult.result.auditLogId}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guard-Railed Resubscribe Confirmation Modal */}
      {resubscribeModalOpen && targetRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Customer-Initiated Resubscribe Guardrail
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Statutory electronic communication rules strictly prohibit administrators from silently overriding customer marketing opt-out decisions.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div>
                <strong className="text-slate-900">Recipient Email:</strong>{' '}
                <span className="font-mono text-blue-700 font-semibold">{targetRecipient.email}</span>
              </div>
              <div>
                <strong className="text-slate-900">Originally Unsubscribed:</strong>{' '}
                <span>{targetRecipient.unsubscribedAt ? new Date(targetRecipient.unsubscribedAt).toLocaleString() : 'Documented'}</span>
              </div>
              <div>
                <strong className="text-slate-900">Unsubscribe Channel:</strong>{' '}
                <span>{targetRecipient.unsubscribeSource || 'Email Link'}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Documented Customer Request (Mandatory Audit Trail)*
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g., Customer explicitly requested marketing resubscription via verified Zendesk ticket #4928"
                  value={resubscribeReason}
                  onChange={(e) => setResubscribeReason(e.target.value)}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedConsent}
                  onChange={(e) => setConfirmedConsent(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <span className="text-[11px] text-amber-950 leading-relaxed">
                  I hereby certify under penalty of administrative governance that this action is executed pursuant to documented customer authorization, and not a silent or unsolicited marketing resubscription.
                </span>
              </label>

              {resubscribeError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {resubscribeError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResubscribeModalOpen(false)}
                disabled={resubscribing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResubscribe}
                disabled={resubscribing || !confirmedConsent}
                className="px-5 py-2 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {resubscribing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Record Consent &amp; Resubscribe</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
