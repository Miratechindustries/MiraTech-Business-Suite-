/**
 * MiraTech Business Suite - Durable Background Worker Queue
 * 
 * Persistent Firestore-backed task queue for asynchronous background operations
 * (payroll processing, bulk exports, scheduled invoice reminders, decoupled email dispatching).
 * Features retry logic with exponential backoff and execution status tracking.
 */

import { adminDb } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export type BackgroundTaskType = 
  | 'PROCESS_PAYROLL'
  | 'BULK_EXPORT'
  | 'SEND_INVOICE_REMINDER'
  | 'SEND_PROVISIONING_EMAIL'
  | 'SEND_TRANSACTIONAL_EMAIL';

export interface BackgroundTask {
  id?: string;
  taskType: BackgroundTaskType;
  tenantId: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  runAt: FirebaseFirestore.Timestamp;
}

const QUEUE_COLLECTION = "background_task_queue";

/**
 * Enqueues a background task for asynchronous execution.
 */
export async function enqueueBackgroundTask(
  taskType: BackgroundTaskType,
  tenantId: string,
  payload: Record<string, any>,
  options?: { delayMs?: number; maxAttempts?: number }
): Promise<string> {
  const now = Timestamp.now();
  const delay = options?.delayMs || 0;
  const runAt = new Timestamp(now.seconds + Math.floor(delay / 1000), now.nanoseconds);

  const taskData: Omit<BackgroundTask, 'id'> = {
    taskType,
    tenantId,
    payload,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: options?.maxAttempts || 3,
    createdAt: now,
    updatedAt: now,
    runAt,
  };

  const docRef = await adminDb.collection(QUEUE_COLLECTION).add(taskData);
  return docRef.id;
}

/**
 * Processes pending background tasks in the queue.
 * Can be called via a cron endpoint or background worker loop.
 */
export async function processBackgroundQueue(limit: number = 10): Promise<{ processed: number; success: number; failed: number }> {
  const now = Timestamp.now();
  const snapshot = await adminDb
    .collection(QUEUE_COLLECTION)
    .where('status', '==', 'PENDING')
    .where('runAt', '<=', now)
    .limit(limit)
    .get();

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    processed++;
    const task = doc.id;
    const data = doc.data() as BackgroundTask;

    // Mark task as processing
    await doc.ref.update({
      status: 'PROCESSING',
      updatedAt: Timestamp.now(),
    });

    try {
      await executeTaskHandler(data.taskType, data.tenantId, data.payload);
      
      await doc.ref.update({
        status: 'COMPLETED',
        updatedAt: Timestamp.now(),
      });
      success++;
    } catch (err: any) {
      failed++;
      const newAttempts = data.attempts + 1;
      const errorMsg = err?.message || 'Unknown task execution error';

      if (newAttempts >= data.maxAttempts) {
        await doc.ref.update({
          status: 'FAILED',
          attempts: newAttempts,
          error: errorMsg,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Exponential backoff: delay = 2 ^ attempts * 10 seconds
        const backoffSeconds = Math.pow(2, newAttempts) * 10;
        const nextRun = new Timestamp(Timestamp.now().seconds + backoffSeconds, 0);
        await doc.ref.update({
          status: 'PENDING',
          attempts: newAttempts,
          error: errorMsg,
          runAt: nextRun,
          updatedAt: Timestamp.now(),
        });
      }
    }
  }

  return { processed, success, failed };
}

/**
 * Task router for background execution.
 */
async function executeTaskHandler(taskType: BackgroundTaskType, tenantId: string, payload: Record<string, any>) {
  switch (taskType) {
    case 'PROCESS_PAYROLL':
      // Simulate or execute heavy asynchronous payroll processing
      console.log(`[BackgroundWorker] Processing payroll batch for tenant ${tenantId}`, payload);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      break;

    case 'BULK_EXPORT':
      console.log(`[BackgroundWorker] Generating bulk export for tenant ${tenantId}`, payload);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      break;

    case 'SEND_INVOICE_REMINDER':
      console.log(`[BackgroundWorker] Sending scheduled invoice reminder for tenant ${tenantId}`, payload);
      break;

    case 'SEND_PROVISIONING_EMAIL':
    case 'SEND_TRANSACTIONAL_EMAIL': {
      const { sendViaBrevo } = await import('./brevo-client');
      const result = await sendViaBrevo({
        to: [{ email: payload.toEmail, name: payload.toName }],
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to dispatch email via Brevo worker');
      }
      break;
    }

    default:
      throw new Error(`Unsupported background task type: ${taskType}`);
  }
}
