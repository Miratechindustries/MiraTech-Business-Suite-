"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { 
  Building2, 
  Check, 
  ChevronDown, 
  ChevronsUpDown, 
  Plus, 
  Search, 
  ShieldCheck, 
  Crown, 
  RefreshCw, 
  Sparkles, 
  AlertCircle,
  ExternalLink,
  Layers
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  limit, 
  onSnapshot 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useToastStore } from "../lib/store";
import { User } from "../lib/types";

export interface WorkspaceOrg {
  id: string;
  name: string;
  legalName?: string;
  ownerId?: string;
  email?: string;
  officialEmail?: string;
  phone?: string;
  role?: string;
  plan?: string;
  status?: string;
  primaryColor?: string;
  secondaryColor?: string;
  letterheadLogo?: string;
  isOwner?: boolean;
  isCurrent?: boolean;
}

interface WorkspaceSwitcherProps {
  currentCompany: any | null;
  currentUser: User | null;
  userAuthId?: string;
  userEmail?: string;
  onSwitchWorkspace: (companyId: string, orgData?: WorkspaceOrg) => Promise<void> | void;
  onRegisterNewOrg?: () => void;
  isMobile?: boolean;
  className?: string;
}

export default function WorkspaceSwitcher({
  currentCompany,
  currentUser,
  userAuthId,
  userEmail,
  onSwitchWorkspace,
  onRegisterNewOrg,
  isMobile = false,
  className = "",
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<WorkspaceOrg[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();

  const effectiveUserId = userAuthId || currentUser?.id || currentUser?.uid || "";
  const effectiveEmail = (userEmail || currentUser?.email || "").toLowerCase().trim();
  const isMasterAdmin = 
    currentUser?.role?.toUpperCase() === "MASTER_ADMIN" || 
    effectiveEmail === "miratechindustries@gmail.com";

  // Current active workspace identifier
  const activeCompanyId = useMemo(() => {
    return currentCompany?.id || currentUser?.companyId || currentUser?.businessId || effectiveUserId;
  }, [currentCompany, currentUser, effectiveUserId]);

  // Load all organizations the user belongs to
  const loadUserOrganizations = async () => {
    if (!effectiveUserId && !effectiveEmail) return;
    setLoading(true);
    try {
      const orgsMap = new Map<string, WorkspaceOrg>();

      // 1. Always inject the active/current company first if loaded
      if (currentCompany && (currentCompany.name || currentCompany.id)) {
        const currentId = currentCompany.id || activeCompanyId;
        orgsMap.set(currentId, {
          id: currentId,
          name: currentCompany.name || "Default Workspace",
          legalName: currentCompany.legalName || "",
          ownerId: currentCompany.ownerId,
          email: currentCompany.email || currentCompany.officialEmail,
          plan: currentCompany.subscriptionPlanId || currentCompany.subscriptionPlan || "Enterprise",
          status: currentCompany.subscriptionStatus || currentCompany.status || "ACTIVE",
          primaryColor: currentCompany.primaryColor || "#0F172A",
          secondaryColor: currentCompany.secondaryColor || "#3B82F6",
          letterheadLogo: currentCompany.letterheadLogo || "",
          isOwner: currentCompany.ownerId === effectiveUserId || currentId === effectiveUserId,
          isCurrent: true,
          role: isMasterAdmin ? "MASTER_ADMIN" : (currentCompany.ownerId === effectiveUserId || currentId === effectiveUserId ? "OWNER" : currentUser?.role || "MEMBER"),
        });
      }

      // 2. Fetch companies owned by the current user
      try {
        const ownedQuery = query(collection(db, "companies"), where("ownerId", "==", effectiveUserId));
        const ownedSnap = await getDocs(ownedQuery);
        ownedSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const orgId = docSnap.id;
          orgsMap.set(orgId, {
            id: orgId,
            name: data.name || "Unnamed Workspace",
            legalName: data.legalName || "",
            ownerId: data.ownerId || effectiveUserId,
            email: data.email || data.officialEmail,
            plan: data.subscriptionPlanId || data.subscriptionPlan || "Professional",
            status: data.subscriptionStatus || data.status || "ACTIVE",
            primaryColor: data.primaryColor || "#0F172A",
            secondaryColor: data.secondaryColor || "#3B82F6",
            letterheadLogo: data.letterheadLogo || "",
            isOwner: true,
            isCurrent: orgId === activeCompanyId,
            role: "OWNER",
          });
        });
      } catch (err) {
        console.warn("[WorkspaceSwitcher] Non-fatal error loading owned companies:", err);
      }

      // 3. Fetch direct document matching user's UID in companies
      if (effectiveUserId && !orgsMap.has(effectiveUserId)) {
        try {
          const directDoc = await getDoc(doc(db, "companies", effectiveUserId));
          if (directDoc.exists()) {
            const data = directDoc.data();
            orgsMap.set(effectiveUserId, {
              id: effectiveUserId,
              name: data.name || "My Primary Organization",
              legalName: data.legalName || "",
              ownerId: data.ownerId || effectiveUserId,
              email: data.email || data.officialEmail,
              plan: data.subscriptionPlanId || data.subscriptionPlan || "Starter",
              status: data.subscriptionStatus || data.status || "ACTIVE",
              primaryColor: data.primaryColor || "#0F172A",
              secondaryColor: data.secondaryColor || "#3B82F6",
              letterheadLogo: data.letterheadLogo || "",
              isOwner: true,
              isCurrent: effectiveUserId === activeCompanyId,
              role: "OWNER",
            });
          }
        } catch (err) {
          console.warn("[WorkspaceSwitcher] Non-fatal error checking direct UID company:", err);
        }
      }

      // 4. Fetch companies where user's email is officially registered
      if (effectiveEmail) {
        try {
          const emailQuery = query(
            collection(db, "companies"), 
            where("officialEmail", "==", effectiveEmail),
            limit(10)
          );
          const emailSnap = await getDocs(emailQuery);
          emailSnap.forEach((docSnap) => {
            if (!orgsMap.has(docSnap.id)) {
              const data = docSnap.data();
              orgsMap.set(docSnap.id, {
                id: docSnap.id,
                name: data.name || "Corporate Workspace",
                legalName: data.legalName || "",
                ownerId: data.ownerId,
                email: data.email || data.officialEmail,
                plan: data.subscriptionPlanId || data.subscriptionPlan || "Standard",
                status: data.subscriptionStatus || data.status || "ACTIVE",
                primaryColor: data.primaryColor || "#0F172A",
                secondaryColor: data.secondaryColor || "#3B82F6",
                letterheadLogo: data.letterheadLogo || "",
                isOwner: data.ownerId === effectiveUserId,
                isCurrent: docSnap.id === activeCompanyId,
                role: data.ownerId === effectiveUserId ? "OWNER" : "MEMBER",
              });
            }
          });
        } catch (err) {
          console.warn("[WorkspaceSwitcher] Non-fatal error checking email queries:", err);
        }
      }

      // 5. Check if user document has explicit authorizedCompanyIds or assigned organizations
      if (effectiveUserId) {
        try {
          const userDocSnap = await getDoc(doc(db, "users", effectiveUserId));
          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            const authCompanyIds: string[] = uData.authorizedCompanyIds || [];
            for (const cid of authCompanyIds) {
              if (cid && !orgsMap.has(cid)) {
                try {
                  const compSnap = await getDoc(doc(db, "companies", cid));
                  if (compSnap.exists()) {
                    const cData = compSnap.data();
                    orgsMap.set(cid, {
                      id: cid,
                      name: cData.name || `Workspace ${cid.substring(0, 6)}`,
                      legalName: cData.legalName || "",
                      ownerId: cData.ownerId,
                      email: cData.email || cData.officialEmail,
                      plan: cData.subscriptionPlanId || cData.subscriptionPlan || "Team",
                      status: cData.subscriptionStatus || cData.status || "ACTIVE",
                      primaryColor: cData.primaryColor || "#0F172A",
                      secondaryColor: cData.secondaryColor || "#3B82F6",
                      letterheadLogo: cData.letterheadLogo || "",
                      isOwner: cData.ownerId === effectiveUserId,
                      isCurrent: cid === activeCompanyId,
                      role: cData.ownerId === effectiveUserId ? "OWNER" : "STAFF",
                    });
                  }
                } catch {
                  // Non-fatal single org fetch error
                }
              }
            }
          }
        } catch (err) {
          console.warn("[WorkspaceSwitcher] Error fetching authorized company ids:", err);
        }
      }

      // 6. If Master Admin, load all registered companies across the tenant ecosystem
      if (isMasterAdmin) {
        try {
          const allCompsSnap = await getDocs(query(collection(db, "companies"), limit(35)));
          allCompsSnap.forEach((docSnap) => {
            if (!orgsMap.has(docSnap.id)) {
              const data = docSnap.data();
              orgsMap.set(docSnap.id, {
                id: docSnap.id,
                name: data.name || `Tenant ${docSnap.id.substring(0, 6)}`,
                legalName: data.legalName || "",
                ownerId: data.ownerId,
                email: data.email || data.officialEmail,
                plan: data.subscriptionPlanId || data.subscriptionPlan || "Enterprise",
                status: data.subscriptionStatus || data.status || "ACTIVE",
                primaryColor: data.primaryColor || "#0F172A",
                secondaryColor: data.secondaryColor || "#3B82F6",
                letterheadLogo: data.letterheadLogo || "",
                isOwner: data.ownerId === effectiveUserId,
                isCurrent: docSnap.id === activeCompanyId,
                role: "MASTER_ADMIN",
              });
            }
          });
        } catch (err) {
          console.warn("[WorkspaceSwitcher] Error fetching all companies for Master Admin:", err);
        }
      }

      // Convert map to list and sort: active workspace first, then alphabetically
      const orgsList = Array.from(orgsMap.values()).map(org => ({
        ...org,
        isCurrent: org.id === activeCompanyId
      }));

      orgsList.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return a.name.localeCompare(b.name);
      });

      setOrganizations(orgsList);
    } catch (error) {
      console.error("[WorkspaceSwitcher] Error loading workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and whenever currentCompany or user changes
  useEffect(() => {
    loadUserOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, effectiveUserId, effectiveEmail]);

  // Click outside and Escape key handler to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Handle switching workspace
  const handleSelectWorkspace = async (org: WorkspaceOrg) => {
    if (org.id === activeCompanyId) {
      setIsOpen(false);
      return;
    }

    setSwitchingId(org.id);
    try {
      await onSwitchWorkspace(org.id, org);
      addToast(`Switched active workspace to "${org.name}"`, "success");
      setIsOpen(false);
    } catch (err: any) {
      console.error("[WorkspaceSwitcher] Switch failed:", err);
      addToast(err?.message || "Failed to switch workspace.", "error");
    } finally {
      setSwitchingId(null);
    }
  };

  // Filter organizations based on search input
  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const queryLower = searchQuery.toLowerCase().trim();
    return organizations.filter(org => 
      org.name.toLowerCase().includes(queryLower) ||
      (org.legalName && org.legalName.toLowerCase().includes(queryLower)) ||
      (org.email && org.email.toLowerCase().includes(queryLower)) ||
      org.id.toLowerCase().includes(queryLower)
    );
  }, [organizations, searchQuery]);

  const currentOrg: WorkspaceOrg = useMemo(() => {
    return organizations.find(o => o.id === activeCompanyId) || {
      id: activeCompanyId,
      name: currentCompany?.name || "Mira Workspace",
      plan: currentCompany?.subscriptionPlanId || "Active",
      role: isMasterAdmin ? "MASTER_ADMIN" : "ADMIN",
      primaryColor: currentCompany?.primaryColor || "#0F172A",
      letterheadLogo: (currentCompany as any)?.letterheadLogo,
      isOwner: currentCompany?.ownerId === currentUser?.id,
    };
  }, [organizations, activeCompanyId, currentCompany, isMasterAdmin, currentUser?.id]);

  // Generate initials for organization
  const getInitials = (name: string) => {
    const parts = (name || "MW").trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name || "M").substring(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-workspace-switcher-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadUserOrganizations();
          }
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-3xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 ${
          isMobile ? "max-w-[170px]" : "max-w-[240px]"
        } ${isOpen ? "ring-2 ring-blue-500/20 border-blue-400 bg-blue-50/20" : ""}`}
        title={`Current Workspace: ${currentOrg.name}`}
      >
        {/* Organization Avatar */}
        <div 
          className="h-6 w-6 rounded-lg flex items-center justify-center font-black text-[10px] text-white flex-shrink-0 shadow-xs overflow-hidden"
          style={{ backgroundColor: currentOrg.primaryColor || "#2563EB" }}
        >
          {(currentOrg as any).letterheadLogo ? (
            <img 
              src={(currentOrg as any).letterheadLogo} 
              alt={currentOrg.name} 
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to text initials if image fails
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <span>{getInitials(currentOrg.name)}</span>
          )}
        </div>

        {/* Text Details */}
        <div className="flex flex-col items-start min-w-0 text-left flex-1">
          <span className="text-[11px] font-extrabold text-slate-900 truncate w-full leading-tight">
            {currentOrg.name}
          </span>
          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 leading-none mt-0.5 truncate">
            {isMasterAdmin ? (
              <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" /> Omniscient
              </span>
            ) : currentOrg.isOwner ? (
              <span className="text-amber-600 font-bold flex items-center gap-0.5">
                <Crown className="h-2.5 w-2.5" /> Owner
              </span>
            ) : (
              <span>Workspace</span>
            )}
          </span>
        </div>

        {/* Down indicator */}
        <ChevronsUpDown className={`h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-600" : ""}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          id="workspace-switcher-dropdown"
          className={`absolute z-50 mt-1.5 w-80 max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            isMobile ? "left-0" : "left-0 md:left-0"
          }`}
        >
          {/* Header section with search */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Select Workspace
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadUserOrganizations}
                  disabled={loading}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                  title="Refresh organizations list"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-blue-600" : ""}`} />
                </button>
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[9px] font-extrabold">
                  {organizations.length}
                </span>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations by name or ID..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Master Admin Indicator Banner */}
          {isMasterAdmin && (
            <div className="px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100/60 flex items-center justify-between text-[10px] font-bold text-indigo-900">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                <span>Master Admin: Omni-Tenant Multi-Access</span>
              </div>
              <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">
                Full Access
              </span>
            </div>
          )}

          {/* Organizations List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-50">
            {loading && organizations.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Discovering registered workspaces...</p>
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="py-8 text-center space-y-2 px-4">
                <AlertCircle className="h-5 w-5 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No organizations found</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  No registered workspace matches &quot;{searchQuery}&quot;.
                </p>
              </div>
            ) : (
              filteredOrgs.map((org) => {
                const isSelected = org.id === activeCompanyId;
                const isSwitchingThis = switchingId === org.id;

                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(org)}
                    disabled={isSwitchingThis}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left cursor-pointer group ${
                      isSelected 
                        ? "bg-blue-50/70 border border-blue-200/80 text-blue-950 shadow-3xs" 
                        : "hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar */}
                      <div 
                        className="h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0 shadow-xs relative overflow-hidden"
                        style={{ backgroundColor: org.primaryColor || "#0F172A" }}
                      >
                        {org.letterheadLogo ? (
                          <img 
                            src={org.letterheadLogo} 
                            alt={org.name} 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span>{getInitials(org.name)}</span>
                        )}
                        {isSelected && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-400 animate-pulse" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate text-slate-900">
                            {org.name}
                          </span>
                          {org.isOwner && (
                            <span className="px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-sm text-[8px] font-black uppercase tracking-wider">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                          <span className="truncate max-w-[120px]">
                            {org.legalName || org.email || `ID: ${org.id.substring(0, 8)}`}
                          </span>
                          {org.plan && (
                            <span className="text-slate-400 font-semibold">• {org.plan}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right action indicator */}
                    <div className="flex items-center pl-2 flex-shrink-0">
                      {isSwitchingThis ? (
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : isSelected ? (
                        <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                          Switch
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              id="btn-workspace-add-organization"
              onClick={() => {
                setIsOpen(false);
                if (onRegisterNewOrg) {
                  onRegisterNewOrg();
                } else {
                  addToast("Please proceed to Company Onboarding to register an additional organization.", "info");
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-3xs transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
              <span>Create / Add Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
