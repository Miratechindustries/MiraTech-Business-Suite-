'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building,
  ShieldAlert,
  Search,
  ChevronRight,
  ExternalLink,
  Flame,
  FileText,
  CreditCard,
  UserCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  SubscriptionEmailEventRecord,
  SubscriptionEmailEventType,
} from '@/lib/subscription-email-types';

export default function SubscriptionEmailAdmin() {
  const [events, setEvents] = useState<SubscriptionEmailEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);
  const [cronFeedback, setCronFeedback] = useState<string | null>(null);

  // Test modal state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmailType, setTestEmailType] = useState<SubscriptionEmailEventType>('SUBSCRIPTION_CONFIRMED');
  const [testTargetEmail, setTestTargetEmail] = useState('miratechindustries@gmail.com');
  const [testCompanyName, setTestCompanyName] = useState('Acme Corporation');
  const [testRecipientName, setTestRecipientName] = useState('Chief Executive');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscription-emails?status=${statusFilter}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to load subscription email events:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRetry = async (eventId: string) => {
    setRetryingId(eventId);
    try {
      const res = await fetch('/api/admin/subscription-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', eventId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchEvents();
      } else {
        alert(data.error || 'Retry failed');
      }
    } catch (err: any) {
      alert(err.message || 'Retry request error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRunCron = async () => {
    setRunningCron(true);
    setCronFeedback(null);
    try {
      const res = await fetch('/api/cron/trial-reminders', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCronFeedback(
          `Trial scan complete: Scanned ${data.scanned} companies. Dispatched: ${data.dispatched}, Already Sent (Idempotent): ${data.alreadySent}.`
        );
        await fetchEvents();
      } else {
        setCronFeedback(`Cron error: ${data.error || 'Execution failed'}`);
      }
    } catch (err: any) {
      setCronFeedback(`Cron request failed: ${err.message}`);
    } finally {
      setRunningCron(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setTestStatusMsg(null);
    try {
      const res = await fetch('/api/admin/subscription-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_send',
          emailType: testEmailType,
          targetEmail: testTargetEmail,
          companyName: testCompanyName,
          recipientName: testRecipientName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatusMsg({
          type: 'success',
          text: `Successfully dispatched "${testEmailType}" to ${testTargetEmail}! (Status: ${data.result?.deliveryStatus})`,
        });
        await fetchEvents();
      } else {
        setTestStatusMsg({
          type: 'error',
          text: data.error || 'Failed to dispatch test email',
        });
      }
    } catch (err: any) {
      setTestStatusMsg({
        type: 'error',
        text: err.message || 'Network exception sending test',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.recipientEmail?.toLowerCase().includes(q) ||
      ev.companyName?.toLowerCase().includes(q) ||
      ev.emailType?.toLowerCase().includes(q) ||
      ev.id?.toLowerCase().includes(q)
    );
  });

  const sentCount = events.filter((e) => e.deliveryStatus === 'SENT').length;
  const failedCount = events.filter((e) => e.deliveryStatus === 'FAILED').length;
  const pendingCount = events.filter((e) => e.deliveryStatus === 'PENDING').length;

  const getEventBadge = (type: SubscriptionEmailEventType) => {
    switch (type) {
      case 'SUBSCRIPTION_CONFIRMED':
        return {
          label: '1. Subscription Confirmed',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'COMPANY_PROVISIONED':
        return {
          label: '2. Company Provisioned',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Building,
        };
      case 'TRIAL_ENDING_REMINDER':
        return {
          label: '3. Trial Ending (3 Days)',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Clock,
        };
      case 'SUBSCRIPTION_RENEWAL_SUCCESS':
        return {
          label: '4. Renewal Success',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CreditCard,
        };
      case 'PAYMENT_FAILED':
        return {
          label: '5. Payment Failed',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: ShieldAlert,
        };
      case 'SUBSCRIPTION_ENDED':
        return {
          label: '6. Subscription Ended',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: AlertCircle,
        };
      default:
        return {
          label: type,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Mail,
        };
    }
  };

  return (
    <div id="subscription-email-governance-hub" className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Mail className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Subscription Transactional Emails
            </h2>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Audit-grade, idempotent delivery pipeline for all 6 subscription lifecycle events. Enforces provider-agnostic retry handling, anti-duplicate idempotency barriers, and Brevo delivery status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunCron}
            disabled={runningCron}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
            title="Scan for trials ending in 3 days and dispatch reminders"
          >
            <Clock className={`w-3.5 h-3.5 ${runningCron ? 'animate-spin' : ''}`} />
            {runningCron ? 'Scanning Trials...' : 'Run 3-Day Trial Scan'}
          </button>

          <button
            onClick={() => setIsTestModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Simulate / Send Test Email
          </button>

          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {cronFeedback && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900 flex items-center justify-between">
          <span>{cronFeedback}</span>
          <button
            onClick={() => setCronFeedback(null)}
            className="text-blue-500 hover:text-blue-800 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Logged Events
            </span>
            <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
              <Mail className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{events.length}</div>
          <div className="text-xs text-slate-400 mt-1">Recorded in Firestore audit log</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Delivered (Sent)
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{sentCount}</div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Provider confirmed</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Delivery Failures
            </span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{failedCount}</div>
          <div className="text-xs text-rose-600 font-medium mt-1">Retry available</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending / In-Transit
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{pendingCount}</div>
          <div className="text-xs text-amber-600 font-medium mt-1">Awaiting dispatch/ack</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'SENT', 'FAILED', 'PENDING'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search email, company, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Company &amp; Recipient</th>
                <th className="py-3 px-4">Status &amp; Provider ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading subscription email event audit ledger...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No subscription email events found for this filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  const badge = getEventBadge(ev.emailType);
                  const Icon = badge.icon;
                  const isSent = ev.deliveryStatus === 'SENT';
                  const isFailed = ev.deliveryStatus === 'FAILED';
                  const isPending = ev.deliveryStatus === 'PENDING';

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold ${badge.bg}`}
                        >
                          <Icon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-1 max-w-[200px] truncate" title={ev.id}>
                          Key: {ev.id}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-slate-900">{ev.companyName || 'Corporate Workspace'}</div>
                        <div className="text-slate-600 flex items-center gap-1 mt-0.5 font-medium">
                          {ev.recipientName ? `${ev.recipientName} • ` : ''}
                          <a
                            href={`mailto:${ev.recipientEmail}`}
                            className="text-blue-600 hover:underline"
                          >
                            {ev.recipientEmail}
                          </a>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Company ID: {ev.companyId || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex items-center gap-1.5">
                          {isSent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> SENT
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                              <ShieldAlert className="w-3 h-3" /> FAILED
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          )}
                        </div>

                        {ev.providerMessageId && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[180px]" title={ev.providerMessageId}>
                            MsgId: {ev.providerMessageId}
                          </div>
                        )}

                        {ev.error && (
                          <div className="text-[10px] text-rose-600 font-medium mt-1 max-w-[220px] bg-rose-50 p-1 rounded border border-rose-100">
                            {ev.error}
                          </div>
                        )}

                        {ev.retryCount > 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Retries attempted: {ev.retryCount}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 align-top text-slate-500">
                        <div>{new Date(ev.timestamp).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top text-right">
                        {isFailed ? (
                          <button
                            onClick={() => handleRetry(ev.id)}
                            disabled={retryingId === ev.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${retryingId === ev.id ? 'animate-spin' : ''}`} />
                            {retryingId === ev.id ? 'Retrying...' : 'Retry Dispatch'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRetry(ev.id)}
                            disabled={retryingId === ev.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Force re-dispatch"
                          >
                            <RefreshCw className={`w-3 h-3 ${retryingId === ev.id ? 'animate-spin' : ''}`} />
                            Re-send
                          </button>
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

      {/* Simulator Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Send className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Simulate Subscription Event Email
                  </h3>
                  <p className="text-xs text-slate-500">
                    Test any of the 6 branded templates end-to-end
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subscription Event Type:
                </label>
                <select
                  value={testEmailType}
                  onChange={(e) => setTestEmailType(e.target.value as SubscriptionEmailEventType)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                >
                  <option value="SUBSCRIPTION_CONFIRMED">1. Subscription Confirmed</option>
                  <option value="COMPANY_PROVISIONED">2. Company Provisioned</option>
                  <option value="TRIAL_ENDING_REMINDER">3. Trial Ending Reminder (3 Days)</option>
                  <option value="SUBSCRIPTION_RENEWAL_SUCCESS">4. Subscription Renewal Success</option>
                  <option value="PAYMENT_FAILED">5. Renewal / Payment Failed</option>
                  <option value="SUBSCRIPTION_ENDED">6. Subscription Ended / Expired</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={testTargetEmail}
                  onChange={(e) => setTestTargetEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={testCompanyName}
                    onChange={(e) => setTestCompanyName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Recipient Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={testRecipientName}
                    onChange={(e) => setTestRecipientName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {testStatusMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    testStatusMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {testStatusMsg.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-spin' : ''}`} />
                  {sendingTest ? 'Dispatching...' : 'Dispatch Test Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
