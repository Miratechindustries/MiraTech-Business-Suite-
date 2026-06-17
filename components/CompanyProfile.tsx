"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db, auth as importAuth, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { useUserStore } from "../lib/store";
import { Building, Mail, Phone, MapPin, Image as ImageIcon, Loader2, CheckCircle, ShieldAlert } from "lucide-react";
import Image from "next/image";

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
  useCompanyLetterhead?: boolean;
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
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [letterheadLogo, setLetterheadLogo] = useState("");
  const [logo, setLogo] = useState("");
  const [favicon, setFavicon] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0F172A");
  const [secondaryColor, setSecondaryColor] = useState("#3B82F6");
  const [useCompanyLetterhead, setUseCompanyLetterhead] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(900); // 15 mins default

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
          setPhone(data.phone || "");
          setAddress(data.address || "");
          setLetterheadLogo(data.letterheadLogo || "");
          setLogo(data.logo || "");
          setFavicon(data.favicon || "");
          setPrimaryColor(data.primaryColor || "#0F172A");
          setSecondaryColor(data.secondaryColor || "#3B82F6");
          setUseCompanyLetterhead(data.useCompanyLetterhead || false);
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
  }, [onCompanyLoaded, currentUser]);

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

  const user = auth.currentUser;
  const isAdminUser = 
    currentUser?.role?.toUpperCase() === 'BUSINESS_ADMIN' || 
    currentUser?.role?.toUpperCase() === 'MASTER_ADMIN' ||
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
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Company Email Address
              </label>
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
          <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/30 space-y-2 mt-2">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Primary Color
              </label>
              <input
                type="color"
                disabled={!isAdminUser}
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg cursor-pointer disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Secondary Color
              </label>
              <input
                type="color"
                disabled={!isAdminUser}
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full h-10 border border-slate-200 rounded-lg cursor-pointer disabled:opacity-50"
              />
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
  );
}
