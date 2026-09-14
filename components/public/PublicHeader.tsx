'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Shield, Menu, X, ArrowRight, Sparkles, ChevronDown } from 'lucide-react';

export default function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalDropdownOpen, setLegalDropdownOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Support', href: '/support' },
  ];

  const legalLinks = [
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Refund & Cancellation', href: '/refund' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-2xs">
      {/* Top micro-announcement banner */}
      <div className="bg-blue-600 text-white text-[11px] font-semibold py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-200" />
        <span>Try MiraTech Business Suite free for 14 days — No commitment required</span>
        <Link href="/register" className="underline font-bold text-white hover:text-blue-100 transition-colors ml-1">
          Get Started &rarr;
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-blue-600 shadow-sm flex items-center justify-center group-hover:bg-blue-700 transition-colors">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">MiraTech</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  Suite
                </span>
              </div>
              <p className="text-[10px] text-slate-500 tracking-wide font-medium">Enterprise Cloud ERP &amp; SaaS</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors py-2 ${
                    isActive
                      ? 'text-blue-600 font-bold border-b-2 border-blue-600 -mb-0.5'
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Legal Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLegalDropdownOpen(!legalDropdownOpen)}
                onBlur={() => setTimeout(() => setLegalDropdownOpen(false), 200)}
                className="flex items-center gap-1 py-2 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer font-semibold"
              >
                <span>Compliance &amp; Legal</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {legalDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-1">
                  {legalLinks.map((doc) => (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      className="block px-3 py-2 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 rounded-lg transition-colors font-medium"
                      onClick={() => setLegalDropdownOpen(false)}
                    >
                      {doc.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow-blue-500/20 active:scale-95"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4 shadow-lg">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 border-t border-slate-150">
              <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Policies &amp; Compliance
              </span>
              <div className="mt-1 space-y-1">
                {legalLinks.map((doc) => (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50/40 rounded-lg"
                  >
                    {doc.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className="pt-3 border-t border-slate-150 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Sign In to Workspace
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
