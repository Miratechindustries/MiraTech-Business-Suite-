'use client';

import { useState, useEffect } from 'react';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, getPlanPrice, formatPlanPrice } from '../lib/subscriptions';
import { PADDLE_PRICE_MAP, isPaddleConfigured, getPaddle } from '../lib/paddle-client';
import { useUserStore } from '../lib/store';
import { Check, Sparkles, Loader2, ShieldCheck, Zap, ArrowRight, HelpCircle } from 'lucide-react';

interface PricingComparisonProps {
  onSelectPlan?: (plan: SubscriptionPlan, billingCycle: 'monthly' | 'annual') => void;
  className?: string;
}

export default function PricingComparison({ onSelectPlan, className = '' }: PricingComparisonProps) {
  const { currentUser } = useUserStore();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paddleConfigured, setPaddleConfigured] = useState(false);

  useEffect(() => {
    setPaddleConfigured(isPaddleConfigured());
  }, []);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    setError(null);
    setSuccess(null);
    setLoadingPlanId(plan.id);

    if (onSelectPlan) {
      onSelectPlan(plan, billingCycle);
      setLoadingPlanId(null);
      return;
    }

    // Default checkout handler using Paddle if configured
    try {
      if (!paddleConfigured) {
        // Fallback simulated success or alert if Paddle token is not configured
        setSuccess(`Selected ${plan.name} (${billingCycle}). Configure NEXT_PUBLIC_PADDLE_CLIENT_TOKEN to launch live Paddle checkout.`);
        setLoadingPlanId(null);
        return;
      }

      const paddle = await getPaddle((event: any) => {
        if (event?.name === 'checkout.completed') {
          setSuccess(`Successfully subscribed to ${plan.name}!`);
          setLoadingPlanId(null);
        }
      });

      if (paddle) {
        const priceId = PADDLE_PRICE_MAP[plan.id] || 'pri_01m20chmk0ctkbx9g7gz60zava';
        paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customData: {
            companyId: currentUser?.companyId || 'guest_company',
            userId: currentUser?.id || 'guest_user',
            userEmail: currentUser?.email || 'guest@example.com',
            tier: plan.id,
            billingCycle,
          },
          customer: {
            email: currentUser?.email || '',
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
        setError("Failed to initialize Paddle client. Please check your token configuration.");
      }
    } catch (err: any) {
      console.error("Paddle checkout error:", err);
      setError("Checkout initialization failed: " + (err.message || "Unknown error"));
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className={`w-full py-8 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900 rounded-2xl ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-4 border border-blue-200 dark:border-blue-800">
            <Sparkles className="w-3.5 h-3.5" /> Secure Paddle Billing Tiers
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Transparent Pricing for Every Enterprise Scale
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Choose the right subscription tier backed by Paddle Verified Price IDs. Upgrade or downgrade anytime with instant feature provisioning.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center p-1.5 bg-slate-200 dark:bg-slate-800 rounded-full shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Annual Billing
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
            <span className="font-semibold">Notice:</span> {error}
          </div>
        )}

        {success && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-3">
            <span className="font-semibold">Success:</span> {success}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const price = getPlanPrice(plan, billingCycle);
            const priceId = PADDLE_PRICE_MAP[plan.id] || 'Not Configured';
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-slate-800 rounded-2xl p-6 flex flex-col justify-between border transition-all duration-200 shadow-sm hover:shadow-md ${
                  isPopular
                    ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                    {plan.badge || 'Most Popular'}
                  </div>
                )}
                {plan.badge && !isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] mb-4">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        R{price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        /{billingCycle === 'annual' ? 'yr' : 'mo'}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded inline-block truncate max-w-full" title={priceId}>
                      Price ID: {priceId}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mb-6">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                      Included limits & features:
                    </div>
                    <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>{plan.maxAdmin === 9999 ? 'Unlimited' : plan.maxAdmin}</strong> Admins</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>{plan.maxStaff === 9999 ? 'Unlimited' : plan.maxStaff}</strong> Staff members</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>{plan.features.length}</strong> modules enabled</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => handleCheckout(plan)}
                  disabled={loadingPlanId === plan.id}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                  } disabled:opacity-50`}
                >
                  {loadingPlanId === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening Checkout...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Select Plan
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Security Footer Note */}
        <div className="mt-12 text-center flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secure checkout powered by Paddle Merchant of Record. All major credit cards, PayPal, and local bank transfers accepted.</span>
        </div>
      </div>
    </div>
  );
}
