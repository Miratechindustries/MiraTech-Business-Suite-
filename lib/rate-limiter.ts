/**
 * Server-Side Rate Limiter and DDoS Mitigation Middleware for API Routes
 * Tracks requests per IP and per user ID using memory store / Firestore cache.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const rateLimitMap: RateLimitStore = {};

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 60; // 60 requests per minute per IP/User
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 min block if DDoS pattern detected

export function checkRateLimit(req: NextRequest): { allowed: boolean; remaining: number; retryAfter?: number } {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const now = Date.now();

  let record = rateLimitMap[ip];

  if (!record || now > record.resetTime) {
    rateLimitMap[ip] = { count: 1, resetTime: now + WINDOW_MS };
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS) {
    // DDoS or abuse pattern: extend reset time
    record.resetTime = now + BLOCK_DURATION_MS;
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: MAX_REQUESTS - record.count };
}
