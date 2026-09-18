'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Users, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Eye, 
  Filter, 
  Clock, 
  RefreshCw,
  ShieldCheck,
  Ban,
  Check,
  ExternalLink
} from 'lucide-react';
import { auth } from '../lib/firebase';

interface CampaignRecord {
  id: string;
  subject: string;
  headline?: string;
  bodyPreview: string;
  marketingType: string;
  targetAudience: string;
  recipientCount: number;
  dispatchedCount: number;
  blockedCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  actionLabel?: string;
  actionUrl?: string;
}

interface CompanyTarget {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
}

export default function MarketingEmailPortal() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Form State
  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [marketingType, setMarketingType] = useState('FEATURE_ANNOUNCEMENTS');
  const [targetAudience, setTargetAudience] = useState<'ALL_COMPANIES' | 'ACTIVE_SUBSCRIBERS' | 'TRIALING' | 'CUSTOM'>('ALL_COMPANIES');
  const [customEmailsInput, setCustomEmailsInput] = useState('');
  const [bodyContent, setBodyContent] = useState(
    `<p>We are delighted to introduce key platform enhancements to MiraTech Business Suite designed to streamline your business operations.</p>\n<p>Your enterprise dashboard now features consolidated reporting, high-frequency audit indexing, and enhanced customer communications.</p>`
  );
  const [actionLabel, setActionLabel] = useState('Launch Business Suite');
  const [actionUrl, setActionUrl] = useState('https://miratechsuite.com/dashboard');

  // Preview & Result State
  const [showPreview, setShowPreview] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/admin/marketing-emails', {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCampaigns(data.campaigns || []);
        setCompanies(data.companies || []);
      } else {
        setErrorMsg(data.error || 'Failed to fetch campaign metadata');
      }
    } catch (err: any) {
      setErrorMsg('Failed to connect to marketing email service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();
  }, []);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert('Please provide a subject line');
      return;
    }
    if (!bodyContent.trim()) {
      alert('Please enter email body content');
      return;
    }

    let parsedCustomEmails: string[] = [];
    if (targetAudience === 'CUSTOM') {
      parsedCustomEmails = customEmailsInput
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));

      if (parsedCustomEmails.length === 0) {
        alert('Please specify at least one valid recipient email');
        return;
      }
    }

    const estimatedCount =
      targetAudience === 'CUSTOM'
        ? parsedCustomEmails.length
        : targetAudience === 'ALL_COMPANIES'
        ? companies.length
        : targetAudience === 'ACTIVE_SUBSCRIBERS'
        ? companies.filter((c) => c.status === 'active').length
        : companies.filter((c) => c.status === 'trialing').length;

    const confirmed = window.confirm(
      `Confirm dispatch of marketing campaign via Brevo to ~${estimatedCount} recipient(s)?\n\nAll unsubscribed customers will be automatically safeguarded and skipped.`
    );
    if (!confirmed) return;

    setSending(true);
    setDispatchResult(null);
    setErrorMsg(null);

    try {
      let authHeader = '';
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        authHeader = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/admin/marketing-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          subject,
          headline: headline || subject,
          bodyContent,
          marketingType,
          targetAudience,
          customRecipients: parsedCustomEmails,
          actionLabel,
          actionUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchResult(data.results);
        fetchCampaignData();
      } else {
        setErrorMsg(data.error || 'Failed to dispatch marketing campaign');
      }
    } catch (err: any) {
      setErrorMsg('Network error dispatching campaign');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-blue-400 flex items-center justify-center font-bold shadow-xs border border-slate-800">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Marketing Email Portal
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Brevo Engine
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  MiraTech Theme
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch branded product updates, announcements, and newsletters to companies and leads with automated opt-out enforcement.
              </p>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'compose'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Compose Campaign</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                fetchCampaignData();
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Campaign History ({campaigns.length})</span>
            </button>
            <button
              onClick={fetchCampaignData}
              disabled={loading}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Companies
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {companies.length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Subscribers
            </span>
            <div className="text-xl font-black text-emerald-600 mt-0.5">
              {companies.filter((c) => c.status === 'active').length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Trialing Accounts
            </span>
            <div className="text-xl font-black text-amber-600 mt-0.5">
              {companies.filter((c) => c.status === 'trialing').length}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Campaigns Run
            </span>
            <div className="text-xl font-black text-blue-600 mt-0.5">
              {campaigns.length}
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-xs text-red-700">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* DISPATCH RESULT BANNER */}
      {dispatchResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-900">
              Campaign Execution Complete via Brevo
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-slate-500 font-medium block">Total Targeted:</span>
              <span className="text-base font-bold text-slate-800">{dispatchResult.total}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-700 font-medium block">Delivered via Brevo:</span>
              <span className="text-base font-bold text-emerald-700">{dispatchResult.dispatched}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-amber-700 font-medium block">Safeguarded (Opted Out):</span>
              <span className="text-base font-bold text-amber-700">{dispatchResult.blockedByPreferences}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-red-700 font-medium block">Failed:</span>
              <span className="text-base font-bold text-red-700">{dispatchResult.failed}</span>
            </div>
          </div>
          {dispatchResult.errors && dispatchResult.errors.length > 0 && (
            <div className="mt-2 text-[11px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 font-mono">
              <p className="font-bold mb-1">Transmission Exceptions:</p>
              {dispatchResult.errors.map((e: string, idx: number) => (
                <div key={idx}>• {e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: COMPOSE CAMPAIGN */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Compose Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Compose Marketing Dispatch
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showPreview ? 'Hide Preview' : 'Preview Layout'}</span>
              </button>
            </div>

            <form onSubmit={handleDispatch} className="space-y-4 text-xs">
              {/* Target Audience Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Target Audience Segment</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ALL_COMPANIES', label: `All Companies (${companies.length})`, icon: Building2 },
                    { id: 'ACTIVE_SUBSCRIBERS', label: `Active (${companies.filter((c) => c.status === 'active').length})`, icon: ShieldCheck },
                    { id: 'TRIALING', label: `Trialing (${companies.filter((c) => c.status === 'trialing').length})`, icon: Clock },
                    { id: 'CUSTOM', label: 'Custom List', icon: Users },
                  ].map((aud) => {
                    const Icon = aud.icon;
                    const selected = targetAudience === aud.id;
                    return (
                      <button
                        key={aud.id}
                        type="button"
                        onClick={() => setTargetAudience(aud.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                          selected
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-semibold">{aud.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Recipients Input if selected */}
              {targetAudience === 'CUSTOM' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Custom Recipient Email Addresses (Comma, semicolon, or line separated)
                  </label>
                  <textarea
                    rows={2}
                    value={customEmailsInput}
                    onChange={(e) => setCustomEmailsInput(e.target.value)}
                    placeholder="client1@company.com, ceo@logistics.com, finance@enterprise.io"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-xs bg-slate-50/50"
                  />
                </div>
              )}

              {/* Marketing Category Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Communication Category</label>
                  <select
                    value={marketingType}
                    onChange={(e) => setMarketingType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="FEATURE_ANNOUNCEMENTS">Feature Announcements & Releases</option>
                    <option value="NEWSLETTER">Executive & Product Newsletter</option>
                    <option value="PRODUCT_UPDATES">Platform Operational Updates</option>
                    <option value="EDUCATIONAL_CONTENT">Best Practices & Guides</option>
                    <option value="MARKETING_PROMOTIONAL">Commercial & Tier Offers</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Campaign Headline (Header Title)</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Next-Generation Business Reporting is Live"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Subject Line */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Subject Line (Appears in Inbox)
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. [MiraTech Business Suite] Unlock Real-Time Automated Financial Analytics"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Body Content (HTML supported) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">Email Body HTML Content</label>
                  <span className="text-[10px] text-slate-400 font-mono">Supports &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;</span>
                </div>
                <textarea
                  rows={6}
                  required
                  value={bodyContent}
                  onChange={(e) => setBodyContent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-xs bg-slate-50/30 leading-relaxed"
                />
              </div>

              {/* Call-to-Action Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Action Button Text</label>
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="e.g. Explore Enterprise Features"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Action Button Destination URL</label>
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://miratechsuite.com/dashboard"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Submit Dispatch */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Opt-out records and RFC 8058 One-Click headers are checked automatically.</span>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Transmitting via Brevo...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmit Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Interactive Live Preview */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Live Template Preview
              </span>
              <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                MiraTech Suite Theme
              </span>
            </div>

            {/* Email Container Mockup */}
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-w-md mx-auto text-left">
                {/* Dark Slate Corporate Header */}
                <div className="p-4 bg-slate-900 border-b-2 border-blue-600 text-white flex justify-between items-center">
                  <div>
                    <div className="font-extrabold text-sm tracking-tight">
                      MiraTech <span className="text-blue-400 font-normal">Business Suite</span>
                    </div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                      Enterprise Cloud Communications
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                    Official Update
                  </span>
                </div>

                {/* Email Body */}
                <div className="p-5 space-y-3.5">
                  <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                    {headline || subject || 'Platform Announcement Headline'}
                  </h4>

                  <div 
                    className="text-xs text-slate-600 leading-relaxed space-y-2 border-l-2 border-slate-200 pl-3 py-0.5"
                    dangerouslySetInnerHTML={{ __html: bodyContent || '<p>Campaign message content goes here...</p>' }}
                  />

                  {actionLabel && (
                    <div className="pt-2 text-center">
                      <div className="inline-block px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs">
                        {actionLabel} &rarr;
                      </div>
                    </div>
                  )}

                  {/* Legal Footer Mock */}
                  <div className="pt-4 border-t border-slate-100 space-y-2 text-[10px] text-slate-400 leading-relaxed">
                    <p>You are receiving this communication because of your relationship with MiraTech Business Suite.</p>
                    <div className="flex flex-wrap gap-2 text-blue-600 font-semibold text-[10px]">
                      <span className="underline">Manage Preferences</span>
                      <span>•</span>
                      <span className="text-red-500 underline">Unsubscribe</span>
                      <span>•</span>
                      <span className="underline">Privacy Policy</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-slate-500 text-[9px]">
                      <strong>MiraTech Industries & Software Solutions Ltd.</strong><br />
                      Commercial Park Phase II, Mbabane / Johannesburg<br />
                      RFC 8058 One-Click Compliant
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CAMPAIGN HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Historical Marketing Campaigns
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Logged: {campaigns.length}
            </span>
          </div>

          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-medium">No marketing campaigns have been dispatched yet.</p>
              <button
                onClick={() => setActiveTab('compose')}
                className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition"
              >
                Launch First Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{camp.subject}</h4>
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 text-blue-800">
                          {camp.marketingType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        ID: {camp.id} • Audience: {camp.targetAudience} • Sent by {camp.createdBy} on {new Date(camp.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-bold">
                        {camp.dispatchedCount} Dispatched
                      </span>
                      {camp.blockedCount > 0 && (
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 font-bold">
                          {camp.blockedCount} Opted Out
                        </span>
                      )}
                      {camp.failedCount > 0 && (
                        <span className="text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 font-bold">
                          {camp.failedCount} Failed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 line-clamp-2">
                    {camp.bodyPreview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
