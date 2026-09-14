'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { 
  Mail, 
  Clock, 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  ShieldCheck, 
  FileText, 
  RefreshCw,
  Building2,
  PhoneCall,
  ExternalLink
} from 'lucide-react';

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    category: 'billing',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate support ticket submission
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  const supportCategories = [
    { id: 'billing', label: 'Subscription, Paddle Billing & Invoices' },
    { id: 'refund', label: 'Cancellation or Refund Inquiry' },
    { id: 'technical', label: 'Technical Support & Platform Issue' },
    { id: 'access', label: 'Account Credentials & Login Access' },
    { id: 'sales', label: 'Enterprise Plan & Custom Inquiries' },
  ];

  return (
    <div className="min-h-screen bg-[#070D1E] text-white flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Customer Success & Help Center</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              We&apos;re Here to Support Your Business
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Have questions about your subscription, workspace setup, billing receipts, or need technical assistance? Our dedicated support team is ready to help.
            </p>
          </div>

          {/* Contact Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-7 space-y-3 shadow-xl">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Direct Email Support</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reach our customer support and engineering desks directly for any platform or billing assistance.
              </p>
              <div className="pt-2 text-xs">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Primary Desk:</span>
                <a href="mailto:miratechindustries@gmail.com" className="font-bold text-amber-400 hover:underline">
                  miratechindustries@gmail.com
                </a>
              </div>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-7 space-y-3 shadow-xl">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">SLA Response Times</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We monitor support requests with rapid response commitments:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 pt-1">
                <li className="flex justify-between">
                  <span className="text-slate-400">Critical Incidents:</span>
                  <span className="font-bold text-emerald-400">&lt; 4 hours</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Billing & Refunds:</span>
                  <span className="font-bold text-amber-400">&lt; 24 hours</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">General Inquiries:</span>
                  <span className="font-bold text-slate-300">1 business day</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-7 space-y-3 shadow-xl">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Paddle Merchant Support</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                For direct receipt inquiries, payment verification, and credit card updates, access the Paddle Customer Portal:
              </p>
              <div className="pt-2 text-xs">
                <a
                  href="https://paddle.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-blue-400 hover:underline"
                >
                  <span>Paddle Buyer Help Desk (paddle.net)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Support Ticket Submission Form */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Send Us a Direct Message</h2>
                <p className="text-xs text-slate-400">
                  Fill out the form below and our operations desk will respond promptly to your corporate email address.
                </p>
              </div>

              {submitted ? (
                <div className="p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Support Inquiry Received</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Thank you for contacting MiraTech Support. A support ticket has been created and assigned to an operations specialist. We will respond to <strong>{formData.email}</strong> shortly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: '',
                        email: '',
                        company: '',
                        category: 'billing',
                        subject: '',
                        message: '',
                      });
                    }}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Sarah Jenkins"
                        className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Corporate Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="s.jenkins@company.com"
                        className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Acme Enterprises"
                        className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Inquiry Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {supportCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="e.g. Question about annual plan billing receipt"
                      className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">
                      Detailed Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please describe your question or issue in detail..."
                      className="w-full px-4 py-2.5 bg-[#111A38] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'Sending Message...' : 'Send Message to Support Desk'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Quick Help Guides */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white text-center">Frequently Requested Guidance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 bg-[#0B132B] border border-slate-800 rounded-2xl space-y-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white text-sm">Where can I find tax invoices?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tax-compliant PDF receipts are delivered to your admin email upon each renewal, and can also be accessed via Settings &gt; Subscriptions in your workspace.
                </p>
              </div>

              <div className="p-6 bg-[#0B132B] border border-slate-800 rounded-2xl space-y-2">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white text-sm">How do I cancel my plan?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You can turn off auto-renewal at any time under Settings &gt; Subscriptions, or read our full{' '}
                  <Link href="/refund" className="text-amber-400 underline">Refund Policy</Link> for details.
                </p>
              </div>

              <div className="p-6 bg-[#0B132B] border border-slate-800 rounded-2xl space-y-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white text-sm">Who bills my credit card?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Transactions appear as PADDLE.NET* MIRATECH on statements. Paddle.com is the authorized Merchant of Record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
