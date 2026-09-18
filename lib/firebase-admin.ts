import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  writeBatch, 
  runTransaction,
  Query, 
  WhereFilterOp,
  OrderByDirection
} from "firebase/firestore";
import { db } from "./firebase";

// Helper to wrap Firestore DocumentSnapshot into admin-compatible snapshot
function wrapDocSnapshot(snap: any) {
  return {
    id: snap.id,
    exists: snap.exists(),
    data: () => snap.data(),
    ref: snap.ref,
  };
}

// Helper to wrap QuerySnapshot into admin-compatible query snapshot
function wrapQuerySnapshot(snap: any) {
  const docs = snap.docs.map((d: any) => wrapDocSnapshot(d));
  return {
    docs,
    size: snap.size,
    empty: snap.empty,
    forEach: (callback: (doc: any) => void) => docs.forEach(callback),
  };
}

// Create Document wrapper
function createDocWrapper(docRef: any): any {
  return {
    id: docRef.id,
    path: docRef.path,
    _ref: docRef,
    get: async () => {
      const snap = await getDoc(docRef);
      return wrapDocSnapshot(snap);
    },
    set: async (data: any, options?: { merge?: boolean }) => {
      return await setDoc(docRef, data, options || {});
    },
    update: async (data: any) => {
      return await updateDoc(docRef, data);
    },
    delete: async () => {
      return await deleteDoc(docRef);
    },
    collection: (subColName: string) => {
      return createCollectionWrapper(collection(docRef, subColName));
    }
  };
}

// Create Query wrapper
function createQueryWrapper(q: Query): any {
  return {
    _query: q,
    where: (fieldPath: string, opStr: WhereFilterOp, value: any) => {
      return createQueryWrapper(query(q, where(fieldPath, opStr, value)));
    },
    limit: (num: number) => {
      return createQueryWrapper(query(q, limit(num)));
    },
    orderBy: (fieldPath: string, directionStr?: OrderByDirection) => {
      return createQueryWrapper(query(q, orderBy(fieldPath, directionStr)));
    },
    get: async () => {
      const snap = await getDocs(q);
      return wrapQuerySnapshot(snap);
    }
  };
}

// Create Collection wrapper
function createCollectionWrapper(colRef: any): any {
  return {
    id: colRef.id,
    path: colRef.path,
    _ref: colRef,
    doc: (docId?: string) => {
      const dRef = docId ? doc(colRef, docId) : doc(colRef);
      return createDocWrapper(dRef);
    },
    add: async (data: any) => {
      const docRef = await addDoc(colRef, data);
      return {
        id: docRef.id,
        _ref: docRef
      };
    },
    where: (fieldPath: string, opStr: WhereFilterOp, value: any) => {
      return createQueryWrapper(query(colRef, where(fieldPath, opStr, value)));
    },
    limit: (num: number) => {
      return createQueryWrapper(query(colRef, limit(num)));
    },
    orderBy: (fieldPath: string, directionStr?: OrderByDirection) => {
      return createQueryWrapper(query(colRef, orderBy(fieldPath, directionStr)));
    },
    get: async () => {
      const snap = await getDocs(colRef);
      return wrapQuerySnapshot(snap);
    }
  };
}

// Batch implementation
class AdminBatchWrapper {
  private batch = writeBatch(db);

  set(docWrapperOrRef: any, data: any, options?: { merge?: boolean }) {
    const rawRef = docWrapperOrRef._ref || docWrapperOrRef;
    this.batch.set(rawRef, data, options || {});
    return this;
  }

  update(docWrapperOrRef: any, data: any) {
    const rawRef = docWrapperOrRef._ref || docWrapperOrRef;
    this.batch.update(rawRef, data);
    return this;
  }

  delete(docWrapperOrRef: any) {
    const rawRef = docWrapperOrRef._ref || docWrapperOrRef;
    this.batch.delete(rawRef);
    return this;
  }

  async commit() {
    return await this.batch.commit();
  }
}

// Master AdminDb object
export const adminDb = {
  collection: (colName: string) => {
    return createCollectionWrapper(collection(db, colName));
  },
  doc: (path: string) => {
    return createDocWrapper(doc(db, path));
  },
  batch: () => {
    return new AdminBatchWrapper();
  },
  runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
    return await runTransaction(db, async (transaction) => {
      const wrappedTransaction = {
        get: async (docRef: any) => {
          const rawRef = docRef._ref || docRef;
          const snap = await transaction.get(rawRef);
          return wrapDocSnapshot(snap);
        },
        update: (docRef: any, data: any) => {
          const rawRef = docRef._ref || docRef;
          transaction.update(rawRef, data);
        },
        set: (docRef: any, data: any, options?: { merge?: boolean }) => {
          const rawRef = docRef._ref || docRef;
          transaction.set(rawRef, data, options || {});
        },
        delete: (docRef: any) => {
          const rawRef = docRef._ref || docRef;
          transaction.delete(rawRef);
        }
      };
      return await updateFunction(wrappedTransaction);
    });
  }
};

