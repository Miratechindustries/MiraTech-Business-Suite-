'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Building2, User, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from "motion/react";

const registrationSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(10, "Valid phone is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.boolean().refine((val) => val === true, "You must agree to terms"),
});

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    password: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const result = registrationSchema.safeParse({ ...formData, terms: agreed });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setFieldErrors(newErrors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const checkEmailExists = async (email: string) => {
    if (!email) return;
    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
            setFieldErrors(prev => ({ ...prev, email: "Email is already registered" }));
        } else {
            setFieldErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors.email;
              return newErrors;
            });
        }
    } catch (err) {
        console.error("Error checking email:", err);
    }
  };

  const handleNext = () => {
    if (validate()) setStep((prev) => Math.min(prev + 1, 3));
  };
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);

    try {
      const validated = registrationSchema.parse({...formData, terms: agreed});

      // 1. Create User
      const userCredential = await createUserWithEmailAndPassword(auth, validated.email, validated.password);
      const user = userCredential.user;

      // 2. Create Company
      const companyRef = await addDoc(collection(db, 'companies'), {
        name: validated.businessName,
        address: validated.address,
        phone: validated.phone,
        createdAt: new Date().toISOString(),
      });

      // 3. Create User Document
      await setDoc(doc(db, 'users', user.uid), {
        email: validated.email,
        role: 'BUSINESS_ADMIN',
        companyId: companyRef.id,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
      });

      // 4. Default Settings (Audit Log)
      await addDoc(collection(db, 'auditLogs'), {
        companyId: companyRef.id,
        action: 'COMPANY_CREATED',
        userId: user.uid,
        timestamp: new Date().toISOString(),
      });

      setIsSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
      
    } catch (err: any) {
      console.error(err);
      setError(err instanceof z.ZodError ? err.errors[0].message : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        
        {isSuccess ? (
             <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 py-8"
              >
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
                <h2 className="text-2xl font-bold">Registration Successful!</h2>
                <p className="text-slate-600">Redirecting to your dashboard...</p>
              </motion.div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-6 text-center text-slate-900">Mira Business Suite Registration</h1>
            
            <div className="flex justify-between mb-8 px-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {s}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                        {s === 1 ? 'Business' : s === 2 ? 'Contact' : 'Admin'}
                    </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div
                key={step}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {step === 1 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2"><Building2 className="w-5 h-5"/> Business Details</h2>
                    <input type="text" placeholder="Business Name" value={formData.businessName} onChange={(e) => { setFormData({...formData, businessName: e.target.value}); validate(); }} className="w-full border p-2 rounded" />
                    {fieldErrors.businessName && <p className="text-red-500 text-xs">{fieldErrors.businessName}</p>}
                    <input type="text" placeholder="Address" value={formData.address} onChange={(e) => { setFormData({...formData, address: e.target.value}); validate(); }} className="w-full border p-2 rounded" />
                    {fieldErrors.address && <p className="text-red-500 text-xs">{fieldErrors.address}</p>}
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-lg">Contact Information</h2>
                    <input type="tel" placeholder="Phone Number" value={formData.phone} onChange={(e) => { setFormData({...formData, phone: e.target.value}); validate(); }} className="w-full border p-2 rounded" />
                {fieldErrors.phone && <p className="text-red-500 text-xs">{fieldErrors.phone}</p>}
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2"><User className="w-5 h-5"/> Create Admin Account</h2>
                    <input type="email" placeholder="Email" value={formData.email} onChange={(e) => { 
    setFormData({...formData, email: e.target.value}); 
    validate(); 
    checkEmailExists(e.target.value); 
}} className="w-full border p-2 rounded" />
                    {fieldErrors.email && <p className="text-red-500 text-xs">{fieldErrors.email}</p>}
                    <input type="password" placeholder="Password" value={formData.password} onChange={(e) => { setFormData({...formData, password: e.target.value}); validate(); }} className="w-full border p-2 rounded" />
                    {fieldErrors.password && <p className="text-red-500 text-xs">{fieldErrors.password}</p>}
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); validate(); }} />
                        I agree to the Terms and Conditions
                    </label>
                    {fieldErrors.terms && <p className="text-red-500 text-xs">{fieldErrors.terms}</p>}
                  </div>
                )}
              </motion.div>
              
              {error && <p className="text-red-500 text-sm">{error}</p>}
              
              <div className="flex justify-between mt-6">
                {step > 1 && <button type="button" onClick={handleBack} className="flex items-center gap-2 text-slate-600 font-bold"><ChevronLeft/> Back</button>}
                {step < 3 ? (
                    <button type="button" onClick={handleNext} className="ml-auto flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Next <ChevronRight/></button>
                ): (
                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">{loading ? 'Processing...' : 'Complete Registration'}</button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
