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
      console.error('Failed to initialize Paddle.js:', err);
      return null;
    }
  })();

  return initPromise;
}
