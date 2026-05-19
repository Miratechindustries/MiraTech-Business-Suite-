'use client'

import React from 'react';
import { Save, Bell, Shield, Globe, Mail } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-blue-600 font-mono text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Infrastructure / Configuration</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Global_Directives</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* General Settings */}
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Environment_Basics</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary platform identity parameters</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Platform Alias</label>
              <input 
                type="text" 
                defaultValue="Mira Suite"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Support Endpoint</label>
              <input 
                type="email" 
                defaultValue="support@mirasuite.com"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="p-8 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Security_Firewall</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Access control and validation protocols</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <div>
                <p className="text-sm font-black uppercase tracking-tight">Enforce_MFA_Protocol</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mandatory 2-factor authentication for administrators</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all">
              <div>
                <p className="text-sm font-black uppercase tracking-tight">Auto_Approval_Engine</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instant entity validation post-verification</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Communication_Relay</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signal distribution for platform events</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent transition-all hover:bg-slate-100">
              <div>
                <p className="text-sm font-black uppercase tracking-tight">Onboarding_Alerts</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">High-priority signal for new business registration</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent transition-all hover:bg-slate-100">
              <div>
                <p className="text-sm font-black uppercase tracking-tight">Telemetry_Export</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Automated daily transmission of platform logs</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-600" />
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 flex justify-end">
          <button className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all">
            <Save size={18} />
            Commit_Changes
          </button>
        </div>
      </div>
    </div>
  );
}
