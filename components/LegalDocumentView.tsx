"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  FileText, 
  History, 
  Printer, 
  Download, 
  Search, 
  ExternalLink, 
  ChevronRight, 
  Calendar, 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Building2,
  Lock,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { LEGAL_DOCUMENTS, LegalDocument, LegalDocumentVersion } from "../lib/legalData";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

interface LegalDocumentViewProps {
  initialSlug?: string;
  onNavigateHome?: () => void;
}

export default function LegalDocumentView({ initialSlug = "privacy-policy", onNavigateHome }: LegalDocumentViewProps) {
  const [documents, setDocuments] = useState<LegalDocument[]>(LEGAL_DOCUMENTS);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sync state if initialSlug prop changes
  useEffect(() => {
    if (initialSlug) {
      setSelectedSlug(initialSlug);
      setSelectedVersion(null);
    }
  }, [initialSlug]);

  // Fetch or sync from Firestore collection 'legal_documents'
  useEffect(() => {
    let isMounted = true;
    const loadFirestoreDocs = async () => {
      try {
        setIsLoading(true);
        const colRef = collection(db, "legal_documents");
        const snapshot = await getDocs(colRef);
        
        if (!snapshot.empty && isMounted) {
          const loaded: LegalDocument[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            loaded.push({
              id: docSnap.id,
              slug: data.slug || docSnap.id,
              title: data.title || docSnap.id,
              category: data.category || "General",
              currentVersion: data.currentVersion || "v1.0",
              effectiveDate: data.effectiveDate || "January 2026",
              lastUpdated: data.lastUpdated || "January 2026",
              summary: data.summary || "",
              jurisdictionNotice: data.jurisdictionNotice || "",
              applicableLaw: data.applicableLaw || "",
              requiresReconsent: Boolean(data.requiresReconsent),
              content: data.content || "",
              versions: Array.isArray(data.versions) ? data.versions : []
            });
          }

          if (loaded.length > 0) {
            // Merge with local dataset to ensure all 9 standard docs exist
            const merged = LEGAL_DOCUMENTS.map(localDoc => {
              const remote = loaded.find(r => r.slug === localDoc.slug || r.id === localDoc.id);
              return remote || localDoc;
            });
            setDocuments(merged);
          }
        }
      } catch (err) {
        console.warn("Using offline legal dataset fallback:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFirestoreDocs();
    return () => { isMounted = false; };
  }, []);

  // Active document
  const activeDoc = useMemo(() => {
    return documents.find(d => d.slug === selectedSlug || d.id === selectedSlug) || documents[0];
  }, [documents, selectedSlug]);

  // Active version content
  const activeContent = useMemo(() => {
    if (!selectedVersion || selectedVersion === activeDoc.currentVersion) {
      return activeDoc.content;
    }
    const historicalVer = activeDoc.versions?.find(v => v.version === selectedVersion);
    return historicalVer ? historicalVer.content : activeDoc.content;
  }, [activeDoc, selectedVersion]);

  const activeVersionMeta = useMemo(() => {
    if (!selectedVersion || selectedVersion === activeDoc.currentVersion) {
      return {
        version: activeDoc.currentVersion,
        effectiveDate: activeDoc.effectiveDate,
        isCurrent: true,
        summary: activeDoc.summary
      };
    }
    const historicalVer = activeDoc.versions?.find(v => v.version === selectedVersion);
    return {
      version: selectedVersion,
      effectiveDate: historicalVer?.effectiveDate || activeDoc.effectiveDate,
      isCurrent: false,
      summary: historicalVer?.changesSummary || "Archived version"
    };
  }, [activeDoc, selectedVersion]);

  // Formatted markdown-like parser into React nodes
  const parsedContent = useMemo(() => {
    const raw = activeContent || "";
    const lines = raw.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = (keyPrefix: string) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`list-${keyPrefix}`} className="my-3 space-y-1.5 pl-5 list-disc text-slate-700 text-sm leading-relaxed">
            {listBuffer.map((item, idx) => (
              <li key={`item-${keyPrefix}-${idx}`}>
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
        listBuffer = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        listBuffer.push(trimmed.slice(2));
      } else {
        flushList(`line-${index}`);
        if (trimmed.startsWith("### ")) {
          elements.push(
            <h3 key={`h3-${index}`} className="text-base font-bold text-slate-900 mt-6 mb-2 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"></span>
              {trimmed.slice(4)}
            </h3>
          );
        } else if (trimmed.startsWith("## ")) {
          elements.push(
            <h2 key={`h2-${index}`} className="text-lg font-bold text-slate-900 mt-8 mb-3 pb-1.5 border-b border-slate-200 tracking-tight">
              {trimmed.slice(3)}
            </h2>
          );
        } else if (trimmed.length > 0) {
          elements.push(
            <p key={`p-${index}`} className="text-sm text-slate-700 leading-relaxed my-2">
              {renderInlineMarkdown(trimmed)}
            </p>
          );
        }
      }
    });

    flushList("final");
    return elements;
  }, [activeContent]);

  function renderInlineMarkdown(text: string): React.ReactNode {
    // Basic inline code and bolding parser
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="px-1.5 py-0.5 mx-0.5 bg-slate-100 text-indigo-700 rounded text-xs font-mono border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  }

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Download Handler (Markdown / Text)
  const handleDownload = () => {
    const header = `# ${activeDoc.title}\nVersion: ${activeVersionMeta.version}\nEffective Date: ${activeVersionMeta.effectiveDate}\nJurisdiction: ${activeDoc.jurisdictionNotice}\nApplicable Law: ${activeDoc.applicableLaw}\n\n`;
    const fullText = header + activeContent;
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDoc.slug}-${activeVersionMeta.version}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Direct Link Handler
  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/legal?doc=${activeDoc.slug}` : "";
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Categories grouping
  const groupedDocuments = useMemo(() => {
    const groups: { [cat: string]: LegalDocument[] } = {};
    documents.forEach(doc => {
      const cat = doc.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    });
    return groups;
  }, [documents]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Top Compliance Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="flex items-center gap-2.5 text-slate-900 hover:text-indigo-600 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-indigo-700 transition-colors">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight">MiraTech Business Suite</span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Legal & Compliance Hub</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SOC 2 Type II & GDPR Verified</span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hub Header & Status */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                <span>Statutory Compliance & Governance Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Legal Center & Trust Repository
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Review all binding operational agreements, multi-tenant cloud commitments, privacy protocols, subprocessor registries, and customer data rights.
              </p>
            </div>

            {/* Quick Trust Badges */}
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 font-medium">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md shadow-2xs">
                <Lock className="w-3 h-3 text-slate-500" /> AES-256 GCM Rest Encryption
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-indigo-600" /> ISO/IEC 27001 Aligned
              </span>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Navigation Sidebar + Active Document Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Document Directory Navigation (Left Sidebar) */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Legal Documents Index ({documents.length})
                </h2>
                {isLoading && (
                  <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                )}
              </div>

              {/* Document Groups */}
              <div className="space-y-4">
                {Object.entries(groupedDocuments).map(([category, docs]) => (
                  <div key={category} className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      {category}
                    </span>
                    <nav className="space-y-1">
                      {docs.map(doc => {
                        const isSelected = doc.slug === activeDoc.slug;
                        return (
                          <button
                            key={doc.slug}
                            id={`nav-legal-doc-${doc.slug}`}
                            onClick={() => {
                              setSelectedSlug(doc.slug);
                              setSelectedVersion(null);
                              setSearchQuery("");
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
                              isSelected
                                ? "bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs font-semibold"
                                : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                            }`}
                          >
                            <span className="truncate pr-2">{doc.title}</span>
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              isSelected ? "bg-indigo-200/70 text-indigo-900" : "bg-slate-100 text-slate-500"
                            }`}>
                              {doc.currentVersion}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>

              {/* Statutory Contact Helper Card */}
              <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>DPO & Legal Inquiries</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Questions regarding GDPR, data rights, or commercial terms? Contact our compliance directorate:
                </p>
                <a 
                  href="mailto:legal@miratechsuite.com"
                  className="inline-block text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                >
                  legal@miratechsuite.com
                </a>
              </div>
            </div>
          </aside>

          {/* Active Legal Document Viewer (Right Content) */}
          <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Document Action & Tool Bar */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold tracking-wide uppercase">
                      {activeDoc.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      Effective: <strong className="text-slate-800 font-medium">{activeVersionMeta.effectiveDate}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">
                      Updated: <strong className="text-slate-800 font-medium">{activeDoc.lastUpdated}</strong>
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1.5">
                    {activeDoc.title}
                  </h2>
                </div>

                {/* Document Actions: Print, Download, Copy Link */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-print-legal-doc"
                    onClick={handlePrint}
                    title="Print Document"
                    className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    id="btn-download-legal-doc"
                    onClick={handleDownload}
                    title="Download Markdown Document"
                    className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    id="btn-copy-legal-link"
                    onClick={handleCopyLink}
                    title="Copy Direct Link"
                    className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs flex items-center gap-1 text-xs"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Version History Selector Row */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-600 font-medium">Revision:</span>
                  <select
                    id="legal-version-selector"
                    value={activeVersionMeta.version}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-md font-mono text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value={activeDoc.currentVersion}>
                      {activeDoc.currentVersion} (Latest Official)
                    </option>
                    {activeDoc.versions?.map((ver) => (
                      <option key={ver.version} value={ver.version}>
                        {ver.version} — {ver.effectiveDate}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Applicable Law Notice */}
                <div className="text-[11px] text-slate-500 italic max-w-md truncate">
                  Law: {activeDoc.applicableLaw}
                </div>
              </div>

              {/* Archived Version Warning Banner if viewing past version */}
              {!activeVersionMeta.isCurrent && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      You are inspecting an archived revision (<strong>{activeVersionMeta.version}</strong>) effective on {activeVersionMeta.effectiveDate}.
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedVersion(null)}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition shrink-0"
                  >
                    Return to Current Version
                  </button>
                </div>
              )}
            </div>

            {/* Document Summary Pill / Lead */}
            <div className="px-6 py-4 bg-slate-50/40 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900 font-semibold">Executive Abstract: </strong>
              {activeVersionMeta.summary}
            </div>

            {/* Formatted Legal Text Content (Printable Area) */}
            <div 
              ref={printAreaRef} 
              id="printable-legal-content" 
              className="p-6 sm:p-8 space-y-4 max-w-none text-slate-800"
            >
              {parsedContent}

              {/* Document Footer Sign-off Block */}
              <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-700">MiraTech Business Suite Governance</span>
                  <p className="text-[11px] text-slate-400">Published by Directorate of Legal & Regulatory Compliance</p>
                </div>
                <div className="text-right sm:text-right text-[11px]">
                  <span>Statutory Record Ref: {activeDoc.slug}-{activeVersionMeta.version}</span>
                  <p className="text-slate-400">Jurisdiction: {activeDoc.jurisdictionNotice}</p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Clean Legal Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} MiraTech Industries & Software Solutions Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">Portal Home</Link>
            <span>•</span>
            <Link href="/register" className="hover:text-slate-900 transition-colors">Tenant Registration</Link>
            <span>•</span>
            <a href="mailto:legal@miratechsuite.com" className="hover:text-slate-900 transition-colors">Contact Legal</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
