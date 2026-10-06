'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  ExternalLink,
  AlertCircle
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
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      companyName: formData.company.trim(),
      category: formData.category,
      priority: 'normal',
      subject: formData.subject.trim(),
      message: formData.message.trim(),
    };

    try {
      const res = await fetch('/api/support/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry to support server.');
      }

      setTicketRef(data.ticketNumber || `MIRA-INQ-${Math.floor(100000 + Math.random() * 900000)}`);
      setSubmitted(true);
    } catch (apiErr: any) {
      console.warn('[SupportPage] API submission issue, using direct Firestore fallback:', apiErr.message);
      try {
        const fallbackTicket = `MIRA-INQ-${Math.floor(100000 + Math.random() * 900000)}`;
        await addDoc(collection(db, 'SupportMessages'), {
          ticketNumber: fallbackTicket,
          userName: formData.name.trim() || 'Valued Client',
          userEmail: formData.email.trim().toLowerCase(),
          companyName: formData.company.trim() || 'Corporate Tenant',
          message: `[Category: ${formData.category.toUpperCase()}]\nSubject: ${formData.subject.trim()}\n\n${formData.message.trim()}`,
          category: formData.category,
          status: 'open',
          createdAt: serverTimestamp(),
          isPublicInquiry: true
        });

        setTicketRef(fallbackTicket);
        setSubmitted(true);
      } catch (dbErr: any) {
        setErrorMessage(apiErr.message || dbErr.message || 'Error submitting ticket. Please email miratechindustries@gmail.com directly.');
      }
    } finally {
      setLoading(false);
    }
  };

  const supportCategories = [
    { id: 'billing', label: 'Subscription, Paddle Billing & Invoices' },
    { id: 'refund', label: 'Cancellation or Refund Inquiry' },
    { id: 'technical', label: 'Technical Support & Platform Issue' },
    { id: 'access', label: 'Account Credentials & Login Access' },
    { id: 'sales', label: 'Enterprise Plan & Custom Inquiries' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Customer Success &amp; Help Center</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              We&apos;re Here to Support Your Business
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Have questions about your subscription, workspace setup, billing receipts, or need technical assistance? Our dedicated support team is ready to help.
            </p>
          </div>

          {/* Contact Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-7 space-y-3 shadow-xs">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 w-fit">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Direct Email &amp; Phone Support</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Reach our customer support and engineering desks directly for any platform or billing assistance.
              </p>
              <div className="pt-2 text-xs space-y-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Primary Desk:</span>
                <a href="mailto:miratechindustries@gmail.com" className="font-bold text-blue-600 hover:underline block">
                  miratechindustries@gmail.com
                </a>
                <span className="text-slate-500 block text-[10px] uppercase font-bold pt-1">Support Phone Lines:</span>
                <p className="font-bold text-slate-800 font-mono text-[11px]">
                  <a href="tel:+26879427339" className="hover:underline text-blue-600">+268 7942 7339</a> / <a href="tel:+26876427339" className="hover:underline text-blue-600">+268 7642 7339</a>
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-7 space-y-3 shadow-xs">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 w-fit">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">SLA Response Times</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                We monitor support requests with rapid response commitments:
              </p>
              <ul className="text-xs text-slate-700 space-y-1.5 pt-1">
                <li className="flex justify-between">
                  <span className="text-slate-500">Critical Incidents:</span>
                  <span className="font-bold text-emerald-600">&lt; 4 hours</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">Billing &amp; Refunds:</span>
                  <span className="font-bold text-blue-600">&lt; 24 hours</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">General Inquiries:</span>
                  <span className="font-bold text-slate-700">1 business day</span>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-7 space-y-3 shadow-xs">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Paddle Merchant Support</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                For direct receipt inquiries, payment verification, and credit card updates, access the Paddle Customer Portal:
              </p>
              <div className="pt-2">
                <a 
                  href="https://checkout.paddle.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                >
                  <span>Open Paddle Customer Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Contact Ticket Form & FAQ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Form */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-xs">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-slate-900">Submit a Support Ticket</h3>
                <p className="text-xs text-slate-600">
                  Fill out the details below and our team will respond to your registered email promptly.
                </p>
              </div>

              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-slate-900 text-base">Support Ticket Submitted Successfully</h4>
                  {ticketRef && (
                    <div className="inline-block px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-mono font-bold">
                      Ticket Ref: #{ticketRef}
                    </div>
                  )}
                  <p className="text-xs text-slate-600">
                    We have received your message and dispatched a confirmation to <strong>{formData.email}</strong>. Our support desk will follow up shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setTicketRef(null);
                      setFormData({ name: '', email: '', company: '', category: 'billing', subject: '', message: '' });
                    }}
                    className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-slate-800 transition"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">Your Full Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">Corporate Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="sarah@company.com"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">Company Name</label>
                      <input
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Apex Logistics Ltd"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">Inquiry Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {supportCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">Subject</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Brief summary of your request"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">Message / Details</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Describe your question or issue in detail..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Dispatching Ticket...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Support Request</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Quick Answers */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-7 space-y-4 shadow-xs">
                <h3 className="font-bold text-base text-slate-900">Quick Support Answers</h3>
                <div className="space-y-4 text-xs">
                  <div className="space-y-1 pb-3 border-b border-slate-100">
                    <strong className="text-slate-900 block font-bold">How do I update my credit card?</strong>
                    <p className="text-slate-600">Access your workspace Settings &gt; Subscriptions or log into the Paddle Customer Portal using your receipt email.</p>
                  </div>
                  <div className="space-y-1 pb-3 border-b border-slate-100">
                    <strong className="text-slate-900 block font-bold">Where can I download tax invoices?</strong>
                    <p className="text-slate-600">Tax invoices are emailed automatically by Paddle upon billing. You can also retrieve them anytime via the Paddle billing portal.</p>
                  </div>
                  <div className="space-y-1 pb-3 border-b border-slate-100">
                    <strong className="text-slate-900 block font-bold">How do I cancel my subscription?</strong>
                    <p className="text-slate-600">You can cancel instantly with one click under Workspace Settings &gt; Subscriptions. No cancellation fees apply.</p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-slate-900 block font-bold">What is the support email &amp; phone?</strong>
                    <p className="text-slate-600">
                      Email: <a href="mailto:miratechindustries@gmail.com" className="text-blue-600 underline">miratechindustries@gmail.com</a><br />
                      Phone: <a href="tel:+26879427339" className="text-blue-600 underline">+268 7942 7339</a> / <a href="tel:+26876427339" className="text-blue-600 underline">+268 7642 7339</a>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Merchant of Record Notice</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders and provides customer service inquiries and handles returns.
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
