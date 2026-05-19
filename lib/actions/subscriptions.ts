import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  Timestamp
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'SYSTEM', // Note: In a real server context we'd get this from auth headers/session
      email: 'SYSTEM_ADMIN',
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Backend logic for assigning a subscription to a business.
 * Calculates start and end dates based on duration.
 */
export async function assignSubscriptionToBusiness(businessId: string, planId: string, durationMonths: number) {
  const path = 'subscriptions';
  try {
    const startDate = Date.now();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    
    const subData = {
      businessId,
      planId,
      status: 'active',
      startDate: startDate,
      endDate: endDate.getTime(),
      currentPeriodEnd: endDate.getTime(),
      cancelAtPeriodEnd: false,
      updatedAt: Date.now()
    };

    // Check for existing subscription
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where('businessId', '==', businessId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingSubId = querySnapshot.docs[0].id;
      await updateDoc(doc(db, 'subscriptions', existingSubId), subData);
      return { id: existingSubId, ...subData, updated: true };
    } else {
      const docRef = await addDoc(collection(db, 'subscriptions'), subData);
      return { id: docRef.id, ...subData, updated: false };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
