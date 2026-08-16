export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  exchangeRateToUSD: number; // 1 USD = X in this currency
  flag?: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  SZL: {
    code: "SZL",
    symbol: "E",
    name: "Eswatini Lilangeni (SZL)",
    exchangeRateToUSD: 18.5,
    flag: "🇸🇿"
  },
  ZAR: {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand (ZAR)",
    exchangeRateToUSD: 18.5,
    flag: "🇿🇦"
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar (USD)",
    exchangeRateToUSD: 1.0,
    flag: "🇺🇸"
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro (EUR)",
    exchangeRateToUSD: 0.92,
    flag: "🇪🇺"
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound (GBP)",
    exchangeRateToUSD: 0.78,
    flag: "🇬🇧"
  },
  BWP: {
    code: "BWP",
    symbol: "P",
    name: "Botswana Pula (BWP)",
    exchangeRateToUSD: 13.6,
    flag: "🇧🇼"
  },
  MZN: {
    code: "MZN",
    symbol: "MT",
    name: "Mozambican Metical (MZN)",
    exchangeRateToUSD: 63.8,
    flag: "🇲🇿"
  },
  CAD: {
    code: "CAD",
    symbol: "CA$",
    name: "Canadian Dollar (CAD)",
    exchangeRateToUSD: 1.38,
    flag: "🇨🇦"
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar (AUD)",
    exchangeRateToUSD: 1.54,
    flag: "🇦🇺"
  },
  INR: {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee (INR)",
    exchangeRateToUSD: 83.5,
    flag: "🇮🇳"
  },
  KES: {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling (KES)",
    exchangeRateToUSD: 129.0,
    flag: "🇰🇪"
  },
  NGN: {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira (NGN)",
    exchangeRateToUSD: 1580.0,
    flag: "🇳🇬"
  }
};

/**
 * Returns currency info by code (case-insensitive), defaulting to SZL/E or USD.
 */
export function getCurrencyInfo(code?: string): CurrencyInfo {
  if (!code) return SUPPORTED_CURRENCIES.SZL;
  const upper = code.toUpperCase().trim();
  return SUPPORTED_CURRENCIES[upper] || {
    code: upper,
    symbol: upper === "ZAR" ? "R" : upper === "SZL" ? "E" : "$",
    name: upper,
    exchangeRateToUSD: 1.0
  };
}

/**
 * Returns currency symbol string (e.g., "E", "R", "$", "€").
 */
export function getCurrencySymbol(code?: string): string {
  return getCurrencyInfo(code).symbol;
}

/**
 * Converts a base USD amount to target currency.
 */
export function convertFromUSD(usdAmount: number, targetCurrencyCode?: string): number {
  const info = getCurrencyInfo(targetCurrencyCode);
  const raw = usdAmount * info.exchangeRateToUSD;
  // Round sensibly based on magnitude
  if (info.exchangeRateToUSD >= 100) {
    return Math.round(raw);
  }
  return Math.round(raw * 100) / 100;
}

/**
 * Formats a numeric monetary value with symbol and standard separators.
 * e.g., formatCurrency(3700, "SZL") -> "E3,700.00"
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string,
  options?: { showCode?: boolean; minimumFractionDigits?: number }
): string {
  const info = getCurrencyInfo(currencyCode);
  const minDigits = options?.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 2;
  const formattedNum = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: 2
  });

  const base = `${info.symbol}${formattedNum}`;
  if (options?.showCode) {
    return `${base} ${info.code}`;
  }
  return base;
}

/**
 * Formats a USD base plan price to the target currency formatted string.
 */
export function formatPlanPrice(
  usdPrice: number,
  currencyCode?: string,
  billingCycle: "monthly" | "annual" = "monthly"
): { formattedAmount: string; convertedValue: number; symbol: string; code: string } {
  const info = getCurrencyInfo(currencyCode);
  const multiplier = billingCycle === "annual" ? 10 : 1; // 2 months free on annual
  const usdTarget = usdPrice * multiplier;
  const convertedValue = convertFromUSD(usdTarget, currencyCode);
  const formattedAmount = formatCurrency(convertedValue, currencyCode, {
    minimumFractionDigits: convertedValue % 1 === 0 ? 0 : 2
  });

  return {
    formattedAmount,
    convertedValue,
    symbol: info.symbol,
    code: info.code
  };
}
