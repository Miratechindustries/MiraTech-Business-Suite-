'use client';

// Lightweight type interface for Paddle to avoid static module resolution crash
export type Paddle = any;
export type Environments = 'sandbox' | 'production';

let paddleInstance: any = null;
let initPromise: Promise<any> | null = null;

// Verified Sandbox Product ID to Price ID mappings from Paddle catalog
const PRODUCT_TO_PRICE_SANDBOX: Record<string, string> = {
  'pro_01m20cd001yz8yabbcdg0dv224': 'pri_01m20chmk0ctkbx9g7gz60zava', // Starter (800 ZAR)
  'pro_01m20e62pjg23de9j0f6z1s1jp': 'pri_01m20fae6v0sxz3165tfa0qwgv', // Growth (1800 ZAR)
  'pro_01m20gknwdj8fvxcc9znw8z9jz': 'pri_01m20gr0x0ne82ckzhrcpzrh89', // Professional (3250 ZAR)
  'pro_01m20gvb80cp59n6j3nn6fzd4g': 'pri_01m20gy3j6hc3sv5r25ec9wtvw', // Elite (5000 ZAR)
  'pro_01m20gzdhazcfw07bst0vk86e7': 'pri_01m20h77pvkcrs6gcqxdfe3hr3', // Enterprise (7500 ZAR)
};

const DEFAULT_SANDBOX_PRICES: Record<string, string> = {
  starter: 'pri_01m20chmk0ctkbx9g7gz60zava',
  growth: 'pri_01m20fae6v0sxz3165tfa0qwgv',
  professional: 'pri_01m20gr0x0ne82ckzhrcpzrh89',
  elite: 'pri_01m20gy3j6hc3sv5r25ec9wtvw',
  enterprise: 'pri_01m20h77pvkcrs6gcqxdfe3hr3',
};

export function resolvePaddlePriceId(envVal: string | undefined, tierKey: string): string {
  // 1. If valid Price ID supplied directly
  if (envVal && envVal.startsWith('pri_')) {
    return envVal;
  }
  // 2. If Product ID was mistakenly supplied in place of Price ID, map to verified Sandbox Price ID
  if (envVal && PRODUCT_TO_PRICE_SANDBOX[envVal]) {
    return PRODUCT_TO_PRICE_SANDBOX[envVal];
  }
  // 3. Fallback to verified default Sandbox Price ID for the tier
  return DEFAULT_SANDBOX_PRICES[tierKey] || envVal || 'pri_01m20chmk0ctkbx9g7gz60zava';
}

// Environment-backed Price IDs for Paddle Products & Prices (normalized to ensure valid 'pri_' IDs)
export const PADDLE_PRICE_MAP: Record<string, string> = {
  starter: resolvePaddlePriceId(process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER, 'starter'),
  growth: resolvePaddlePriceId(process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH, 'growth'),
  professional: resolvePaddlePriceId(process.env.NEXT_PUBLIC_PADDLE_PRICE_PROFESSIONAL, 'professional'),
  elite: resolvePaddlePriceId(process.env.NEXT_PUBLIC_PADDLE_PRICE_ELITE, 'elite'),
  enterprise: resolvePaddlePriceId(process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE, 'enterprise'),
};

export function getPaddleEnvironment(): Environments {
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV?.toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function isPaddleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
}

// Console-safe logger for Paddle subscription events without exposing tokens or PII
export interface PaddleEventLog {
  id: string;
  name: string;
  timestamp: string;
  status: 'completed' | 'error' | 'info';
  details: string;
}

const PADDLE_LOG_KEY = 'miratech_paddle_event_logs';

export function logPaddleEvent(event: any): PaddleEventLog {
  const eventName = event?.name || 'unknown';
  const eventData = event?.data || {};
  
  let status: 'completed' | 'error' | 'info' = 'info';
  if (eventName === 'checkout.completed') status = 'completed';
  else if (eventName === 'checkout.error' || eventName === 'error') status = 'error';

  const safeDetails = JSON.stringify({
    eventId: eventData.id || eventData.transaction_id || 'trx_' + Date.now(),
    status: eventData.status || status,
    total: eventData.totals?.total || eventData.total || 'N/A',
    currency: eventData.currency_code || eventData.currency || 'USD',
  });

  const logEntry: PaddleEventLog = {
    id: 'pdl_log_' + Math.random().toString(36).substring(2, 9),
    name: eventName,
    timestamp: new Date().toISOString(),
    status,
    details: safeDetails,
  };

  try {
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(localStorage.getItem(PADDLE_LOG_KEY) || '[]');
      const updated = [logEntry, ...existing].slice(0, 25);
      localStorage.setItem(PADDLE_LOG_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    // ignore
  }

  // Console-safe structured logging without tokens
  console.info(`[Paddle Billing Event] [${logEntry.status.toUpperCase()}] ${logEntry.name} at ${logEntry.timestamp}`);
  return logEntry;
}

export function getPaddleEventLogs(): PaddleEventLog[] {
  try {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem(PADDLE_LOG_KEY) || '[]');
    }
  } catch (e) {}
  return [];
}

const eventListeners = new Set<(event: any) => void>();

export async function getPaddle(
  onEvent?: (event: any) => void
): Promise<any> {
  if (onEvent) {
    eventListeners.add(onEvent);
  }

  if (paddleInstance) {
    return paddleInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) {
    return null;
  }

  initPromise = (async () => {
    try {
      const paddleModule = await import('@paddle/paddle-js');
      const initializePaddle = paddleModule.initializePaddle || (paddleModule as any).default?.initializePaddle;
      if (!initializePaddle) {
        throw new Error('Paddle.js initializePaddle export not found');
      }

      const instance = await initializePaddle({
        token,
        environment: getPaddleEnvironment(),
        eventCallback: (event: any) => {
          logPaddleEvent(event);
          eventListeners.forEach(listener => {
            try {
              listener(event);
            } catch (e) {
              console.warn('[Paddle Event Listener Error]', e);
            }
          });
        },
        checkout: {
          settings: {
            variant: 'one-page',
            displayMode: 'overlay',
            theme: 'light',
          },
        },
      });

      paddleInstance = instance || null;
      return paddleInstance;
    } catch (err) {
      console.error('Failed to initialize Paddle.js securely.');
      return null;
    }
  })();

  return initPromise;
}
