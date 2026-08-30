/**
 * Server-Side Error Tracking, APM, and Observability Engine
 * Captures exceptions, latency metrics, and system health for the Master Admin Dashboard.
 */

import { adminDb } from "./firebase-admin";

export async function captureException({
  error,
  source = "api",
  userId = "system",
  businessId = "system",
  metadata = {}
}: {
  error: any;
  source: string;
  userId?: string;
  businessId?: string;
  metadata?: any;
}) {
  try {
    const errorMessage = error?.message || String(error);
    const stackTrace = error?.stack || "No stack trace available";

    const errorRecord = {
      message: errorMessage,
      source,
      stackTrace,
      userId,
      businessId,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    await adminDb.collection("error_logs").add(errorRecord);
    console.error(`[APM ERROR CAPTURED] [${source}]: ${errorMessage}`);
  } catch (err) {
    console.error("Failed to capture exception in APM:", err);
  }
}

export async function recordApmMetric({
  endpoint,
  durationMs,
  statusCode,
  businessId = "system"
}: {
  endpoint: string;
  durationMs: number;
  statusCode: number;
  businessId?: string;
}) {
  try {
    await adminDb.collection("apm_metrics").add({
      endpoint,
      durationMs,
      statusCode,
      businessId,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Failed to record APM metric:", err);
  }
}
