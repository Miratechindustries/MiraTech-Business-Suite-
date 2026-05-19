'use client'

import React from 'react';
import { Settings as SettingsIcon, Bell, Shield, Wallet, Monitor, Globe } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const sections = [
    { title: 'General', icon: Monitor, desc: 'Update your business profile and preferences.', href: '/dashboard/settings/general' },
    { title: 'Notifications', icon: Bell, desc: 'Manage how you receive alerts and reports.', href: '/dashboard/settings/notifications' },
    { title: 'Security', icon: Shield, desc: 'Configure password and account protection.', href: '/dashboard/settings/security' },
    { title: 'Billing', icon: Wallet, desc: 'Manage your subscription and payment methods.', href: '/dashboard/settings/billing' },
    { title: 'API Access', icon: Globe, desc: 'Connect your business to external services.', href: '/dashboard/settings/api' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">Configure your Mira Suite workspace.</p>
      </div>

      <div className="grid gap-6">
        {sections.map((section, i) => (
          <Link key={i} href={section.href}>
            <div className="group flex cursor-pointer items-center justify-between rounded-2xl border bg-white p-6 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-6">
                <div className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <section.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{section.title}</h3>
                  <p className="text-sm text-slate-500">{section.desc}</p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-slate-100 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-800 flex items-center justify-center">
                <div className="h-1.5 w-1.5 border-t-2 border-r-2 border-slate-400 rotate-45" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
