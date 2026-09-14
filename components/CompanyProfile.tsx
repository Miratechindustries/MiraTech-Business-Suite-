"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { Building, Mail, Phone, MapPin, Image as ImageIcon, Loader2, CheckCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import SystemPermissions from "./SystemPermissions";
import DepartmentManager from "./DepartmentManager";

interface CompanyData {
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  letterheadLogo: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  verifiedEmail?: string;
  useCompanyLetterhead?: boolean;
  letterheadWidthFit?: boolean;
  inactivityTimeout?: number;
  themePreset?: string;
  themeMode?: "light" | "warm" | "dim" | "dark";
  fontFamily?: "inter" | "space_grotesk" | "playfair" | "jetbrains_mono" | "outfit";
  cardRadius?: "none" | "md" | "lg" | "xl" | "full";
  sidebarStyle?: "flat" | "colored" | "gradient" | "bordered";
}

interface CompanyProfileProps {
  onCompanyLoaded?: (company: CompanyData | null) => void;
}

export default function CompanyProfile({ onCompanyLoaded }: CompanyProfileProps) {
  const { currentUser } = useUserStore();

  // Local auth shadowing to redirect all queries to the correct shared company workspace
  const auth = {
    ...importAuth,
    get currentUser() {
      const liveUser = importAuth.currentUser;
      if (!liveUser) return null;
      const companyId = currentUser?.companyId || currentUser?.businessId || liveUser.uid;
      return {
        ...liveUser,
        uid: companyId,
        getIdToken: (forceRefresh?: boolean) => liveUser.getIdToken(forceRefresh),
        getIdTokenResult: (forceRefresh?: boolean) => liveUser.getIdTokenResult(forceRefresh),
      } as any;
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [letterheadLogo, setLetterheadLogo] = useState("");
  const [logo, setLogo] = useState("");
  const [favicon, setFavicon] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0F172A");
  const [secondaryColor, setSecondaryColor] = useState("#3B82F6");
  const [useCompanyLetterhead, setUseCompanyLetterhead] = useState(false);
  const [letterheadWidthFit, setLetterheadWidthFit] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(900); // 15 mins default
  const [themePreset, setThemePreset] = useState("default");
  const [themeMode, setThemeMode] = useState<"light" | "warm" | "dim" | "dark">("light");
  const [fontFamily, setFontFamily] = useState<"inter" | "space_grotesk" | "playfair" | "jetbrains_mono" | "outfit">("inter");
  const [cardRadius, setCardRadius] = useState<"none" | "md" | "lg" | "xl" | "full">("md");
  const [sidebarStyle, setSidebarStyle] = useState<"flat" | "colored" | "gradient" | "bordered">("flat");

  const applyPresetColors = (preset: string) => {
    setThemePreset(preset);
    switch (preset) {
      case "default":
        setPrimaryColor("#0F172A");
        setSecondaryColor("#3B82F6");
        setFontFamily("inter");
        break;
      case "emerald":
        setPrimaryColor("#064E3B");
        setSecondaryColor("#10B981");
        setFontFamily("outfit");
        break;
      case "violet":
        setPrimaryColor("#4C1D95");
        setSecondaryColor("#8B5CF6");
        setFontFamily("outfit");
        break;
      case "crimson":
        setPrimaryColor("#7F1D1D");
        setSecondaryColor("#EF4444");
        setFontFamily("space_grotesk");
        break;
      case "sunset":
        setPrimaryColor("#7C2D12");
        setSecondaryColor("#F97316");
        setFontFamily("space_grotesk");
        break;
      case "nordic":
        setPrimaryColor("#334155");
        setSecondaryColor("#64748B");
        setFontFamily("jetbrains_mono");
        break;
      case "cyberpunk":
        setPrimaryColor("#030712");
        setSecondaryColor("#10B981");
        setFontFamily("jetbrains_mono");
        break;
      case "royal":
        setPrimaryColor("#451A03");
        setSecondaryColor("#D97706");
        setFontFamily("playfair");
        break;
    }
  };

  useEffect(() => {
    const cachedTimeout = localStorage.getItem("mira_inactivity_timeout");
    if (cachedTimeout) {
      setInactivityTimeout(Number(cachedTimeout));
    }
  }, []);

  useEffect(() => {
    async function fetchCompany() {
      const user = auth.currentUser;
      if (!user || !currentUser) {
        if (!user) {
          setLoading(false);
        }
        return;
      }

      const companyDocPath = `companies/${user.uid}`;
      try {
        const docRef = doc(db, "companies", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as CompanyData;
          setName(data.name || "");
          setEmail(data.email || "");
          setIsVerified(!!(data.isVerified || data.isEmailVerified));
          setPhone(data.phone || "");
          setAddress(data.address || "");
          setLetterheadLogo(data.letterheadLogo || "");
          setLogo(data.logo || "");
          setFavicon(data.favicon || "");
          setPrimaryColor(data.primaryColor || "#0F172A");
          setSecondaryColor(data.secondaryColor || "#3B82F6");
          setUseCompanyLetterhead(data.useCompanyLetterhead || false);
          setLetterheadWidthFit(data.letterheadWidthFit || false);
          setThemePreset(data.themePreset || "default");
          setThemeMode(data.themeMode || "light");
          setFontFamily(data.fontFamily || "inter");
          setCardRadius(data.cardRadius || "md");
          setSidebarStyle(data.sidebarStyle || "flat");
          if (typeof data.inactivityTimeout === "number") {
            setInactivityTimeout(data.inactivityTimeout);
            localStorage.setItem("mira_inactivity_timeout", String(data.inactivityTimeout));
          }
          localStorage.setItem(`miratech_offline_company_${user.uid}`, JSON.stringify(data));
          if (onCompanyLoaded) onCompanyLoaded(data);
        } else {
          const cached = localStorage.getItem(`miratech_offline_company_${user.uid}`);
          if (cached) {
            const data = JSON.parse(cached) as CompanyData;
            setName(data.name || "");
            setEmail(data.email || "");
            setPhone(data.phone || "");
            setAddress(data.address || "");
            setLetterheadLogo(data.letterheadLogo || "");
            setLogo(data.logo || "");
            setFavicon(data.favicon || "");
            setPrimaryColor(data.primaryColor || "#0F172A");
            setSecondaryColor(data.secondaryColor || "#3B82F6");
            setUseCompanyLetterhead(data.useCompanyLetterhead || false);
            setLetterheadWidthFit(data.letterheadWidthFit || false);
            setThemePreset(data.themePreset || "default");
            setThemeMode(data.themeMode || "light");
            setFontFamily(data.fontFamily || "inter");
            setCardRadius(data.cardRadius || "md");
            setSidebarStyle(data.sidebarStyle || "flat");
            if (typeof data.inactivityTimeout === "number") {
              setInactivityTimeout(data.inactivityTimeout);
              localStorage.setItem("mira_inactivity_timeout", String(data.inactivityTimeout));
            }
            if (onCompanyLoaded) onCompanyLoaded(data);
          } else {
            if (onCompanyLoaded) onCompanyLoaded(null);
          }
        }
      } catch (err) {
        if (isOfflineError(err)) {
          console.warn("[CompanyProfile Offline Fallback] Loading company profile from local cache.");
          const cached = localStorage.getItem(`miratech_offline_company_${user.uid}`);
          if (cached) {
            const data = JSON.parse(cached) as CompanyData;
            setName(data.name || "");
            setEmail(data.email || "");
            setPhone(data.phone || "");
            setAddress(data.address || "");
            setLetterheadLogo(data.letterheadLogo || "");
            setLogo(data.logo || "");
            setFavicon(data.favicon || "");
            setPrimaryColor(data.primaryColor || "#0F172A");
            setSecondaryColor(data.secondaryColor || "#3B82F6");
            setUseCompanyLetterhead(data.useCompanyLetterhead || false);
            setLetterheadWidthFit(data.letterheadWidthFit || false);
            setThemePreset(data.themePreset || "default");
            setThemeMode(data.themeMode || "light");
            setFontFamily(data.fontFamily || "inter");
            setCardRadius(data.cardRadius || "md");
            setSidebarStyle(data.sidebarStyle || "flat");
            if (typeof data.inactivityTimeout === "number") {
              setInactivityTimeout(data.inactivityTimeout);
              localStorage.setItem("mira_inactivity_timeout", String(data.inactivityTimeout));
            }
            if (onCompanyLoaded) onCompanyLoaded(data);
          } else {
            if (onCompanyLoaded) onCompanyLoaded(null);
          }
        } else {
          handleFirestoreError(err, OperationType.GET, companyDocPath);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCompany();
  }, [onCompanyLoaded, currentUser, auth.currentUser]);

  const handleLetterheadLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3145728) {
      setError("Image budget error: Please upload a lighter logo (under 3MB) to ensure quick synchronizations.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLetterheadLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3145728) {
      setError("Image budget error: Please upload a lighter logo (under 3MB) to ensure quick synchronizations.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3145728) {
        setError("Image budget error: Favicon must be smaller (under 3MB).");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFavicon(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: CompanyData = {
      ownerId: user.uid,
      name,
      email,
      phone,
      address,
      letterheadLogo,
      logo,
      favicon,
      primaryColor,
      secondaryColor,
      useCompanyLetterhead,
      letterheadWidthFit,
      inactivityTimeout,
      themePreset,
      themeMode,
      fontFamily,
      cardRadius,
      sidebarStyle,
    };

    const companyDocPath = `companies/${user.uid}`;
    try {
      try {
        const compRef = doc(db, "companies", user.uid);
        await setDoc(compRef, payload, { merge: true });

        const bizRef = doc(db, "businesses", user.uid);
        await setDoc(bizRef, payload, { merge: true });

        // Log audit trail for Company Profile update
        await addDoc(collection(db, "audit_logs"), {
          action: "Company Profile Updated",
          detail: `Company profile and brand assets saved. Primary Color: ${primaryColor}, Email: ${email}`,
          timestamp: new Date(),
          user: importAuth.currentUser?.email || "Manager",
          businessId: user.uid
        });

      } catch (err) {
        if (!isOfflineError(err)) throw err;
        console.warn("[CompanyProfile Offline Save] Saving profile locally to local storage.");
      }

      // Save to local cache for both companyId and user.uid
      localStorage.setItem(`miratech_offline_company_${user.uid}`, JSON.stringify(payload));
      setSuccess(true);
      if (onCompanyLoaded) onCompanyLoaded(payload);
      // Let success notification persist a bit longer or fade
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.WRITE, companyDocPath);
      } catch (firestoreErr: any) {
        let msg = firestoreErr.message;
        if (msg.includes("Missing or insufficient permissions")) {
          msg = "Permission Denied: You do not have sufficient permissions to modify the central company profile. Only the Administration level accounts can update this shared workspace.";
        } else {
          try {
            const parsed = JSON.parse(msg);
            msg = parsed.error || msg;
          } catch (_) {}
        }
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const normalizeRole = (role?: string) => {
    if (!role) return "";
    return role.toLowerCase().replace(/[\s_-]+/g, "");
  };

  const user = auth.currentUser;
  const isRoleBusinessAdmin = normalizeRole(currentUser?.role) === "businessadmin";
  const isRoleMasterAdmin = normalizeRole(currentUser?.role) === "masteradmin";

  const isAdminUser = 
    isRoleBusinessAdmin || 
    isRoleMasterAdmin ||
    currentUser?.email?.toLowerCase() === 'miratechindustries@gmail.com' ||
    (user && (user.uid === importAuth.currentUser?.uid));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800">Company Profile Set-up</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure corporate contacts and the letterhead utilized on financial exports.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-5">
        {!isAdminUser && (
          <div className="p-3.5 text-xs bg-amber-50 text-amber-700 border border-amber-250 rounded-xl flex items-start gap-2.5 shadow-3xs">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold block uppercase tracking-wider text-[10px]">View-Only Mode</span>
              <p className="mt-0.5 leading-relaxed">
                You are currently logged in with staffing credentials. Only Company Administrators can modify corporation details, colors, and branding assets.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-100 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">
            <CheckCircle className="h-4 w-4" />
            Company profile saved successfully!
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Legal Company Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Building className="h-4 w-4" />
              </span>
              <input
                type="text"
                required
                disabled={!isAdminUser}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/20 focus:outline-hidden focus:border-slate-400 disabled:opacity-60"
                placeholder="e.g. MiraTech Industries LLC"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Company Email Address
                </label>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified Business Email
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Unverified
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  disabled={!isAdminUser}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/20 focus:outline-hidden focus:border-slate-400 disabled:opacity-60"
                  placeholder="contact@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Corporate Contact Phone
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={!isAdminUser}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/20 focus:outline-hidden focus:border-slate-400 disabled:opacity-60"
                  placeholder="+1 (555) 0199"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Corporate Headquarters Address
            </label>
            <div className="relative">
              <span className="absolute gap-1 left-0 pt-2.5 pl-3 text-slate-400">
                <MapPin className="h-4 w-4" />
              </span>
              <textarea
                required
                rows={2}
                disabled={!isAdminUser}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/20 focus:outline-hidden focus:border-slate-400 disabled:opacity-60"
                placeholder="120 Corporate Way, Suite 10, Metro City, CA 90001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Company Letterhead Logo
            </label>
            <div className="border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/30 flex flex-col items-center justify-center text-center">
              {letterheadLogo ? (
                <div className="space-y-2">
                  <Image
                    src={letterheadLogo}
                    alt="Uploaded Logo Preview"
                    width={100}
                    height={100}
                    className="max-h-24 mx-auto rounded-md object-contain border border-slate-100 bg-white p-2"
                    referrerPolicy="no-referrer"
                  />
                  {isAdminUser && (
                    <div className="flex gap-2 justify-center">
                      <label className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800 underline">
                        Change Letterhead Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLetterheadLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="inline-block p-2 bg-slate-100 text-slate-500 rounded-full mb-1">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <p className="text-xs text-slate-600 font-medium">
                    Upload corporate symbol / visual logo
                  </p>
                  <p className="text-[10px] text-slate-400">Supports PNG, JPG (Max 3MB)</p>
                  {isAdminUser && (
                    <label className="cursor-pointer inline-block mt-2 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold rounded-lg shadow-2xs">
                      Choose Image File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLetterheadLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Company Logo and Favicon Uploader & Preview Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/20 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Company Logo
              </label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 bg-white border border-slate-100 rounded-lg flex items-center justify-center p-1 overflow-hidden relative shadow-2xs">
                  {logo ? (
                    <img
                      src={logo}
                      alt="Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-slate-400 block">PNG, JPG (Max 3MB)</span>
                  {isAdminUser ? (
                    <label className="cursor-pointer inline-block px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold rounded-md shadow-3xs">
                      Change Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Upload Disabled</span>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/20 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Favicon (Icon)
              </label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 bg-white border border-slate-100 rounded-lg flex items-center justify-center p-2 overflow-hidden relative shadow-2xs">
                  {favicon ? (
                    <img
                      src={favicon}
                      alt="Icon Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">ICON</span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-slate-400 block">Square Image (Max 3MB)</span>
                  {isAdminUser ? (
                    <label className="cursor-pointer inline-block px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold rounded-md shadow-3xs">
                      Change Icon
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFaviconUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Upload Disabled</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Letterhead stretching Option Selection Checkbox Card */}
          <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/30 space-y-3 mt-2">
            <div className="flex items-start gap-3">
              <input
                id="useCompanyLetterhead"
                type="checkbox"
                disabled={!isAdminUser}
                checked={useCompanyLetterhead}
                onChange={(e) => setUseCompanyLetterhead(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-blue-600 border-slate-300 rounded-sm focus:ring-blue-500 cursor-pointer disabled:opacity-50"
              />
              <div className="space-y-1">
                <label htmlFor="useCompanyLetterhead" className="block text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer select-none">
                  Extend Letterhead as Full-Width Top Banner
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  When enabled, the letterhead logo will span the entire top width of your quotes and invoices, serving as a clean corporate header banner.
                </p>
              </div>
            </div>

            {useCompanyLetterhead && (
              <div className="flex items-start gap-3 pl-7 border-t border-blue-100/30 pt-2 animate-fade-in">
                <input
                  id="letterheadWidthFit"
                  type="checkbox"
                  disabled={!isAdminUser}
                  checked={letterheadWidthFit}
                  onChange={(e) => setLetterheadWidthFit(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-blue-600 border-slate-300 rounded-sm focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                />
                <div className="space-y-1">
                  <label htmlFor="letterheadWidthFit" className="block text-xs font-bold text-slate-800 uppercase tracking-wider cursor-pointer select-none">
                    Stretched Fit (Full Width & Cover)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Check this option if your letterhead logo banner should stretch and crop/cover the entire printable landscape (instead of contain/leaving blanks).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Theme & Typography branding panel */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
              Workspace Theme & Typography Branding
            </h3>

            {/* Presets Grid */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
                1. Select Preset Theme Palette
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "default", name: "Corporate Navy", primary: "#0F172A", secondary: "#3B82F6" },
                  { id: "emerald", name: "Emerald Trust", primary: "#064E3B", secondary: "#10B981" },
                  { id: "violet", name: "Deep Amethyst", primary: "#4C1D95", secondary: "#8B5CF6" },
                  { id: "crimson", name: "Crimson Bold", primary: "#7F1D1D", secondary: "#EF4444" },
                  { id: "sunset", name: "Sunset Warmth", primary: "#7C2D12", secondary: "#F97316" },
                  { id: "nordic", name: "Nordic Slate", primary: "#334155", secondary: "#64748B" },
                  { id: "cyberpunk", name: "Cyberpunk Glow", primary: "#030712", secondary: "#10B981" },
                  { id: "royal", name: "Royal Gold", primary: "#451A03", secondary: "#D97706" }
                ].map((presetItem) => (
                  <button
                    key={presetItem.id}
                    type="button"
                    disabled={!isAdminUser}
                    onClick={() => applyPresetColors(presetItem.id)}
                    className={`p-2 rounded-lg border text-left flex flex-col justify-between h-16 transition cursor-pointer disabled:opacity-50 ${
                      themePreset === presetItem.id
                        ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-700 truncate block">{presetItem.name}</span>
                    <div className="flex gap-1.5 items-center mt-1">
                      <span className="h-4.5 w-4.5 rounded-full border border-slate-200 shadow-3xs" style={{ backgroundColor: presetItem.primary }} />
                      <span className="h-4.5 w-4.5 rounded-full border border-slate-200 shadow-3xs" style={{ backgroundColor: presetItem.secondary }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Primary Color code
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    disabled={!isAdminUser}
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setThemePreset("custom");
                    }}
                    className="w-12 h-8 border border-slate-200 rounded-md cursor-pointer disabled:opacity-50 shrink-0"
                  />
                  <input
                    type="text"
                    disabled={!isAdminUser}
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setThemePreset("custom");
                    }}
                    placeholder="#0F172A"
                    className="flex-1 px-2.5 py-1 text-xs uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Secondary Color code
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    disabled={!isAdminUser}
                    value={secondaryColor}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      setThemePreset("custom");
                    }}
                    className="w-12 h-8 border border-slate-200 rounded-md cursor-pointer disabled:opacity-50 shrink-0"
                  />
                  <input
                    type="text"
                    disabled={!isAdminUser}
                    value={secondaryColor}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      setThemePreset("custom");
                    }}
                    placeholder="#3B82F6"
                    className="flex-1 px-2.5 py-1 text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Canvas Mode Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
                2. Theme Canvas background Mode
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "light", name: "Standard Light", desc: "Crisp white tables", bg: "bg-white text-slate-800 border-slate-200" },
                  { id: "warm", name: "Warm Sand", desc: "Eye-friendly sepia", bg: "bg-[#FAF7F2] text-[#2D2924] border-[#E8E2D9]" },
                  { id: "dim", name: "Executive Dim", desc: "Low-light indigo", bg: "bg-[#252836] text-[#F1F5F9] border-[#374151]" },
                  { id: "dark", name: "Deep Charcoal", desc: "True dark high-tech", bg: "bg-[#0F172A] text-[#F8FAFC] border-[#334155]" }
                ].map((modeItem) => (
                  <button
                    key={modeItem.id}
                    type="button"
                    disabled={!isAdminUser}
                    onClick={() => setThemeMode(modeItem.id as any)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-20 transition cursor-pointer disabled:opacity-50 ${modeItem.bg} ${
                      themeMode === modeItem.id
                        ? "ring-2 ring-blue-500"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <span className="text-[10px] font-bold truncate block">{modeItem.name}</span>
                    <span className="text-[9px] opacity-70 leading-normal block mt-1">{modeItem.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography Pairing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  3. Corporate Typography Font
                </label>
                <select
                  disabled={!isAdminUser}
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                >
                  <option value="inter">Inter (Default - Versatile Sans)</option>
                  <option value="space_grotesk">Space Grotesk (Tech & Geometrical)</option>
                  <option value="playfair">Playfair Display (Premium Editorial Serif)</option>
                  <option value="jetbrains_mono">JetBrains Mono (Technical / Brutalist)</option>
                  <option value="outfit">Outfit (Sophisticated & Clean Sans)</option>
                </select>
              </div>

              {/* Card Radius selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  4. Card Border Roundness (Radius)
                </label>
                <select
                  disabled={!isAdminUser}
                  value={cardRadius}
                  onChange={(e) => setCardRadius(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                >
                  <option value="none">Industrial Flat (Sharp Corners)</option>
                  <option value="md">Classic Corporate (Standard 6px)</option>
                  <option value="lg">Soft Rounded (Modern 8px)</option>
                  <option value="xl">Creative Rounded (Curvy 16px)</option>
                  <option value="full">Organic Capsule (Highly Round 24px)</option>
                </select>
              </div>
            </div>

            {/* Live Interactive Preview Card */}
            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2 mt-2">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Workspace Dynamic Visual Preview</span>
              <div 
                className="p-4 border rounded-xl shadow-3xs flex flex-col justify-between gap-4 transition duration-200"
                style={{
                  backgroundColor: themeMode === 'light' ? '#FFFFFF' : themeMode === 'warm' ? '#FCFAF7' : themeMode === 'dim' ? '#252836' : '#1E293B',
                  borderColor: themeMode === 'light' ? '#E2E8F0' : themeMode === 'warm' ? '#E8E2D9' : themeMode === 'dim' ? '#374151' : '#334155',
                  color: themeMode === 'light' ? '#1E293B' : themeMode === 'warm' ? '#2D2924' : themeMode === 'dim' ? '#F1F5F9' : '#F8FAFC',
                  borderRadius: cardRadius === 'none' ? '0px' : cardRadius === 'md' ? '0.375rem' : cardRadius === 'lg' ? '0.5rem' : cardRadius === 'xl' ? '1rem' : '1.5rem',
                  fontFamily: fontFamily === 'space_grotesk' ? "'Space Grotesk', sans-serif" : fontFamily === 'playfair' ? "'Playfair Display', serif" : fontFamily === 'jetbrains_mono' ? "'JetBrains Mono', monospace" : fontFamily === 'outfit' ? "'Outfit', sans-serif" : "Inter, sans-serif"
                }}
              >
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: themeMode === 'light' ? '#F1F5F9' : themeMode === 'warm' ? '#FAF7F2' : themeMode === 'dim' ? '#323647' : '#2D3748' }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{name || "MIRA SYSTEMS LLC"}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: secondaryColor, color: '#ffffff' }}>Active Theme</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold leading-normal">System Dashboard Overview</p>
                  <p className="text-[10px] opacity-75 leading-relaxed">Dynamic typography pairing, borders, and dark backgrounds synchronized instantly for all tenant employees.</p>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" className="px-3 py-1.5 text-[10px] font-bold text-white rounded-md cursor-default shrink-0" style={{ backgroundColor: primaryColor, borderRadius: cardRadius === 'none' ? '0px' : cardRadius === 'md' ? '0.375rem' : '0.5rem' }}>Primary Action</button>
                  <button type="button" className="px-3 py-1.5 text-[10px] font-bold text-white rounded-md cursor-default shrink-0" style={{ backgroundColor: secondaryColor, borderRadius: cardRadius === 'none' ? '0px' : cardRadius === 'md' ? '0.375rem' : '0.5rem' }}>Accent Option</button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border border-indigo-100 rounded-xl bg-slate-50/70 space-y-3.5 mt-3">
            <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-widest">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              Enterprise Inactivity Controls
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 leading-relaxed">
                Session Inactivity Auto-Logout Timeout
              </label>
              <select
                disabled={!isAdminUser}
                value={inactivityTimeout}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setInactivityTimeout(val);
                  localStorage.setItem("mira_inactivity_timeout", String(val));
                }}
                className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white focus:outline-hidden focus:border-slate-500 shadow-3xs disabled:opacity-60"
              >
                <option value="30">30 Seconds (Fast Simulation / Testing)</option>
                <option value="120">2 Minutes</option>
                <option value="300">5 Minutes</option>
                <option value="900">15 Minutes (Recommended Default)</option>
                <option value="1800">30 Minutes</option>
                <option value="3600">1 Hour</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-semibold">
                Sets the maximum idle duration before a warnings window alerts the user, followed by dynamic auto-logout. Meets SOC2 compliance specs.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name || !isAdminUser}
          className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 disabled:opacity-50 text-sm cursor-pointer shadow-xs transition"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving Changes...
            </>
          ) : (
            "Save Company Settings"
          )}
        </button>
      </form>
    </div>
    <DepartmentManager />
    <SystemPermissions />
    </>
  );
}
