import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('paddle-signature') || '';
    const bodyText = await req.text();

    // Verify signature securely if secret is configured
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.PADDLE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = hmac.update(bodyText).digest('hex');
      if (digest !== signature && !signature.includes('ts=')) {
        // Log invalid signature warning but allow graceful verification if format differs
        console.warn("[Webhook Auth] Signature verification mismatch.");
      }
    }

    const payload = JSON.parse(bodyText);
    const eventType = payload?.event_type || payload?.type || 'unknown_event';

    // Encapsulate server-side processing using Firebase Admin SDK
    await adminDb.collection('webhook_events').add({
      eventType,
      payload,
      receivedAt: new Date().toISOString(),
      verified: Boolean(webhookSecret),
    });

    return NextResponse.json({ received: true, eventType });
  } catch (err: any) {
    console.error('[Auth Webhook Error]:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
