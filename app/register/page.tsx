"use client";

import { useState } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Building,
  MapPin,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Briefcase,
} from "lucide-react";
import { db, auth, OperationType, handleFirestoreError } from "@/lib/firebase";
import { collection, doc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";

const step1Schema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
});

const step2Schema = z.object({
  phone: z.string().min(6, "Please enter a valid phone number."),
  address: z.string().min(5, "Please enter a complete address."),
  taxId: z.string().min(2, "Please enter a valid Tax ID / EIN."),
  registrationNumber: z
    .string()
    .min(2, "Please enter a valid Company Registration Number."),
});

const step3Schema = z.object({
  subscriptionPlan: z.enum(["starter", "pro", "enterprise"]),
});

type FormData = z.infer<typeof step1Schema> &
  z.infer<typeof step2Schema> &
  z.infer<typeof step3Schema>;

export default function RegisterBusiness() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    registrationNumber: "",
    subscriptionPlan: "starter",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateFields = (fields: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    const newErrors = { ...errors };
    Object.keys(fields).forEach((key) => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  };

  const handleNext = () => {
    try {
      if (step === 1) {
        step1Schema.parse({ name: formData.name, email: formData.email });
      } else if (step === 2) {
        step2Schema.parse({
          phone: formData.phone,
          address: formData.address,
          taxId: formData.taxId,
          registrationNumber: formData.registrationNumber,
        });
      }
      setErrors({});
      setStep((s) => s + 1);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
        });
        setErrors(newErrors);
      }
    }
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    try {
      step3Schema.parse({ subscriptionPlan: formData.subscriptionPlan });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors({ subscriptionPlan: error.errors[0].message });
        return;
      }
    }

    if (!auth.currentUser) {
      setGlobalError("You must be logged in to register a business.");
      return;
    }

    setIsLoading(true);
    setGlobalError("");

    try {
      const batch = writeBatch(db);
      const businessesRef = collection(db, "businesses");
      const newBusinessRef = doc(businessesRef);

      batch.set(newBusinessRef, {
        ownerId: auth.currentUser.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        taxId: formData.taxId,
        registrationNumber: formData.registrationNumber,
        subscriptionPlan: formData.subscriptionPlan,
        status: "active",
        createdAt: new Date().toISOString(),
      });

      const userRef = doc(db, "users", auth.currentUser.uid);
      batch.set(
        userRef,
        {
          role: "BUSINESS_ADMIN",
          businessId: newBusinessRef.id,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await batch.commit();

      router.push("/");
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.CREATE, "businesses");
      } catch (firestoreError: any) {
        try {
          const parsed = JSON.parse(firestoreError.message);
          setGlobalError(parsed.error || "Failed to register business.");
        } catch {
          setGlobalError(
            error.message || "An unexpected error occurred. Please try again.",
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        {/* Header / Progress */}
        <div className="bg-slate-900 px-8 py-8 text-white">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-inner">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Register Your Business
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Set up your tenant workspace in minutes
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between relative mt-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: "33%" }}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300 ${step >= i ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "bg-slate-800 text-slate-500"}`}
              >
                {i}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Business Name
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateFields({ name: e.target.value })}
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.name ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                        placeholder="Acme Corporation"
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1.5 text-sm text-red-500">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Primary Contact Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          updateFields({ email: e.target.value })
                        }
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.email ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                        placeholder="contact@acme.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-sm text-red-500">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Tax ID / EIN
                      </label>
                      <input
                        type="text"
                        value={formData.taxId}
                        onChange={(e) =>
                          updateFields({ taxId: e.target.value })
                        }
                        className={`block w-full px-3 py-2.5 border ${errors.taxId ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                        placeholder="12-3456789"
                      />
                      {errors.taxId && (
                        <p className="mt-1.5 text-sm text-red-500">
                          {errors.taxId}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Company Reg No.
                      </label>
                      <input
                        type="text"
                        value={formData.registrationNumber}
                        onChange={(e) =>
                          updateFields({ registrationNumber: e.target.value })
                        }
                        className={`block w-full px-3 py-2.5 border ${errors.registrationNumber ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                        placeholder="CRN-12345"
                      />
                      {errors.registrationNumber && (
                        <p className="mt-1.5 text-sm text-red-500">
                          {errors.registrationNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          updateFields({ phone: e.target.value })
                        }
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.phone ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1.5 text-sm text-red-500">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Business Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <textarea
                        value={formData.address}
                        onChange={(e) =>
                          updateFields({ address: e.target.value })
                        }
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.address ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"} rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all min-h-[100px] resize-none`}
                        placeholder="123 Business Avenue..."
                      />
                    </div>
                    {errors.address && (
                      <p className="mt-1.5 text-sm text-red-500">
                        {errors.address}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {[
                      {
                        id: "starter",
                        name: "Starter",
                        price: "$29/mo",
                        desc: "Up to 5 team members",
                      },
                      {
                        id: "pro",
                        name: "Professional",
                        price: "$99/mo",
                        desc: "Up to 20 team members",
                      },
                      {
                        id: "enterprise",
                        name: "Enterprise",
                        price: "$299/mo",
                        desc: "Unlimited everything",
                      },
                    ].map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() =>
                          updateFields({ subscriptionPlan: plan.id as any })
                        }
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.subscriptionPlan === plan.id ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {plan.name}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {plan.desc}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              {plan.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.subscriptionPlan && (
                    <p className="text-sm text-red-500">
                      {errors.subscriptionPlan}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {globalError && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {globalError}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || isLoading}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${step === 1 ? "text-transparent cursor-default" : "text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"}`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-sm shadow-slate-900/20"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all active:scale-[0.98] shadow-sm shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    Complete Registration
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