// Master AdminAuth object with genuine token verification
let adminAppAuth: any = null;
try {
  /* eslint-disable */
  const admin = require("firebase-admin");
  /* eslint-enable */
  if (admin && admin.apps && admin.apps.length > 0) {
    adminAppAuth = admin.auth();
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : undefined;
      const app = admin.initializeApp(serviceAccount ? {
        credential: admin.credential.cert(serviceAccount)
      } : undefined);
      adminAppAuth = admin.auth(app);
    } catch (e) {
      console.warn("[Firebase Admin Init]: Could not initialize admin auth with service account, falling back to public key verification:", e);
    }
  }
} catch (e) {
  // firebase-admin optional load in lightweight environments
}

// In-memory cache for Google public certs
let cachedCertKeys: Record<string, string> = {};
let certsExpiresAt = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCertKeys && certsExpiresAt > now && Object.keys(cachedCertKeys).length > 0) {
    return cachedCertKeys;
  }

  try {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    if (!res.ok) throw new Error(`Failed to fetch Google x509 certs: ${res.status}`);
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
    certsExpiresAt = now + maxAgeSec * 1000;
    cachedCertKeys = await res.json();
    return cachedCertKeys;
  } catch (err) {
    console.error("[Token Verification Error] Failed to retrieve Google certificates:", err);
    return cachedCertKeys;
  }
}

export const adminAuth = {
  verifyIdToken: async (token: string): Promise<{
    uid: string;
    email: string;
    email_verified?: boolean;
    role?: string;
    [key: string]: any;
  }> => {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw new Error("Invalid token: token cannot be empty");
    }

    const cleanToken = token.trim();

    // 1. If Firebase Admin SDK is initialized with credentials, use official verifyIdToken
    if (adminAppAuth) {
      try {
        const decoded = await adminAppAuth.verifyIdToken(cleanToken);
        return {
          uid: decoded.uid,
          email: decoded.email || "",
          email_verified: decoded.email_verified,
          role: decoded.role || (decoded.email === "miratechindustries@gmail.com" ? "MASTER_ADMIN" : "user"),
          ...decoded
        };
      } catch (adminErr: any) {
        throw new Error(`Firebase token verification failed: ${adminErr.message}`);
      }
    }

    // 2. Perform rigorous cryptographic signature verification against Google's public x509 certs
    const parts = cleanToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format: JWT must contain 3 parts");
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    } catch {
      throw new Error("Invalid token: Malformed JWT header or payload base64");
    }

    if (header.alg !== "RS256" || !header.kid) {
      throw new Error(`Unsupported token algorithm (${header.alg}) or missing kid`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) {
      throw new Error("Token has expired");
    }
    if (!payload.iat || payload.iat > nowSec + 300) {
      throw new Error("Token issued in the future");
    }
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      throw new Error("Token sub (subject) claim is missing or empty");
    }

    // Check Google Firebase audience and issuer
    const projectId = "project-4d647072-e69a-484c-98c";
    if (payload.aud !== projectId) {
      throw new Error(`Token audience mismatch (expected ${projectId}, got ${payload.aud})`);
    }
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIss) {
      throw new Error(`Token issuer mismatch (expected ${expectedIss}, got ${payload.iss})`);
    }

    // Cryptographic signature check with Node.js crypto
    const certs = await getGooglePublicKeys();
    const cert = certs[header.kid];
    if (!cert) {
      throw new Error(`Unknown certificate key ID: ${header.kid}`);
    }

    const crypto = await import("crypto");
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isSignatureValid = verifier.verify(cert, parts[2], "base64url");

    if (!isSignatureValid) {
      throw new Error("Invalid cryptographic token signature");
    }

    return {
      uid: payload.user_id || payload.sub || payload.uid,
      email: payload.email || "",
      email_verified: payload.email_verified ?? false,
      role: payload.role || (payload.email === "miratechindustries@gmail.com" ? "MASTER_ADMIN" : "user"),
      ...payload
    };
  }
};

export default adminDb;
