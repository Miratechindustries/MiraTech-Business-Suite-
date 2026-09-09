'use client';

// Lightweight type interface for Paddle to avoid static module resolution crash
export type Paddle = any;
export type Environments = 'sandbox' | 'production';

let paddleInstance: any = null;
let initPromise: Promise<any> | null = null;

// Environment-backed Price IDs for Paddle Products & Prices
export const PADDLE_PRICE_MAP: Record<string, string> = {
  starter: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER || 'pri_starter_tier',
  growth: process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH || 'pri_growth_tier',
  professional: process.env.NEXT_PUBLIC_PADDLE_PRICE_PROFESSIONAL || 'pri_professional_tier',
  elite: process.env.NEXT_PUBLIC_PADDLE_PRICE_ELITE || 'pri_elite_tier',
  enterprise: process.env.NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE || 'pri_enterprise_tier',
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

export async function getPaddle(
  onEvent?: (event: any) => void
): Promise<any> {
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
          if (onEvent) {
            onEvent(event);
          }
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
