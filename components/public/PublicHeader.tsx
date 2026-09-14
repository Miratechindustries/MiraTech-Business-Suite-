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
    <header className="sticky top-0 z-40 w-full bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-800 text-white">
      {/* Top micro-announcement banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-slate-950 text-[11px] font-bold py-1 px-4 text-center tracking-wide flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-slate-950" />
        <span>Try MiraTech Business Suite free for 14 days — No commitment required</span>
        <Link href="/register" className="underline font-black hover:text-white transition-colors ml-1">
          Get Started &rarr;
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="h-full w-full bg-[#0B132B] rounded-[10px] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">MiraTech</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  Suite
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wide">Enterprise Cloud ERP & SaaS</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors py-2 ${
                    isActive
                      ? 'text-amber-400 font-bold'
                      : 'text-slate-300 hover:text-white'
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
                className="flex items-center gap-1 py-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <span>Compliance & Legal</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {legalDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-[#111A38] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1">
                  {legalLinks.map((doc) => (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      className="block px-3 py-2 text-xs text-slate-300 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
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
              className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md transition-all hover:shadow-amber-500/20 active:scale-95"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#0B132B] px-4 pt-3 pb-6 space-y-4">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-semibold text-slate-200 hover:text-amber-400 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 border-t border-slate-800/80">
              <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Policies & Compliance
              </span>
              <div className="mt-1 space-y-1">
                {legalLinks.map((doc) => (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-slate-300 hover:text-amber-400 hover:bg-slate-800/40 rounded-lg"
                  >
                    {doc.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Sign In to Workspace
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl shadow-md"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
