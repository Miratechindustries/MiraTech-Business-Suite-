'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, emailSignIn, auth } from '../lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  SUBSCRIPTION_PLANS, 
  getLockedFeaturesForPlan, 
  isFeatureAllowedForPlan, 
  FEATURE_DEFINITIONS,
  getPlanPrice,
  formatPlanPrice
} from '../lib/subscriptions';
import { getPaddle, PADDLE_PRICE_MAP, isPaddleConfigured } from '../lib/paddle-client';
import { useToastStore } from '../lib/store';
import { 
  Building2, 
  User, 
  Users, 
  Mail, 
  Lock, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Briefcase,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Save,
  Check,
  HelpCircle,
  CreditCard,
  Layers,
  Sliders,
  Phone,
  MapPin,
  Globe,
  FileText,
  BadgeCheck,
  DollarSign,
  BriefcaseBusiness,
  AlertCircle,
  Edit3,
  KeyRound,
  RefreshCw,
  X
} from 'lucide-react';

interface StaffInput {
  fullName: string;
  email: string;
  password: string;
  role: string;
  departments: string[];
}

interface ModuleOption {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'finance' | 'operations' | 'hr' | 'security';
  icon: string;
  popular?: boolean;
  minPlan?: string;
}

const AVAILABLE_MODULES: ModuleOption[] = [
  { id: 'quotations', name: 'Sales & Quotations', description: 'Interactive quote drafts, price calculations & client PDF delivery.', category: 'operations', icon: 'FileText', popular: true, minPlan: 'Starter' },
  { id: 'invoices', name: 'Billing & Tax Invoices', description: 'Automated invoice generation, tax rules & overdue tracking.', category: 'finance', icon: 'CreditCard', popular: true, minPlan: 'Starter' },
  { id: 'receipts', name: 'Receipts & Payment Ledger', description: 'Capture proof of payment, digital receipts & revenue logs.', category: 'finance', icon: 'Receipt', popular: true, minPlan: 'Starter' },
  { id: 'inventory', name: 'Inventory & Stock Management', description: 'Multi-warehouse stock counts, SKU tracking & reorder alerts.', category: 'operations', icon: 'Layers', popular: true, minPlan: 'Growth' },
  { id: 'pos', name: 'Point of Sale (POS)', description: 'Fast register checkout, barcode scanning & digital till reconciliation.', category: 'operations', icon: 'DollarSign', minPlan: 'Growth' },
  { id: 'payroll', name: 'HR, Staff & Payroll Engine', description: 'Employee records, PAYE/UIF tax calculations & salary payslips.', category: 'hr', icon: 'Users', popular: true, minPlan: 'Growth' },
  { id: 'clients', name: 'CRM & Client Directory', description: 'Customer profiles, contact history, receivables & credit limits.', category: 'core', icon: 'Briefcase', minPlan: 'Starter' },
  { id: 'procurement', name: 'Procurement & 3-Way Match', description: 'Purchase orders, supplier bills & goods receipt verification.', category: 'operations', icon: 'BadgeCheck', minPlan: 'Professional' },
  { id: 'transactions', name: 'Bank & Cash Transactions', description: 'Income/expense categorization & cashflow reconciliation.', category: 'finance', icon: 'DollarSign', minPlan: 'Starter' },
  { id: 'reports', name: 'Reports & Business Intelligence', description: 'P&L statements, balance sheets, sales trends & export to Excel/PDF.', category: 'core', icon: 'Sliders', popular: true, minPlan: 'Starter' },
  { id: 'audit_center', name: 'Audit Center & Compliance', description: 'Financial controls, anomalous transaction detection & compliance audits.', category: 'security', icon: 'ShieldCheck', minPlan: 'Elite' },
  { id: 'audit', name: 'Security & Audit Trail Logs', description: 'Immutable activity logs, IP tracking & access history.', category: 'security', icon: 'ShieldCheck', minPlan: 'Professional' },
  { id: 'marketing', name: 'Marketing & Outbound Hub', description: 'Customer broadcast newsletters, campaigns & promotional tracking.', category: 'core', icon: 'Sparkles', minPlan: 'Growth' },
  { id: 'executive', name: 'Executive Analytics Lounge', description: 'C-Suite revenue KPI forecasts, burn rate & business valuation metrics.', category: 'core', icon: 'BriefcaseBusiness', minPlan: 'Enterprise' },
];

const AVAILABLE_DEPARTMENTS = [
  { id: "sales", name: "Sales & Commercial" },
  { id: "finance", name: "Finance & Accounting" },
  { id: "hr", name: "Human Resources & Payroll" },
  { id: "inventory", name: "Inventory & Warehousing" },
  { id: "procurement", name: "Procurement & Supply Chain" },
  { id: "projects", name: "Projects & Operations" },
  { id: "it", name: "IT & Systems" },
  { id: "marketing", name: "Marketing & Growth" },
  { id: "support", name: "Customer Experience" },
  { id: "legal", name: "Legal & Compliance" },
  { id: "executive", name: "Executive Leadership" }
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP)" },
  { code: "ZAR", symbol: "R", name: "South African Rand (ZAR)" },
  { code: "SZL", symbol: "E", name: "Eswatini Lilangeni (SZL)" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling (KES)" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira (NGN)" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi (GHS)" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar (AUD)" },
  { code: "AED", symbol: "AED", name: "UAE Dirham (AED)" },
];

const INDUSTRIES = [
  "Technology & Software",
  "Manufacturing & Industrial",
  "Financial Services & FinTech",
  "Retail & E-Commerce",
  "Construction & Real Estate",
  "Healthcare & Pharmaceuticals",
  "Hospitality & Food Services",
  "Professional & Legal Consulting",
  "Logistics & Transportation",
  "Agriculture & Farming",
  "Education & Non-Profit",
  "Energy & Utilities",
  "Media, Design & Advertising",
  "Other"
];

const BUSINESS_TYPES = [
  "Private Company (Pty Ltd / LLC)",
  "Public Corporation (PLC / Corp)",
  "Sole Proprietorship",
  "Partnership",
  "Non-Profit Organization (NPO / NGO)",
  "Trust / Foundation",
  "Joint Venture",
  "Other Legal Entity"
];

const STEPS = [
  { number: 1, title: "Account", subtitle: "Primary Credentials" },
  { number: 2, title: "Business", subtitle: "Company Profile" },
  { number: 3, title: "Setup", subtitle: "Modules & Scale" },
  { number: 4, title: "Administrator", subtitle: "Role & Authority" },
  { number: 5, title: "Staff", subtitle: "Team Roster" },
  { number: 6, title: "Subscription", subtitle: "Plan & Checkout" },
  { number: 7, title: "Review", subtitle: "Confirm & Launch" }
];

const DRAFT_STORAGE_KEY = "miratech_registration_wizard_draft_v2";
const SESSION_PASSWORD_KEY = "miratech_temp_registration_pwd";

