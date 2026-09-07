"use client";

import { useState, useEffect } from "react";
import { 
  Shield, 
  Cookie, 
  X, 
  Check, 
  Scale, 
  FileText, 
  Lock, 
  ExternalLink,
  ChevronDown,
  Info 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LegalCompliance() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"terms" | "privacy" | "cookies">("terms");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Granular Cookie Choices
  const [preferences, setPreferences] = useState({
    essential: true, // always true
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // Check if user has already made a preference
    const consent = localStorage.getItem("mira_cookie_consent");
    if (!consent) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!mounted) return null;

  const saveConsent = (allAccepted: boolean, choices?: typeof preferences) => {
    if (typeof window === "undefined") return;

    const finalPreferences = allAccepted 
      ? { essential: true, analytics: true, marketing: true }
      : choices || preferences;

    localStorage.setItem("mira_cookie_consent", JSON.stringify(finalPreferences));
    
    // Set matching legal cookies under International GDPR/ePrivacy Directives
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year expiration
    
    document.cookie = `mira_essential_consent=true; expires=${expiry.toUTCString()}; path=/; SameSite=Lax; Secure`;
    document.cookie = `mira_analytics_consent=${finalPreferences.analytics}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax; Secure`;
    document.cookie = `mira_marketing_consent=${finalPreferences.marketing}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax; Secure`;

    setShowBanner(false);
  };

  const handleAcceptAll = () => {
    saveConsent(true);
  };

  const handleSavePreferences = () => {
    saveConsent(false, preferences);
  };

  const handleRejectAll = () => {
    const minPreferences = { essential: true, analytics: false, marketing: false };
    setPreferences(minPreferences);
    saveConsent(false, minPreferences);
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <>
      {/* Cookie Consent Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            id="cookie-consent-banner-wrapper"
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-6 left-6 z-[9999] max-w-lg w-11/12 sm:w-full bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] p-5 sm:p-6 font-sans flex flex-col gap-4 overflow-hidden"
          >
            {/* Ambient Background Accent Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
                <Cookie className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                  Privacy & Cookies Compliance
                </span>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Your Privacy Choice & Legal Rights
                </h4>
                <p className="text-xs text-slate-400 leading-normal mt-1.5">
                  We use cookies and analytical tokens to optimize performance, customize security protocols, and secure active financial synchronization. You can customize your consent or view our statutory agreements below.
                </p>
              </div>
            </div>

            {/* Cookie Options Configurator Accordion */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span>Customize Caching Preferences</span>
                <div className="flex items-center gap-2">
                  <a
                    href="/legal"
                    target="_blank"
                    className="text-slate-400 hover:text-white flex items-center gap-0.5 transition"
                  >
                    Legal Hub <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  <button 
                    onClick={() => setShowTermsModal(true)} 
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <FileText className="h-3 w-3" /> View Terms
                  </button>
                </div>
              </div>

              {/* Essential */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">Necessary & Session Security</span>
                    <span className="text-[8px] bg-slate-800 text-slate-400 font-extrabold uppercase px-1 rounded">Required</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-none">Authentication tokens and company metadata storage.</span>
                </div>
                <div className="h-5 w-9 bg-indigo-600 rounded-full flex items-center justify-end px-1.5 opacity-60">
                  <div className="h-3.5 w-3.5 bg-white rounded-full" />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Performance & Metrics</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-none">Usage aggregation and offline diagnostics.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                  className={`h-5 w-9 rounded-full transition duration-200 flex items-center relative ${preferences.analytics ? "bg-indigo-600 justify-end" : "bg-slate-800 justify-start"}`}
                >
                  <span className="absolute text-[8px] font-black right-1 text-white select-none pointer-events-none opacity-0">ON</span>
                  <div className="h-3.5 w-3.5 bg-white rounded-full mx-1" />
                </button>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Extended Features & Personalization</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-none">Saves layout styles and client feedback preferences.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferences(prev => ({ ...prev, marketing: !prev.marketing }))}
                  className={`h-5 w-9 rounded-full transition duration-200 flex items-center relative ${preferences.marketing ? "bg-indigo-600 justify-end" : "bg-slate-800 justify-start"}`}
                >
                  <div className="h-3.5 w-3.5 bg-white rounded-full mx-1" />
                </button>
              </div>
            </div>

            {/* Footer with Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={handleAcceptAll}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[11px] font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" /> Accept All
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold py-2 px-4 rounded-xl transition cursor-pointer"
              >
                Save Preferences
              </button>
              <button
                onClick={handleRejectAll}
                className="bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-red-400 text-[11px] font-medium py-2 px-3 rounded-xl transition cursor-pointer"
              >
                Reject All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms, Conditions & Privacy Policy Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Decorative Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#38BDF8]">
                      Statutory Agreements & Governance
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">
                    MiraTech Compliance Center
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    International Terms & Conditions, ePrivacy Compliance, & GDPR/CCPA Rights.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/legal"
                    target="_blank"
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <span>Open Legal Center</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => setShowTermsModal(false)}
                    className="p-1.5 bg-slate-800 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Document Nav Header Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-2 gap-1">
                <button
                  onClick={() => setActiveTab("terms")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-5 rounded-xl transition ${activeTab === "terms" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40"}`}
                >
                  <Scale className="h-4.5 w-4.5" /> Terms & Conditions
                </button>
                <button
                  onClick={() => setActiveTab("privacy")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-5 rounded-xl transition ${activeTab === "privacy" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40"}`}
                >
                  <Lock className="h-4.5 w-4.5" /> Privacy Directive
                </button>
                <button
                  onClick={() => setActiveTab("cookies")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-5 rounded-xl transition ${activeTab === "cookies" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40"}`}
                >
                  <Cookie className="h-4.5 w-4.5" /> Cookies Disclosure
                </button>
              </div>

              {/* Scrollable Contents Pane */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-slate-700 dark:text-slate-300 text-xs leading-relaxed max-w-none">
                
                {activeTab === "terms" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">General Information & Compliance</h4>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 text-xs">
                        Welcome to MiraTech. Using this platform signifies implicit and explicit adherence to these international terms. Our services are aligned with the regulations of the United States, EU/EEA, United Kingdom, and regional trading blocks.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <button 
                          onClick={() => toggleSection("t1")}
                          className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 p-3.5 text-left font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40 transition"
                        >
                          <span>1. Use of the Services & Enterprise Tenancy</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedSection === "t1" ? "rotate-180" : ""}`} />
                        </button>
                        {(expandedSection === "t1" || !expandedSection) && (
                          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                            <p>You must provide accurate metadata profile files. Only Authorized company admins (specifically normalized configurations such as Master Admin or Business Admin roles) are authorized to modify billing modules, color parameters, or company inactivation rules.</p>
                            <p>All transactions, ledgers, quotations, and documents generated on this platform remain the exclusive legal property of your respective verified workspace company, bound directly under international accounting guidelines.</p>
                          </div>
                        )}
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <button 
                          onClick={() => toggleSection("t2")}
                          className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 p-3.5 text-left font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40 transition"
                        >
                          <span>2. Global Limitation of Liability</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedSection === "t2" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedSection === "t2" && (
                          <div className="p-4 border-t border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 space-y-2">
                            <p>To the maximum extent permitted by applicable laws, under no circumstances shall MiraTech, its subsidiaries, authors, or employees be held liable for any data loss, firestore connectivity failures, or inaccuracies in accounting reports, including but not limited to balance forwards, ledger entries, and company audits.</p>
                            <p>All calculations are rendered as-is based on input logs. Legal financial, tax, and company compliance filings remain entirely the company’s responsibility.</p>
                          </div>
                        )}
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <button 
                          onClick={() => toggleSection("t3")}
                          className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 p-3.5 text-left font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40 transition"
                        >
                          <span>3. Governing Law & Dispute Resolution</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedSection === "t3" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedSection === "t3" && (
                          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <p>These terms and conditions are governed by and construed in accordance with international digital commerce framework laws. Any litigation arising hereunder is subject to international arbitration models, ensuring safe resolution and strict business transparency.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "privacy" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 flex items-start gap-3">
                      <Lock className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Our GDPR & CCPA Commitment</h4>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 text-xs">
                          Your records, compliance reports, and tenant assets are hosted securely in Regional Firestore DB. Under GDPR regulations, you have explicit rights to erase, inspect, or download all customer and transaction histories instantly.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-xs uppercase tracking-wider text-indigo-400">1. Data Minimization & Storage</h4>
                        <p>We strictly limit data acquisition to core transactional structures. Any user account, invoice payload, letterhead assets, or system permission maps are maintained on Firestore. These maps are filtered with deep security rules requiring proper authentication bounds before document mutations.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-xs uppercase tracking-wider text-indigo-400">2. Real-Time Security & Encryptions</h4>
                        <p>Our workspace uses secure SSL-enabled transport layers alongside database level firestore rules to guard structural documents against illegitimate queries. Encryption handles authentication tokens in accordance with European Union ePrivacy and CCPA regulations.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-xs uppercase tracking-wider text-indigo-400">3. Rights of Data Subjects</h4>
                        <p>As a data subject, you (or your company) retain full oversight. Should you request data export or company account termination, contact miratechindustries@gmail.com for verified, immediate, and permanent asset wipeouts.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "cookies" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/60 flex items-start gap-3">
                      <Cookie className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Comprehensive Cookies Policy</h4>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 text-xs">
                          In compliance with the Directive 2002/58/EC (ePrivacy Directive) and the General Data Protection Regulation (GDPR), we disclose all cookie attributes and physical caching assets utilized inside the system.
                        </p>
                      </div>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                          <th className="py-2.5">Name</th>
                          <th className="py-2.5">Type</th>
                          <th className="py-2.5">Expiry</th>
                          <th className="py-2.5">Purpose & Legal Base</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-3 font-semibold font-mono text-indigo-500">mira_essential_consent</td>
                          <td className="py-3">Essential / Session</td>
                          <td className="py-3">1 Year</td>
                          <td className="py-3">Stores preference regarding legal cookie consents (Essential).</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold font-mono text-indigo-500">mira_inactivity_timeout</td>
                          <td className="py-3">Necessary / Preference</td>
                          <td className="py-3">Persistent</td>
                          <td className="py-3">Caches the auto-logout timeout for compliance reasons company-wide.</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold font-mono text-indigo-500">mira_analytics_consent</td>
                          <td className="py-3">Analytics / Diagnostic</td>
                          <td className="py-3">1 Year</td>
                          <td className="py-3">Governs performance observation flags across standard user sessions.</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold font-mono text-[#38BDF8]">firebase:unittest:token</td>
                          <td className="py-3">Functional / Session</td>
                          <td className="py-3">Session</td>
                          <td className="py-3">Maintains state authentication under regional cloud architecture.</td>
                        </tr>
                      </tbody>
                    </table>

                    <p className="text-[11px] text-slate-400 mt-2">
                      To refuse cookies completely, please update your modern web browser settings. Note that disabling Necessary cookies will impair structural system authentication, preventing company dashboard access altogether.
                    </p>
                  </div>
                )}

              </div>

              {/* Modal Footer Controls */}
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium leading-none">
                  <Shield className="h-4 w-4 text-[#38BDF8]" /> Certified GDPR / CCPA Digital Agreement
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleAcceptAll();
                      setShowTermsModal(false);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-5 rounded-xl transition cursor-pointer"
                  >
                    Accept All & Close
                  </button>
                  <button
                    onClick={() => setShowTermsModal(false)}
                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-2 px-5 rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Sticky Compliance Trigger in Workspace Margins/Footer for High-Audit Visibility */}
      <div className="fixed bottom-6 left-6 z-[9990] flex items-center">
        <button
          onClick={() => setShowTermsModal(true)}
          className="p-2 sm:p-2.5 bg-white/95 hover:bg-slate-100 border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 rounded-full shadow-lg transition duration-200 flex items-center gap-1.5 font-sans group cursor-pointer"
          title="Terms & Privacy Compliance Center"
          id="legal-compliance-floating-button"
        >
          <Scale className="h-4 w-4 text-slate-500 group-hover:text-indigo-600" />
          <span className="text-[10px] font-bold tracking-wider uppercase pr-1 hidden sm:inline-block">Legal Hub</span>
        </button>
      </div>
    </>
  );
}
