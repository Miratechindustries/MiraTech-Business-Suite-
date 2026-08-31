import { initializeApp, getApps } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
export const auth = getAuth(app);

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log("DEBUG: onAuthStateChanged triggered with user:", user?.email);
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, null);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

let cachedAccessToken: string | null = null;

// Retrieve from sessionStorage on client load if available
if (typeof window !== "undefined") {
  cachedAccessToken = sessionStorage.getItem("google_access_token");
}

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("google_access_token", token);
    } else {
      sessionStorage.removeItem("google_access_token");
    }
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("google_access_token");
    if (token) {
      cachedAccessToken = token;
      return token;
    }
  }
  return null;
}

export const googleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  if (accessToken) {
    setAccessToken(accessToken);
  }
  return {
    user: result.user,
    accessToken,
  };
};

export const emailSignIn = async (email: string, password: string) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    const customError = new Error(
      error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found'
        ? 'Invalid email or password. Please check your credentials and try again.'
        : 'Failed to sign in. Please try again later.'
    );
    (customError as any).code = error.code;
    throw customError;
  }
};

export const emailSignUp = async (email: string, password: string) => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    let message = 'Failed to register account. Please try again later.';
    if (error.code === 'auth/email-already-in-use') {
      message = 'This email address is already in use by another account.';
    } else if (error.code === 'auth/weak-password') {
      message = 'The password is too weak. It must be at least 6 characters.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Please enter a valid email address.';
    }
    const customError = new Error(message);
    (customError as any).code = error.code;
    throw customError;
  }
};

export const logout = async () => {
  await auth.signOut();
  setAccessToken(null);
};

export const requestGoogleDriveScope = async (): Promise<string | null> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  if (accessToken) {
    setAccessToken(accessToken);
  }
  return accessToken;
};

// Error Handling
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export async function logError(error: Error, metadata: Record<string, any> = {}) {
  try {
    const userId = auth.currentUser?.uid || "SYSTEM";
    const userEmail = auth.currentUser?.email || "SYSTEM";
    
    // 1. Write to error_logs for real-time observability in Master Admin
    await addDoc(collection(db, "error_logs"), {
      message: error.message || "Unknown error",
      stackTrace: error.stack || "No stack trace available",
      source: metadata.source || (typeof window !== "undefined" ? "client-ui" : "server"),
      resolved: false,
      severity: metadata.severity || "Medium",
      userId,
      userEmail,
      componentStack: metadata.componentStack || null,
      timestamp: serverTimestamp(),
      ...metadata
    }).catch(e => console.warn("Failed to write to error_logs:", e));

    // 2. Write to audit_logs for compliance ledger
    await addDoc(collection(db, "audit_logs"), {
      action: "System Error",
      detail: `Message: ${error.message}. Stack: ${error.stack}`,
      businessId: userId,
      timestamp: serverTimestamp(),
      user: userEmail,
      userId: userId,
      ip: "client-side",
      isError: true,
      severity: metadata.severity || "Medium",
      ...metadata
    }).catch(e => console.warn("Failed to write to audit_logs:", e));
  } catch (e) {
    console.error("Failed to log error:", e);
  }
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function isOfflineError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    msg.includes("offline") ||
    msg.includes("failed to get document because the client is offline") ||
    msg.includes("unavailable") ||
    msg.includes("failed-precondition") ||
    code === "unavailable" ||
    code === "offline" ||
    code === "failed-precondition"
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isOfflineError(error)) {
    console.warn(`[Firestore Offline Cache Mode] Gracefully handling offline error for operation: ${operationType} on path: ${path}`);
    return; // Do not throw or log as a blocking fatal Firestore Error Block
  }

  const errorMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error Block:", JSON.stringify(errInfo));

  // Asynchronously report error to Master Admin without risking infinite loops
  try {
    const userId = auth.currentUser?.uid || "SYSTEM";
    const userEmail = auth.currentUser?.email || "SYSTEM";

    // Write to global audit_logs (marks as error)
    addDoc(collection(db, "audit_logs"), {
      action: "System Error",
      detail: `Operation '${operationType}' failed on path: ${path || 'unknown'}. Error: ${errorMsg}`,
      businessId: userId,
      timestamp: serverTimestamp(),
      user: userEmail,
      userId: userId,
      ip: "127.0.0.1",
      isError: true
    }).catch(e => console.error("Silent handle error: failed to write system error to audit_logs:", e));

    // Write to global notifications targeting Master Admin
    addDoc(collection(db, "notifications"), {
      businessId: "MASTER_ADMIN", // Master Admin target
      userId: "MASTER_ADMIN",
      userEmail: "miratechindustries@gmail.com",
      title: "Critical System Error",
      message: `User ${userEmail} experienced an error during '${operationType}' on path '${path || 'unknown'}': ${errorMsg}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: "error"
    }).catch(e => console.error("Silent handle error: failed to send error notification to Master Admin:", e));
  } catch (logErr) {
    console.error("Silent handle error: failed during error reporting flow:", logErr);
  }

  throw new Error(JSON.stringify(errInfo));
}