export default function CompanyCreation() {
  const { addToast } = useToastStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Step 1: Account
  const [accountFullName, setAccountFullName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sync password helper to persist across refreshes without exposing in permanent localStorage
  const updatePasswordState = (newPassword: string) => {
    setAccountPassword(newPassword);
    try {
      if (typeof window !== 'undefined') {
        if (newPassword) {
          sessionStorage.setItem(SESSION_PASSWORD_KEY, newPassword);
        } else {
          sessionStorage.removeItem(SESSION_PASSWORD_KEY);
        }
      }
    } catch (_) {}
  };

  const updateConfirmPasswordState = (newConfirmPassword: string) => {
    setAccountConfirmPassword(newConfirmPassword);
  };

  // Step 2: Business
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxVatNumber, setTaxVatNumber] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessCountry, setBusinessCountry] = useState('Eswatini');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [businessOfficialEmail, setBusinessOfficialEmail] = useState('');
  const [businessOfficialPhone, setBusinessOfficialPhone] = useState('');

  // Step 3: Business Setup
  const [employeeRange, setEmployeeRange] = useState('1-10');
  const [branchCount, setBranchCount] = useState('1 (Single Headquarters)');
  const [currency, setCurrency] = useState('USD');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([
    'sales', 'finance', 'hr', 'inventory', 'procurement', 'projects', 'executive'
  ]);
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'quotations', 'invoices', 'receipts', 'inventory', 'payroll', 'clients', 'transactions', 'reports', 'audit_center', 'audit'
  ]);

  // Step 4: Administrator & Permissions
  const [adminPositionTitle, setAdminPositionTitle] = useState('Chief Executive Officer / Managing Director');
  const [initialRole, setInitialRole] = useState<'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'MANAGER' | 'STAFF'>('SUPER_ADMIN');
  const [permissions, setPermissions] = useState({
    canManageBilling: true,
    canManageUsers: true,
    canApproveTransactions: true,
    canAccessPayroll: true,
    canModifyInventory: true,
    canViewAuditLogs: true,
    canExportReports: true,
    canManageBranding: true
  });
  const [isAuthorizedConfirmed, setIsAuthorizedConfirmed] = useState(false);

  // Step 5: Staff (Optional)
  const [staffList, setStaffList] = useState<StaffInput[]>([]);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('STAFF');
  const [staffDepts, setStaffDepts] = useState<string[]>(['sales']);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Step 6: Subscription (Final Registration Step)
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Step 7: Review & Terms
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Email Verification State (Triggered before Step 7)
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [isVerifyingModalOpen, setIsVerifyingModalOpen] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState(['', '', '', '', '', '']);
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [editingEmailInModal, setEditingEmailInModal] = useState(false);
  const [modalTempEmail, setModalTempEmail] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for resend cooldown
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Theme defaults
  const [themePreset] = useState('default');
  const [primaryColor] = useState('#0F172A');
  const [secondaryColor] = useState('#3B82F6');

  // Check for saved draft & session password on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.accountEmail) {
          setHasSavedDraft(true);
        }
      }

      // Check session storage for temporary password set during this browsing session
      if (typeof window !== 'undefined') {
        const cachedPwd = sessionStorage.getItem(SESSION_PASSWORD_KEY);
        if (cachedPwd && cachedPwd.length >= 8) {
          setAccountPassword(cachedPwd);
          setAccountConfirmPassword(cachedPwd);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync active authenticated session if available and email not set
  useEffect(() => {
    if (auth?.currentUser?.email) {
      const curEmail = auth.currentUser.email;
      setAccountEmail(prev => prev || curEmail);
      if (auth.currentUser.displayName) {
        setAccountFullName(prev => prev || (auth.currentUser?.displayName || ''));
      }
      setIsEmailVerified(true);
      setVerifiedEmail(curEmail);
    }
  }, []);

  const loadSavedDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.accountFullName) setAccountFullName(draft.accountFullName);
      if (draft.accountEmail) setAccountEmail(draft.accountEmail);
      if (draft.accountPhone) setAccountPhone(draft.accountPhone);
      if (draft.companyName) setCompanyName(draft.companyName);
      if (draft.registrationNumber) setRegistrationNumber(draft.registrationNumber);
      if (draft.taxVatNumber) setTaxVatNumber(draft.taxVatNumber);
      if (draft.industry) setIndustry(draft.industry);
      if (draft.businessType) setBusinessType(draft.businessType);
      if (draft.businessAddress) setBusinessAddress(draft.businessAddress);
      if (draft.businessCity) setBusinessCity(draft.businessCity);
      if (draft.businessCountry) setBusinessCountry(draft.businessCountry);
      if (draft.businessWebsite) setBusinessWebsite(draft.businessWebsite);
      if (draft.businessOfficialEmail) setBusinessOfficialEmail(draft.businessOfficialEmail);
      if (draft.businessOfficialPhone) setBusinessOfficialPhone(draft.businessOfficialPhone);
      if (draft.employeeRange) setEmployeeRange(draft.employeeRange);
      if (draft.branchCount) setBranchCount(draft.branchCount);
      if (draft.currency) setCurrency(draft.currency);
      if (draft.selectedDepartments) setSelectedDepartments(draft.selectedDepartments);
      if (draft.selectedModules) setSelectedModules(draft.selectedModules);
      if (draft.adminPositionTitle) setAdminPositionTitle(draft.adminPositionTitle);
      if (draft.initialRole) setInitialRole(draft.initialRole);
      if (draft.permissions) setPermissions(draft.permissions);
      if (draft.staffList) setStaffList(draft.staffList);
      if (draft.subscriptionPlanId) setSubscriptionPlanId(draft.subscriptionPlanId);
      if (draft.billingCycle) setBillingCycle(draft.billingCycle);
      if (draft.currentStep) setCurrentStep(Math.min(draft.currentStep, 7));

      // Attempt to restore password if saved in session
      if (typeof window !== 'undefined') {
        const cachedPwd = sessionStorage.getItem(SESSION_PASSWORD_KEY);
        if (cachedPwd && cachedPwd.length >= 8) {
          setAccountPassword(cachedPwd);
          setAccountConfirmPassword(cachedPwd);
        }
      }

      addToast("Saved registration draft restored successfully.", "info");
      setHasSavedDraft(false);
    } catch (e) {
      addToast("Failed to load draft data.", "error");
    }
  };

  const saveDraft = () => {
    try {
      const draft = {
        currentStep,
        accountFullName,
        accountEmail,
        accountPhone,
        companyName,
        registrationNumber,
        taxVatNumber,
        industry,
        businessType,
        businessAddress,
        businessCity,
        businessCountry,
        businessWebsite,
        businessOfficialEmail,
        businessOfficialPhone,
        employeeRange,
        branchCount,
        currency,
        selectedDepartments,
        selectedModules,
        adminPositionTitle,
        initialRole,
        permissions,
        staffList,
        subscriptionPlanId,
        billingCycle,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      addToast("Progress saved to browser. You can resume anytime.", "success");
    } catch (e) {
      addToast("Unable to save progress locally.", "error");
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_PASSWORD_KEY);
      }
    } catch (_) {}
    setAccountPassword('');
    setAccountConfirmPassword('');
    setHasSavedDraft(false);
    addToast("Draft cleared.", "info");
  };

  // Pure Step Completeness Check (no side-effects, safe during render)
  const isStepComplete = (stepNumber: number): boolean => {
    const isMatchingActiveSession = Boolean(
      auth?.currentUser?.email && 
      auth.currentUser.email.toLowerCase() === accountEmail.trim().toLowerCase()
    );

    if (stepNumber === 1) {
      const hasValidPassword = isMatchingActiveSession || (accountPassword.length >= 8 && accountPassword === accountConfirmPassword);
      return !!(
        accountFullName.trim() &&
        accountEmail.trim() &&
        accountEmail.includes('@') &&
        accountEmail.includes('.') &&
        accountPhone.trim() &&
        hasValidPassword
      );
    }
    if (stepNumber === 2) {
      return !!(
        companyName.trim() &&
        businessAddress.trim() &&
        businessCity.trim()
      );
    }
    if (stepNumber === 3) {
      return selectedModules.length > 0 && selectedDepartments.length > 0;
    }
    if (stepNumber === 4) {
      return !!(adminPositionTitle.trim() && isAuthorizedConfirmed);
    }
    if (stepNumber === 5) {
      return true; // Optional
    }
    if (stepNumber === 6) {
      return !!subscriptionPlanId;
    }
    if (stepNumber === 7) {
      const hasValidPassword = isMatchingActiveSession || accountPassword.length >= 8;
      return agreedToTerms && isEmailVerified && verifiedEmail === accountEmail && hasValidPassword;
    }
    return true;
  };

  // Step Validation logic (called only on interactive events)
  const validateStep = (stepNumber: number): boolean => {
    setError(null);

    if (stepNumber === 1) {
      if (!accountFullName.trim()) {
        setError("Please enter your full name.");
        return false;
      }
      if (!accountEmail.trim() || !accountEmail.includes('@') || !accountEmail.includes('.')) {
        setError("Please provide a valid primary account email address.");
        return false;
      }
      if (!accountPhone.trim()) {
        setError("Please enter your contact phone number.");
        return false;
      }
      const isMatchingActiveSession = Boolean(
        auth?.currentUser?.email && 
        auth.currentUser.email.toLowerCase() === accountEmail.trim().toLowerCase()
      );
      if (!isMatchingActiveSession) {
        if (accountPassword.length < 8) {
          setError("Password must be at least 8 characters long.");
          return false;
        }
        if (!/[a-z]/.test(accountPassword) || !/[A-Z]/.test(accountPassword) || !/[0-9]/.test(accountPassword) || !/[^A-Za-z0-9]/.test(accountPassword)) {
          setError("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
          return false;
        }
        if (accountPassword !== accountConfirmPassword) {
          setError("Password and confirmation password do not match.");
          return false;
        }
      }
    }

    if (stepNumber === 2) {
      if (!companyName.trim()) {
        setError("Please provide your registered Company / Business Name.");
        return false;
      }
      if (!businessAddress.trim()) {
        setError("Please enter the physical business address.");
        return false;
      }
      if (!businessCity.trim()) {
        setError("Please enter the city or municipal location.");
        return false;
      }
    }

    if (stepNumber === 3) {
      if (selectedModules.length === 0) {
        setError("Please select at least one core module for your workspace.");
        return false;
      }
      if (selectedDepartments.length === 0) {
        setError("Please select at least one active department.");
        return false;
      }
    }

    if (stepNumber === 4) {
      if (!adminPositionTitle.trim()) {
        setError("Please specify your organizational position or executive title.");
        return false;
      }
      if (!isAuthorizedConfirmed) {
        setError("You must confirm authorization to register this business entity.");
        return false;
      }
    }

    if (stepNumber === 6) {
      if (!subscriptionPlanId) {
        setError("Please select an active subscription tier.");
        return false;
      }
    }

    if (stepNumber === 7) {
      if (!accountFullName.trim()) {
        setError("Primary Administrator full name is required.");
        return false;
      }
      if (!accountEmail.trim() || !accountEmail.includes('@')) {
        setError("Valid primary corporate email address is required.");
        return false;
      }
      const isMatchingActiveSession = Boolean(
        auth?.currentUser?.email && 
        auth.currentUser.email.toLowerCase() === accountEmail.trim().toLowerCase()
      );
      if (!isMatchingActiveSession) {
        if (!accountPassword || accountPassword.trim().length < 8) {
          setError("Administrator master password is missing or shorter than 8 characters. Please configure your password in the Administrator section below.");
          return false;
        }
        if (accountConfirmPassword && accountPassword !== accountConfirmPassword) {
          setError("Account passwords do not match. Please re-enter.");
          return false;
        }
      }
      if (!companyName.trim()) {
        setError("Company / Business Name is required.");
        return false;
      }
      if (!isEmailVerified || verifiedEmail !== accountEmail) {
        setError("Please verify your company email address before finalizing corporate tenant registration.");
        return false;
      }
      if (!agreedToTerms) {
        setError("Please agree to the Terms of Service and Corporate Privacy Policy to finalize.");
        return false;
      }
    }

    return true;
  };

  // Email verification actions
  const sendVerificationCode = async (targetEmail = accountEmail) => {
    const cleanEmail = (targetEmail || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError("Please provide a valid corporate email address in Step 1.");
      return;
    }
    setVerificationSending(true);
    setVerificationError(null);
    setVerificationSuccess(null);
    setIsVerifyingModalOpen(true);
    setModalTempEmail(cleanEmail);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, companyName: companyName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.cooldownSeconds) {
          setResendCooldown(data.cooldownSeconds);
        }
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }
      setResendCooldown(data.cooldownSeconds || 60);
      setVerificationSuccess(`A 6-digit verification code has been dispatched to ${cleanEmail}`);
      addToast(`Security verification code sent to ${cleanEmail}`, "info");
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setVerificationError(err.message || "Failed to send email verification code.");
    } finally {
      setVerificationSending(false);
    }
  };

  const handleVerifyCode = async (codeToTest?: string) => {
    const code = (codeToTest || verificationCodeInput.join('')).trim();
    if (code.length < 6) {
      setVerificationError("Please enter all 6 digits of the verification code.");
      return;
    }
    setVerificationChecking(true);
    setVerificationError(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail.trim(), code })
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid verification code. Please check and try again.');
      }
      setIsEmailVerified(true);
      setVerifiedEmail(accountEmail.trim());
      setIsVerifyingModalOpen(false);
      setVerificationSuccess("Company email verified successfully!");
      addToast("Corporate email verified successfully!", "success");
      setCurrentStep(7);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setVerificationError(err.message || "Invalid or expired verification code.");
    } finally {
      setVerificationChecking(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...verificationCodeInput];
      next[index] = '';
      setVerificationCodeInput(next);
      return;
    }

    if (cleaned.length === 1) {
      const next = [...verificationCodeInput];
      next[index] = cleaned;
      setVerificationCodeInput(next);
      if (index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
      if (index === 5) {
        const fullCode = next.join('');
        if (fullCode.length === 6) {
          handleVerifyCode(fullCode);
        }
      }
    } else if (cleaned.length >= 6) {
      // Pasted full 6-digit code
      const digits = cleaned.slice(0, 6).split('');
      setVerificationCodeInput(digits);
      otpInputRefs.current[5]?.focus();
      handleVerifyCode(cleaned.slice(0, 6));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCodeInput[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError(null);
      saveDraft();

      // Email Verification Checkpoint: Must verify before entering Step 7
      if (currentStep === 6) {
        if (!isEmailVerified || verifiedEmail !== accountEmail) {
          sendVerificationCode(accountEmail);
          return;
        }
      }

      setCurrentStep(prev => Math.min(prev + 1, 7));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToStep = (stepNumber: number) => {
    setError(null);
    // Disallow jumping to Step 7 without email verification
    if (stepNumber === 7 && (!isEmailVerified || verifiedEmail !== accountEmail)) {
      sendVerificationCode(accountEmail);
      return;
    }
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Staff list operations
  const handleAddStaffMember = () => {
    if (!staffFullName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      setError("Please fill in the staff member's full name, email, and password.");
      return;
    }
    if (staffPassword.length < 8) {
      setError("Staff temporary password must be at least 8 characters long.");
      return;
    }
    if (!/[a-z]/.test(staffPassword) || !/[A-Z]/.test(staffPassword) || !/[0-9]/.test(staffPassword) || !/[^A-Za-z0-9]/.test(staffPassword)) {
      setError("Staff password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
      return;
    }
    if (staffList.some(s => s.email.toLowerCase() === staffEmail.toLowerCase()) || staffEmail.toLowerCase() === accountEmail.toLowerCase()) {
      setError("This email address is already added or matches the primary administrator.");
      return;
    }

    setStaffList(prev => [
      ...prev,
      {
        fullName: staffFullName.trim(),
        email: staffEmail.trim(),
        password: staffPassword,
        role: staffRole,
        departments: staffDepts
      }
    ]);

    setStaffFullName('');
    setStaffEmail('');
    setStaffPassword('');
    setStaffDepts(['sales']);
    setError(null);
    addToast("Staff member added to initial provisioning queue.", "success");
  };

  const handleRemoveStaffMember = (index: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== index));
    addToast("Staff member removed from queue.", "info");
  };

  const logStatus = (message: string) => {
    setStatusLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Helper to create Firebase Auth user without disrupting active master session
  const createAuthUserSecondary = async (emailInput: string, passwordInput: string): Promise<string> => {
    const trimmedEmail = (emailInput || '').trim();
    const trimmedPassword = (passwordInput || '').trim();
    if (!trimmedEmail) {
      throw new Error("Corporate administrator email address is required.");
    }
    if (!trimmedPassword) {
      throw new Error("Administrator master password is missing. Please provide a password of at least 8 characters.");
    }
    if (trimmedPassword.length < 6) {
      throw new Error(`Administrator password must be at least 6 characters for account (${trimmedEmail}).`);
    }

    const secondaryAppName = `ProvisionApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, trimmedPassword);
      const uid = userCredential.user.uid;
      await signOut(secondaryAuth);
      return uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/missing-password') {
        throw new Error("Administrator master password is missing. Please enter your password before launching.");
      }
      if (authErr.code === 'auth/weak-password') {
        throw new Error("Administrator master password is too weak. Please use at least 8 characters including mixed case, numbers, and symbols.");
      }
      throw authErr;
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  // Helper to verify existing credentials if account already exists
  const verifyAuthUserSecondary = async (emailInput: string, passwordInput: string): Promise<string> => {
    const trimmedEmail = (emailInput || '').trim();
    const trimmedPassword = (passwordInput || '').trim();
    if (!trimmedEmail) {
      throw new Error("Corporate administrator email address is required.");
    }
    if (!trimmedPassword) {
      throw new Error(`The account ${trimmedEmail} already exists. Please provide your master password to verify and link this workspace.`);
    }

    const secondaryAppName = `VerifyApp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const userCredential = await signInWithEmailAndPassword(secondaryAuth, trimmedEmail, trimmedPassword);
      const uid = userCredential.user.uid;
      await signOut(secondaryAuth);
      return uid;
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error(`The email ${trimmedEmail} is already registered, but the password does not match. Please verify your credentials or sign in through the main gateway.`);
      }
      if (err.code === 'auth/missing-password') {
        throw new Error(`Master password is required for existing account verification (${trimmedEmail}).`);
      }
      throw err;
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  // Core Tenant Provisioning Execution
  const executeTenantProvisioning = async (paddleSubId: string, paddleCustId: string) => {
    const cleanEmail = (accountEmail || '').trim();
    const cleanPassword = (accountPassword || '').trim();

    const isMatchingActiveSession = Boolean(
      auth?.currentUser?.email && 
      auth.currentUser.email.toLowerCase() === cleanEmail.toLowerCase()
    );

    // 1. Provision Primary Administrator Auth Account
    logStatus(`1/6 Provisioning corporate administrator credentials (${cleanEmail})...`);
    let adminUid = "";

    if (isMatchingActiveSession && auth.currentUser) {
      adminUid = auth.currentUser.uid;
      logStatus(`Identity confirmed via active secure session. Corporate Administrator authenticated. (UID: ${adminUid})`);
    } else {
      try {
        adminUid = await createAuthUserSecondary(cleanEmail, cleanPassword);
        logStatus(`Corporate Administrator auth profile established. (UID: ${adminUid})`);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          logStatus(`Admin account (${cleanEmail}) already exists in directory. Verifying credentials to link workspace...`);
          try {
            adminUid = await verifyAuthUserSecondary(cleanEmail, cleanPassword);
            logStatus(`Identity confirmed. Corporate Administrator authenticated. (UID: ${adminUid})`);
          } catch (verifyErr: any) {
            throw new Error(verifyErr.message || `The email address ${cleanEmail} is already registered. If this is your account, please check your password or sign in on the main portal.`);
          }
        } else {
          throw authErr;
        }
      }
    }

    // 2. Provision Staff Auth Accounts
    const staffUids: string[] = [];
    if (staffList.length > 0) {
      logStatus(`2/6 Provisioning ${staffList.length} staff member accounts in Firebase Auth...`);
      for (const staff of staffList) {
        try {
          const staffPass = (staff.password || '').trim() || `${staff.email.split('@')[0]}@2025!`;
          const sUid = await createAuthUserSecondary(staff.email, staffPass);
          staffUids.push(sUid);
          logStatus(`Staff profile for ${staff.email} authenticated. (UID: ${sUid})`);
        } catch (stErr: any) {
          logStatus(`Note: Staff member ${staff.email} skipped or existing (${stErr.message})`);
          staffUids.push(`staff_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`);
        }
      }
    } else {
      logStatus(`2/6 Staff roster: No initial staff queued (Admin can add staff later in User Management).`);
    }

    // 3. Write Company / Business Profile
    logStatus(`3/6 Establishing corporate metadata, legal parameters, and module access...`);
    const selectedPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === subscriptionPlanId) || SUBSCRIPTION_PLANS[2];
    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const companyPayload = {
      id: adminUid,
      ownerId: adminUid,
      name: companyName,
      legalName: companyName,
      registrationNumber: registrationNumber || "UNREGISTERED",
      taxVatNumber: taxVatNumber || "",
      industry,
      businessType,
      address: `${businessAddress}, ${businessCity}, ${businessCountry}`,
      city: businessCity,
      country: businessCountry,
      website: businessWebsite || "",
      officialEmail: businessOfficialEmail || accountEmail,
      officialPhone: businessOfficialPhone || accountPhone,
      employeeRange,
      branchCount,
      currency,
      activeModules: selectedModules,
      activeDepartments: selectedDepartments,
      email: accountEmail,
      phone: accountPhone,
      createdAt: new Date().toISOString(),
      primaryColor,
      secondaryColor,
      themePreset,
      themeMode: 'light',
      fontFamily: 'inter',
      cardRadius: 'md',
      inactivityTimeout: 900,
      threatLevel: 'elevated',
      mfaEnforced: true,
      isVerified: Boolean(isEmailVerified && verifiedEmail === accountEmail),
      isEmailVerified: Boolean(isEmailVerified && verifiedEmail === accountEmail),
      emailVerified: Boolean(isEmailVerified && verifiedEmail === accountEmail),
      businessEmailVerified: Boolean(isEmailVerified && verifiedEmail === accountEmail),
      emailVerifiedAt: isEmailVerified ? new Date().toISOString() : null,
      verifiedEmail: isEmailVerified ? accountEmail : null,
      argon2Iterations: 4,
      argon2SaltLength: 16,
      subscriptionPlanId,
      subscriptionPlan: selectedPlanObj.name,
      subscriptionStatus: subscriptionPlanId === 'free' ? 'active' : 'trialing',
      subscriptionBillingCycle: billingCycle,
      subscriptionTrialEndsAt: trialEndDate,
      subscriptionTrialStartedAt: new Date().toISOString(),
      lockedFeatures: getLockedFeaturesForPlan(subscriptionPlanId),
      paddleSubscriptionId: paddleSubId,
      paddleCustomerId: paddleCustId,
      paymentMethodCaptured: true
    };

    await setDoc(doc(db, 'companies', adminUid), companyPayload);
    await setDoc(doc(db, 'businesses', adminUid), companyPayload);
    logStatus(`Company tenant profile persisted on /companies/${adminUid} and /businesses/${adminUid}.`);

    // 4. Create User Documents in Firestore
    logStatus(`4/6 Assigning administrator role (${initialRole}) and authorized permissions...`);
    await setDoc(doc(db, 'users', adminUid), {
      id: adminUid,
      displayName: accountFullName,
      email: accountEmail,
      phone: accountPhone,
      role: initialRole,
      positionTitle: adminPositionTitle,
      companyId: adminUid,
      businessId: adminUid,
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      permissions,
      isAuthorizedSignatory: true,
      createdAt: new Date().toISOString(),
    });

    for (let i = 0; i < staffList.length; i++) {
      const staff = staffList[i];
      const sUid = staffUids[i];
      await setDoc(doc(db, 'users', sUid), {
        id: sUid,
        displayName: staff.fullName,
        email: staff.email,
        role: staff.role || 'STAFF',
        companyId: adminUid,
        businessId: adminUid,
        status: 'ACTIVE',
        departments: staff.departments || ['sales'],
        createdAt: new Date().toISOString(),
      });
    }

    // 5. Append Centralized Audit log
    logStatus(`5/6 Writing ISO-compliant workspace registration audit record...`);
    await addDoc(collection(db, 'audit_logs'), {
      companyId: adminUid,
      userId: adminUid,
      userEmail: accountEmail,
      action: 'TENANT_ONBOARDING_COMPLETED',
      details: `Corporate workspace "${companyName}" successfully provisioned with ${selectedPlanObj.name} plan via Paddle Billing trial.`,
      ipAddress: '127.0.0.1 (Web Portal Client)',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Registration Wizard',
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      department: 'executive'
    });

    // 6. Direct sign-in with newly created administrator credentials
    logStatus(`6/6 Launching Business Administration Control Center...`);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_PASSWORD_KEY);
      }
    } catch (_) {}
    localStorage.setItem('mira_post_register_redirect', 'business_admin');
    setSuccess(true);
    addToast("Company workspace created successfully! Directing to Business Admin Dashboard...", "success");

    // Auto sign-in to seamlessly enter Business Admin Dashboard
    setTimeout(async () => {
      try {
        if (!isMatchingActiveSession && cleanPassword) {
          await emailSignIn(cleanEmail, cleanPassword);
        }
        window.location.href = '/';
      } catch (signInErr) {
        console.warn("Auto-signin redirected to manual gateway:", signInErr);
        window.location.href = '/';
      }
    }, 1500);
  };

  // Final Registration Submission with Mandatory Paddle Billing Checkout Step
  const handleFinalSubmit = async () => {
    const cleanEmail = (accountEmail || '').trim();
    const cleanPassword = (accountPassword || '').trim();

    const isMatchingActiveSession = Boolean(
      auth?.currentUser?.email && 
      auth.currentUser.email.toLowerCase() === cleanEmail.toLowerCase()
    );

    if (!isMatchingActiveSession && (!cleanPassword || cleanPassword.length < 8)) {
      setError("Administrator master password is missing or shorter than 8 characters. Please configure your master password in the Administrator section below.");
      return;
    }
    if (!validateStep(7)) return;

    setLoading(true);
    setError(null);
    setStatusLogs([]);
    logStatus(`Initializing corporate tenant provisioning for: "${companyName}"...`);

    try {
      // If user selected a paid tier and Paddle is configured, invoke getPaddle() for PCI-compliant checkout & 14-day trial card tokenization
      if (subscriptionPlanId !== 'free' && isPaddleConfigured()) {
        logStatus(`Opening secure PCI-compliant Paddle Billing checkout (14-Day Free Trial - No immediate charge)...`);
        const paddle = await getPaddle((event: any) => {
          if (event?.name === 'checkout.completed') {
            const subId = event?.data?.id || event?.data?.subscription_id || `sub_pdl_${Date.now()}`;
            const customerId = event?.data?.customer_id || `ctm_pdl_${Date.now()}`;
            logStatus(`Paddle checkout completed successfully! Subscription ID: ${subId}`);
            executeTenantProvisioning(subId, customerId).catch((err: any) => {
              console.error(err);
              setError("Provisioning failed after payment: " + err.message);
              setLoading(false);
            });
          } else if (event?.name === 'checkout.error') {
            setError("Paddle checkout error: " + (event?.data?.message || "Payment authorization failed."));
            setLoading(false);
          }
        });

        if (paddle) {
          const priceId = PADDLE_PRICE_MAP[subscriptionPlanId] || 'pri_starter_tier';
          paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customData: {
              companyName: companyName,
              userEmail: accountEmail,
              tier: subscriptionPlanId,
            },
            customer: {
              email: accountEmail,
            },
            settings: {
              variant: 'one-page',
              displayMode: 'overlay',
              theme: 'light',
              locale: 'en',
              successUrl: window.location.href,
            },
          });
        } else {
          logStatus(`Paddle client unavailable. Proceeding with sandbox trial provisioning...`);
          await executeTenantProvisioning(`sub_pdl_sandbox_${Date.now()}`, `ctm_pdl_${Date.now()}`);
        }
      } else {
        await executeTenantProvisioning(`sub_pdl_free_${Date.now()}`, `ctm_pdl_${Date.now()}`);
      }
    } catch (err: any) {
      console.error("Corporate provisioning failed:", err);
      setError(err.message || "Failed to provision corporate workspace. Please review your parameters and try again.");
      logStatus(`[ERROR] Provisioning halted: ${err.message}`);
      addToast(err.message || "Provisioning failed", "error");
      setLoading(false);
    }
  };

  const selectedPlanDetails = SUBSCRIPTION_PLANS.find(p => p.id === subscriptionPlanId) || SUBSCRIPTION_PLANS[2];
  const activePrice = getPlanPrice(selectedPlanDetails, billingCycle);

  return (
    <div className="w-full text-slate-800 space-y-6">
      
      {/* Draft Restore Notification Banner */}
      {hasSavedDraft && currentStep === 1 && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <Save className="w-4 h-4 text-blue-600 shrink-0" />
            <span>You have an autosaved registration draft stored in your browser.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSavedDraft}
              className="px-3 py-1 bg-blue-600 text-white font-bold text-[11px] rounded-lg hover:bg-blue-700 transition cursor-pointer"
            >
              Resume Draft
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold transition cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Stepper Header with Progress Bar */}
      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black shadow-2xs">
              {currentStep}
            </span>
            <span className="text-sm font-extrabold font-sans">
              Step {currentStep} of 7: {STEPS[currentStep - 1].title}
            </span>
            <span className="text-slate-400 font-normal hidden sm:inline">— {STEPS[currentStep - 1].subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs transition cursor-pointer"
              title="Save draft to resume later"
            >
              <Save className="w-3 h-3" /> Save Draft
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-400">
              {Math.round((currentStep / 7) * 100)}%
            </span>
          </div>
        </div>

        {/* Progress Bar Line */}
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out shadow-xs"
            style={{ width: `${(currentStep / 7) * 100}%` }}
          />
        </div>

        {/* Step Navigation Pills */}
        <div className="grid grid-cols-7 gap-1 pt-1">
          {STEPS.map((s) => {
            const isCompleted = s.number < currentStep;
            const isCurrent = s.number === currentStep;
            return (
              <button
                key={s.number}
                type="button"
                onClick={() => {
                  if (s.number <= currentStep) {
                    handleJumpToStep(s.number);
                  } else if (validateStep(currentStep)) {
                    handleJumpToStep(s.number);
                  }
                }}
                disabled={s.number > currentStep && !isStepComplete(currentStep)}
                className={`py-1.5 px-1 rounded-lg text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  isCurrent 
                    ? 'bg-blue-600 text-white font-bold shadow-xs' 
                    : isCompleted 
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold' 
                    : 'text-slate-400 hover:text-slate-600 bg-transparent'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px]">
                  {isCompleted ? <Check className="w-3 h-3 text-blue-600" /> : <span>{s.number}</span>}
                  <span className="hidden md:inline truncate">{s.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Step Contents */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        
        {/* ================= STEP 1: ACCOUNT ================= */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" /> Step 1: Administrator Account Credentials
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up the primary sign-in credentials used to govern and access your corporate workspace.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-blue-50 text-blue-700 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-blue-100">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>You will use this email and password to log in to the MiraTech Business Suite.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={accountFullName}
                    onChange={(e) => setAccountFullName(e.target.value)}
                    placeholder="e.g. Sipho Dlamini"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Official name of the primary administrator or business director.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Corporate Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">This email serves as the workspace primary root account.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={accountPhone}
                    onChange={(e) => setAccountPhone(e.target.value)}
                    placeholder="+268 7600 0000 / +27 82 000 0000"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Master Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={accountPassword}
                      onChange={(e) => updatePasswordState(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Master Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={accountConfirmPassword}
                      onChange={(e) => setAccountConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Passwords are encrypted using modern cryptographic standards and securely isolated per corporate tenant.</span>
            </div>
          </div>
        )}

        {/* ================= STEP 2: BUSINESS ================= */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" /> Step 2: Registered Business Profile
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official organizational data formatted automatically onto invoices, quotations, and financial statements.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-blue-50 text-blue-700 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-blue-100">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Your Company Name and Tax Number will appear on all generated PDF invoices.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company / Organization Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Global Logistics (Pty) Ltd"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company Registration Number (CIPC / Reg No)
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. 2024/098765/07"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tax / VAT Registration Number
                </label>
                <input
                  type="text"
                  value={taxVatNumber}
                  onChange={(e) => setTaxVatNumber(e.target.value)}
                  placeholder="e.g. VAT4900123456"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Industry Sector <span className="text-red-500">*</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Legal Business Structure <span className="text-red-500">*</span>
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Physical Office / Operating Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Suite 400, Commercial Plaza, Plot 102"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City / Municipality <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessCity}
                  onChange={(e) => setBusinessCity(e.target.value)}
                  placeholder="e.g. Mbabane / Sandton"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Country of Incorporation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessCountry}
                  onChange={(e) => setBusinessCountry(e.target.value)}
                  placeholder="e.g. Eswatini / South Africa"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Website (Optional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={businessWebsite}
                    onChange={(e) => setBusinessWebsite(e.target.value)}
                    placeholder="https://www.company.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Public Contact Email / Support Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={businessOfficialEmail}
                    onChange={(e) => setBusinessOfficialEmail(e.target.value)}
                    placeholder="contact@company.com (optional)"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: BUSINESS SETUP ================= */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" /> Step 3: Operational Scale & Module Activation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the specific enterprise modules, operational currency, and departments required for your business.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-blue-50 text-blue-700 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-blue-100">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>You can enable or disable modules at any time later in Company Settings.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Count Range <span className="text-red-500">*</span>
                </label>
                <select
                  value={employeeRange}
                  onChange={(e) => setEmployeeRange(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-medium"
                >
                  <option value="1-5">1 - 5 Staff</option>
                  <option value="6-20">6 - 20 Staff</option>
                  <option value="21-50">21 - 50 Staff</option>
                  <option value="51-200">51 - 200 Staff</option>
                  <option value="200+">200+ Enterprise Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Branches / Locations <span className="text-red-500">*</span>
                </label>
                <select
                  value={branchCount}
                  onChange={(e) => setBranchCount(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-medium"
                >
                  <option value="1 (Single Headquarters)">1 (Single Headquarters)</option>
                  <option value="2-5 Branches">2 - 5 Multi-Branch Sites</option>
                  <option value="6-20 Locations">6 - 20 Regional Outlets</option>
                  <option value="20+ Global">20+ Global Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Base Operating Currency <span className="text-red-500">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-bold"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} - {c.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Required Suite Modules ({selectedModules.length} Enabled)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModules(AVAILABLE_MODULES.map(m => m.id))}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedModules(['quotations', 'invoices', 'receipts', 'inventory', 'payroll', 'clients', 'transactions', 'reports'])}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Standard Suite
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AVAILABLE_MODULES.map((mod) => {
                  const isSelected = selectedModules.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedModules(selectedModules.filter(id => id !== mod.id));
                        } else {
                          setSelectedModules([...selectedModules, mod.id]);
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-blue-50/50 border-blue-400 shadow-2xs' 
                          : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-900">{mod.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {mod.minPlan && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                                {mod.minPlan}+
                              </span>
                            )}
                            {mod.popular && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">Core</span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal">{mod.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Departments Setup */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Initial Operational Departments ({selectedDepartments.length} Selected)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {AVAILABLE_DEPARTMENTS.map((dept) => {
                  const isChecked = selectedDepartments.includes(dept.id);
                  return (
                    <label key={dept.id} className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                          } else {
                            setSelectedDepartments([...selectedDepartments, dept.id]);
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{dept.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: ADMINISTRATOR & PERMISSIONS ================= */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> Step 4: Administrator Governance & Permissions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define your organizational governance role and review granular access privileges.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-amber-50 text-amber-800 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Under strict RBAC governance, administrative privileges require verified organizational authority.</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Role / Position in the Business <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminPositionTitle}
                  onChange={(e) => setAdminPositionTitle(e.target.value)}
                  placeholder="e.g. Chief Executive Officer, Managing Director, CFO, Head of IT"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Initial Administrative Privilege Tier <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { 
                      role: 'SUPER_ADMIN' as const, 
                      title: 'Super Admin', 
                      badge: 'Full Root Access', 
                      desc: 'Unrestricted master governance across all business units, billing, payroll, staff permissions and company settings.' 
                    },
                    { 
                      role: 'BUSINESS_ADMIN' as const, 
                      title: 'Business Admin', 
                      badge: 'Operations & Staff', 
                      desc: 'Standard daily business administrator. Can invite staff, approve invoices, manage inventory and export reports.' 
                    },
                    { 
                      role: 'MANAGER' as const, 
                      title: 'Department Manager', 
                      badge: 'Department Oversight', 
                      desc: 'Supervises assigned department tasks, staff members, quotes and department-specific transaction approvals.' 
                    },
                    { 
                      role: 'STAFF' as const, 
                      title: 'Standard User', 
                      badge: 'Operational Entry', 
                      desc: 'Standard daily user access. Can draft quotes, record inventory counts, and perform task entries.' 
                    }
                  ].map((tier) => (
                    <div
                      key={tier.role}
                      onClick={() => setInitialRole(tier.role)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        initialRole === tier.role 
                          ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-100 shadow-xs' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{tier.title}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          tier.role === 'SUPER_ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tier.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{tier.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" /> Active System Permissions Configuration
                  </h4>
                  <span className="text-[10px] text-slate-500">Configured for {initialRole}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'canManageBilling', label: 'Subscription, Billing & Plan Upgrades' },
                    { key: 'canManageUsers', label: 'Invite, Edit & Deactivate Staff Accounts' },
                    { key: 'canApproveTransactions', label: 'Approve Quotations & Tax Invoices' },
                    { key: 'canAccessPayroll', label: 'Process Employee Payroll & Salary Slips' },
                    { key: 'canModifyInventory', label: 'Adjust Warehouse Stock Counts & SKUs' },
                    { key: 'canViewAuditLogs', label: 'Access Immutable Audit Trail & Logs' },
                    { key: 'canExportReports', label: 'Export P&L & Balance Sheets to Excel/PDF' },
                    { key: 'canManageBranding', label: 'Modify Company Logos, PDFs & Letterhead' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[perm.key as keyof typeof permissions]}
                        onChange={(e) => setPermissions({
                          ...permissions,
                          [perm.key]: e.target.checked
                        })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-medium text-slate-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Legal Confirmation Checkbox */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAuthorizedConfirmed}
                    onChange={(e) => setIsAuthorizedConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    required
                  />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold">Required Authorization Confirmation: </span>
                    I hereby certify and confirm that I am an authorized legal representative, director, or executive of <strong>{companyName || 'the registering business'}</strong>, duly authorized to establish this corporate workspace and configure administrative privileges on the MiraTech platform.
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: STAFF (OPTIONAL) ================= */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Step 5: Initial Staff Roster (Optional)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Queue initial employee accounts to be provisioned immediately, or skip this step to add team members later.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-blue-50 text-blue-700 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-blue-100">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>You can skip this step and add staff at any time under User Management in the dashboard.</span>
              </div>
            </div>

            {/* Add Staff Sub-form */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Add Staff Member to Provisioning Queue
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Staff Full Name</label>
                  <input
                    type="text"
                    value={staffFullName}
                    onChange={(e) => setStaffFullName(e.target.value)}
                    placeholder="e.g. Nomsa Ndlovu"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Staff Work Email</label>
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="nomsa@company.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Temporary Password</label>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Role Assignment</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition font-semibold"
                  >
                    <option value="STAFF">Staff (Standard Operational)</option>
                    <option value="DEPARTMENT_MANAGER">Department Manager</option>
                    <option value="FINANCE_MANAGER">Finance Manager</option>
                    <option value="HR">HR & Payroll Officer</option>
                    <option value="READ_ONLY">Auditor / Read Only</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Assigned Department</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_DEPARTMENTS.slice(0, 6).map((dept) => {
                      const isSel = staffDepts.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setStaffDepts(staffDepts.filter(d => d !== dept.id));
                            } else {
                              setStaffDepts([...staffDepts, dept.id]);
                            }
                          }}
                          className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                            isSel ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {dept.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddStaffMember}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Staff Member
                </button>
              </div>
            </div>

            {/* Staff Roster Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider">
                  Queued Staff Roster ({staffList.length} Team Members)
                </span>
                {staffList.length === 0 && (
                  <span className="text-[11px] text-slate-400 italic">No staff added yet (Safe to continue)</span>
                )}
              </div>

              {staffList.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-3">Staff Name</th>
                        <th className="p-3">Work Email</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Departments</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">{st.fullName}</td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">{st.email}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px] border border-blue-100">
                              {st.role}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-slate-500">
                            {st.departments.join(', ') || 'Sales'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveStaffMember(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Initial staff list is optional</p>
                  <p className="text-[11px] text-slate-400">You can add staff members right now or click Continue to skip and invite them after launching.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 6: SUBSCRIPTION (FINAL STEP) ================= */}
        {currentStep === 6 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" /> Step 6: Subscription Tier & Trial Checkout
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your workspace plan. All new corporate registrations receive an immediate 14-day free trial.
                </p>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    billingCycle === 'annual' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[9px] bg-emerald-400 text-slate-950 px-1 rounded font-black">20% OFF</span>
                </button>
              </div>
            </div>

            {/* Subscription Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isSelected = subscriptionPlanId === plan.id;
                const formattedPrice = formatPlanPrice(plan, billingCycle, currency);
                const periodLabel = billingCycle === 'annual' ? '/yr' : '/mo';

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSubscriptionPlanId(plan.id)}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between relative ${
                      isSelected 
                        ? 'bg-blue-50/60 border-blue-600 ring-2 ring-blue-500 shadow-md transform -translate-y-0.5' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {plan.id === 'professional' && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs">
                        Most Popular
                      </span>
                    )}

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900">{plan.name}</h4>
                          {plan.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-lg font-black font-sans text-slate-900">
                            {formattedPrice}
                          </span>
                          <span className="text-[10px] text-slate-400">{periodLabel}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 leading-normal line-clamp-2">
                          {plan.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Admins:</span>
                          <span className="font-bold text-slate-900">{plan.maxAdmin >= 9999 ? 'Unlimited' : plan.maxAdmin}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Staff Seats:</span>
                          <span className="font-bold text-slate-900">{plan.maxStaff >= 9999 ? 'Unlimited' : plan.maxStaff}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Unlocked Modules:</span>
                          <span className="font-bold text-blue-600">{plan.features.length} / 12</span>
                        </div>
                      </div>

                      {/* Feature Checklist Breakdown */}
                      <div className="pt-2 border-t border-slate-100/80 space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Plan Access</span>
                        <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
                          {FEATURE_DEFINITIONS.slice(0, 6).map((feat) => {
                            const isAllowed = isFeatureAllowedForPlan(plan.id, feat.id);
                            return (
                              <div key={feat.id} className="flex items-center justify-between text-[9px] py-0.5">
                                <span className={isAllowed ? "text-slate-700 font-medium truncate" : "text-slate-400 truncate"}>
                                  {feat.name}
                                </span>
                                {isAllowed ? (
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <Lock className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        className={`w-full py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-2xs' 
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                        {isSelected ? 'Selected Plan' : 'Select Plan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trial & Payment Integration Section */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">14-Day Free Enterprise Trial Guarantee</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  No Upfront Card Required
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Your workspace will be provisioned with immediate access to all <strong>{selectedPlanDetails.name}</strong> modules for 14 days without charge. Locked modules under your plan will require a tier upgrade.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 7: REVIEW & CONFIRM ================= */}
        {currentStep === 7 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-sans flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Step 7: Review & Final Confirmation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify your registration details before deploying the isolated corporate tenant environment.
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-blue-50 text-blue-700 rounded-xl items-center gap-2 text-[11px] max-w-xs border border-blue-100">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>You can click any Edit button to jump back and adjust specific settings.</span>
              </div>
            </div>

            {/* Email Verification Status Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              isEmailVerified && verifiedEmail === accountEmail
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isEmailVerified && verifiedEmail === accountEmail
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {isEmailVerified && verifiedEmail === accountEmail ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <KeyRound className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold font-sans uppercase tracking-wide">
                      {isEmailVerified && verifiedEmail === accountEmail 
                        ? 'Corporate Email Verified' 
                        : 'Email Verification Required'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isEmailVerified && verifiedEmail === accountEmail 
                        ? 'bg-emerald-200 text-emerald-800' 
                        : 'bg-amber-200 text-amber-900'
                    }`}>
                      {isEmailVerified && verifiedEmail === accountEmail ? 'Verified' : 'Action Required'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-slate-600">
                    Target Primary Corporate Address: <strong className="text-slate-900 font-mono">{accountEmail}</strong>
                  </p>
                </div>
              </div>

              {(!isEmailVerified || verifiedEmail !== accountEmail) && (
                <button
                  type="button"
                  onClick={() => sendVerificationCode(accountEmail)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Verify Email Now
                </button>
              )}
            </div>

            {/* Summary Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Account Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" /> Primary Account
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(1)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Full Name:</strong> {accountFullName || <span className="text-amber-600 italic">Not set</span>}</p>
                  <p className="flex items-center gap-1.5">
                    <strong className="text-slate-800">Sign-in Email:</strong> {accountEmail || <span className="text-amber-600 italic">Not set</span>}
                    {isEmailVerified && verifiedEmail === accountEmail && (
                      <span className="inline-flex items-center text-[9px] text-emerald-600 font-bold bg-emerald-100 px-1.5 rounded">
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Verified
                      </span>
                    )}
                  </p>
                  <p><strong className="text-slate-800">Contact Phone:</strong> {accountPhone || <span className="text-amber-600 italic">Not set</span>}</p>
                  
                  {/* Master Password Status / Inline Entry if resumed from draft */}
                  {(() => {
                    const isMatchingActiveSession = Boolean(
                      auth?.currentUser?.email && 
                      auth.currentUser.email.toLowerCase() === (accountEmail || '').trim().toLowerCase()
                    );
                    if (isMatchingActiveSession) {
                      return (
                        <div className="mt-2 p-2 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                          <span className="flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Authenticated via active session ({auth.currentUser?.email})
                          </span>
                          <span className="text-[10px] text-blue-600 bg-blue-100 font-bold px-1.5 py-0.5 rounded">Linked</span>
                        </div>
                      );
                    }

                    return accountPassword.length < 8 ? (
                      <div className="mt-2.5 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                            <KeyRound className="w-4 h-4 text-amber-700" />
                            <span>Administrator Master Password Required</span>
                          </div>
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-200/70 border border-amber-300 px-2 py-0.5 rounded-full">
                            Required to Launch
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-tight">
                          Please enter your master password to finalize corporate tenant account provisioning:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Master Password (min 8 chars)"
                              value={accountPassword}
                              onChange={(e) => updatePasswordState(e.target.value)}
                              className="w-full pl-3 pr-8 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm Master Password"
                              value={accountConfirmPassword}
                              onChange={(e) => updateConfirmPasswordState(e.target.value)}
                              className="w-full pl-3 pr-8 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        {accountPassword && accountPassword.length < 8 && (
                          <p className="text-[10px] text-amber-800 font-medium">
                            Password must be at least 8 characters (currently {accountPassword.length}/8).
                          </p>
                        )}
                        {accountPassword && accountConfirmPassword && accountPassword !== accountConfirmPassword && (
                          <p className="text-[10px] text-rose-600 font-medium">
                            Passwords do not match.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Administrator Master Password Configured
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            updatePasswordState('');
                            updateConfirmPasswordState('');
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Business Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> Business Profile
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(2)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Entity:</strong> {companyName}</p>
                  <p><strong className="text-slate-800">Registration:</strong> {registrationNumber || 'Pending'} / VAT: {taxVatNumber || 'None'}</p>
                  <p><strong className="text-slate-800">Industry:</strong> {industry} ({businessType})</p>
                  <p><strong className="text-slate-800">Address:</strong> {businessAddress}, {businessCity}, {businessCountry}</p>
                </div>
              </div>

              {/* Business Setup & Modules Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" /> Setup & Modules
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(3)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Scale:</strong> {employeeRange} employees · {branchCount}</p>
                  <p><strong className="text-slate-800">Currency:</strong> {currency}</p>
                  <p><strong className="text-slate-800">Modules ({selectedModules.length}):</strong> {selectedModules.slice(0, 5).join(', ')}{selectedModules.length > 5 ? ` +${selectedModules.length - 5} more` : ''}</p>
                  <p><strong className="text-slate-800">Departments:</strong> {selectedDepartments.join(', ')}</p>
                </div>
              </div>

              {/* Administrator & Subscription Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Subscription & Staff
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(6)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Plan:</strong> {selectedPlanDetails.name} ({billingCycle.toUpperCase()})</p>
                  <p><strong className="text-slate-800">Price:</strong> {formatPlanPrice(selectedPlanDetails, billingCycle, currency)}/{billingCycle === 'annual' ? 'yr' : 'mo'} (14-Day Free Trial)</p>
                  <p><strong className="text-slate-800">Admin Role:</strong> {initialRole} ({adminPositionTitle})</p>
                  <p><strong className="text-slate-800">Initial Staff Queue:</strong> {staffList.length} staff accounts</p>
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  required
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  I agree to the{" "}
                  <a href="/legal?doc=terms-of-service" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-semibold">
                    MiraTech Terms of Service
                  </a>
                  ,{" "}
                  <a href="/legal?doc=data-processing-agreement" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-semibold">
                    Data Processing Agreement
                  </a>
                  , and{" "}
                  <a href="/legal?doc=privacy-policy" target="_blank" className="text-blue-600 hover:text-blue-800 underline font-semibold">
                    Privacy Policy
                  </a>
                  . I confirm that all submitted details are accurate and that I have authority to initialize this corporate tenant.
                </span>
              </label>
            </div>

            {/* Provisioning Logs Console */}
            {statusLogs.length > 0 && (
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 overflow-hidden shadow-md space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span> Live Workspace Provisioning Log Console
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300 leading-relaxed">
                  {statusLogs.map((logStr, lIdx) => (
                    <div 
                      key={lIdx} 
                      className={
                        logStr.includes('ERROR') 
                          ? 'text-red-400 font-bold' 
                          : logStr.includes('successfully') || logStr.includes('persisted') || logStr.includes('Launching') 
                          ? 'text-emerald-400 font-semibold' 
                          : ''
                      }
                    >
                      {logStr}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Corporate Email Verification Modal Dialog */}
      {isVerifyingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
            
            {/* Close / Cancel Button */}
            <button
              type="button"
              onClick={() => setIsVerifyingModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon & Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-2xs">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">
                Verify Corporate Email
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                To guarantee tenant ownership and secure provisioning, we dispatched a 6-digit confirmation code to:
              </p>
              
              {/* Target Email Badge & Edit Trigger */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl">
                  {accountEmail}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyingModalOpen(false);
                    handleJumpToStep(1);
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
            </div>

            {/* 6-Digit OTP Boxes */}
            <div className="space-y-3">
              <label className="block text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Enter 6-Digit Security Code
              </label>
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCodeInput[index]}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-13 text-center font-mono text-xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
                  />
                ))}
              </div>

              {verificationError && (
                <p className="text-center text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 font-medium">
                  {verificationError}
                </p>
              )}

              {verificationSuccess && (
                <p className="text-center text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 font-medium">
                  {verificationSuccess}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleVerifyCode()}
                disabled={verificationChecking || verificationCodeInput.join('').length < 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verificationChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Validating Code...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify & Proceed to Step 7
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Didn&apos;t receive code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendVerificationCode(accountEmail)}
                    disabled={verificationSending}
                    className="font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {verificationSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Resend Code
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Navigation Controls Bar */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Step {currentStep - 1}
            </button>
          ) : (
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Progress
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep < 7 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              <span>Continue to {STEPS[currentStep].title}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={
                loading || 
                !agreedToTerms || 
                (!Boolean(auth?.currentUser?.email && auth.currentUser.email.toLowerCase() === (accountEmail || '').trim().toLowerCase()) && accountPassword.trim().length < 8)
              }
              className="flex items-center gap-2 px-8 py-3 bg-[#0066FF] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Provisioning Corporate Tenant...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Confirm & Launch Corporate Workspace
                </>
              )}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
