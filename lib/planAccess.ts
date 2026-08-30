import { SUBSCRIPTION_PLANS, ALL_FEATURES, SubscriptionPlan, FeatureDefinition } from "./subscriptions";

export type SubscriptionTier = "starter" | "growth" | "professional" | "elite" | "enterprise";

export const PLAN_TIER_ORDER: Record<string, number> = {
  starter: 1,
  growth: 2,
  professional: 3,
  elite: 4,
  enterprise: 5,
};

export const MODULE_FEATURE_MAP: Record<string, string> = {
  dashboard: "dashboard",
  quotations: "quotations",
  invoices: "invoices",
  receipts: "receipts",
  settings: "settings",
  subscriptions: "subscriptions",
  inventory: "inventory",
  sales: "clients",
  clients: "clients",
  pos: "pos",
  projects: "projects",
  support: "support",
  transactions: "transactions",
  reports: "reports",
  analytics: "reports",
  procurement: "procurement",
  marketing: "marketing",
  audit: "audit",
  audit_center: "audit_center",
  hr: "payroll",
  payroll: "payroll",
  executive: "executive",
};

export interface PlanAccessCheckResult {
  allowed: boolean;
  currentPlanId: string;
  currentPlanName: string;
  requiredPlanId: string;
  requiredPlanName: string;
  requiredPlanPrice: number;
  featureLabel: string;
  featureDescription: string;
  reason?: string;
}

/**
 * Normalizes subscription plan input from company records.
 * Supports plan ID strings, legacy names, or defaults to "starter".
 */
export function normalizePlanId(planInput?: string | null): SubscriptionTier {
  if (!planInput) return "starter";
  const lower = planInput.toLowerCase().trim();
  if (lower.includes("enterprise") || lower === "enterprise") return "enterprise";
  if (lower.includes("elite") || lower === "elite") return "elite";
  if (lower.includes("professional") || lower.includes("pro") || lower === "professional") return "professional";
  if (lower.includes("growth") || lower === "growth") return "growth";
  if (lower.includes("starter") || lower.includes("small") || lower === "starter") return "starter";
  return "starter";
}

/**
 * Checks if a company record has active subscription entitlement for a specific module or feature.
 */
export function checkCompanyPlanAccess(
  company: {
    subscriptionPlanId?: string;
    subscriptionPlan?: string;
    lockedFeatures?: string[];
    [key: string]: any;
  } | null | undefined,
  moduleOrFeatureKey: string
): PlanAccessCheckResult {
  const normalizedKey = moduleOrFeatureKey.toLowerCase().trim();
  const featureId = MODULE_FEATURE_MAP[normalizedKey] || normalizedKey;
  
  const featureDef = ALL_FEATURES.find(f => f.id === featureId) || {
    id: featureId,
    label: featureId.charAt(0).toUpperCase() + featureId.slice(1),
    category: "operations" as const,
    description: "Enterprise operational module.",
    minimumPlanId: "professional" as const,
  };

  const rawPlan = company?.subscriptionPlanId || company?.subscriptionPlan || "starter";
  const currentTier = normalizePlanId(rawPlan);
  const currentPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === currentTier) || SUBSCRIPTION_PLANS[0];

  const requiredTier = (featureDef.minimumPlanId || "starter") as SubscriptionTier;
  const requiredPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === requiredTier) || SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1];

  const currentRank = PLAN_TIER_ORDER[currentTier] || 1;
  const requiredRank = PLAN_TIER_ORDER[requiredTier] || 1;

  // Check explicit lockedFeatures array if present on company record
  const isExplicitlyLocked = company?.lockedFeatures && Array.isArray(company.lockedFeatures)
    ? company.lockedFeatures.includes(normalizedKey) || company.lockedFeatures.includes(featureId)
    : false;

  const allowed = currentRank >= requiredRank && !isExplicitlyLocked;

  return {
    allowed,
    currentPlanId: currentTier,
    currentPlanName: currentPlanObj.name,
    requiredPlanId: requiredTier,
    requiredPlanName: requiredPlanObj.name,
    requiredPlanPrice: requiredPlanObj.price,
    featureLabel: featureDef.label,
    featureDescription: featureDef.description,
    reason: allowed
      ? undefined
      : `The ${featureDef.label} module requires the ${requiredPlanObj.name} tier or higher. Your current plan is ${currentPlanObj.name}.`,
  };
}

/**
 * Server-side API Route / Action guard helper to enforce subscription plan entitlement.
 */
export function enforcePlanEntitlement(
  companyPlan: string | undefined,
  moduleKey: string
): { authorized: boolean; status: number; error?: string } {
  const check = checkCompanyPlanAccess({ subscriptionPlanId: companyPlan }, moduleKey);
  if (!check.allowed) {
    return {
      authorized: false,
      status: 403,
      error: `Subscription Plan Access Denied: ${check.reason}`,
    };
  }
  return { authorized: true, status: 200 };
}
