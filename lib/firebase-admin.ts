import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

/**
 * MiraTech Business Suite - Firebase Admin & Server SDK Utilities
 * 
 * Provides server-side authentication verification and Firestore database access.
 * Explicitly forbids falling back to client-side SDK in server contexts.
 */

export let adminAppAuth: any = null;
export let adminFirestoreInstance: any = null;

try {
  let app;
  if (getApps().length > 0) {
    app = getApp();
    console.log("[Firebase Admin]: Initialized from existing app.");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    app = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("[Firebase Admin]: Initialized from SERVICE_ACCOUNT_KEY.");
  } else {
    // Attempt default initialization in server environment
    app = initializeApp();
    console.log("[Firebase Admin]: Initialized from default credentials.");
  }
  
  adminAppAuth = getAuth(app);
  adminFirestoreInstance = getFirestore(app);
  console.log("[Firebase Admin]: Successfully initialized.");
} catch (e) {
  console.error("[Firebase Admin]: Critical initialization failure:", e);
  // Do NOT fallback to client-side. Server-side must have Admin SDK configured correctly.
  throw new Error(`Firebase Admin SDK failed to initialize: ${(e as Error).message}`);
}

function getClientDb(): any {
  const { db } = require("./firebase");
  return db;
}

function getClientFirestoreFns(): any {
  return require("firebase/firestore");
}

export const adminDb = {
  collection: (colName: string): any => {
    if (adminFirestoreInstance) {
      const colRef = adminFirestoreInstance.collection(colName);
      return {
        id: colName,
        path: colName,
        _ref: colRef,
        doc: (docId?: string): any => {
          const docRef = docId ? colRef.doc(docId) : colRef.doc();
          return {
            id: docRef.id,
            path: docRef.path,
            _ref: docRef,
            get: async () => {
              const snap = await docRef.get();
              return {
                id: snap.id,
                exists: snap.exists,
                data: () => snap.data(),
                ref: docRef,
              };
            },
            set: async (data: any, options?: { merge?: boolean }) => {
              return await docRef.set(data, options || {});
            },
            update: async (data: any) => {
              return await docRef.update(data);
            },
            delete: async () => {
              return await docRef.delete();
            },
            collection: (subColName: string): any => {
              return adminDb.collection(`${colName}/${docRef.id}/${subColName}`);
            }
          };
        },
        add: async (data: any) => {
          const { FieldValue } = require("firebase-admin/firestore");
          const docRef = await colRef.add({ ...data, createdAt: FieldValue.serverTimestamp() });
          return { id: docRef.id, _ref: docRef };
        },
        where: (fieldPath: string, opStr: string, value: any): any => {
          const queryRef = colRef.where(fieldPath, opStr, value);
          return createAdminQueryWrapper(queryRef);
        },
        limit: (num: number): any => {
          const queryRef = colRef.limit(num);
          return createAdminQueryWrapper(queryRef);
        },
        orderBy: (fieldPath: string, directionStr?: string): any => {
          const queryRef = colRef.orderBy(fieldPath, directionStr || 'asc');
          return createAdminQueryWrapper(queryRef);
        },
        get: async () => {
          const snap = await colRef.get();
          const docs = snap.docs.map((d: any) => ({
            id: d.id,
            exists: d.exists,
            data: () => d.data(),
            ref: d.ref,
          }));
          return {
            docs,
            size: docs.length,
            empty: docs.length === 0,
            forEach: (cb: any) => docs.forEach(cb),
          };
        }
      };
    } else {
      const clientDb = getClientDb();
      const { collection: clientCol, doc: clientDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc, query, where, limit, orderBy } = getClientFirestoreFns();
      const colRef = clientCol(clientDb, colName);
      return {
        id: colName,
        path: colName,
        _ref: colRef,
        doc: (docId?: string): any => {
          const docRef = docId ? clientDoc(clientDb, colName, docId) : clientDoc(colRef);
          return {
            id: docRef.id,
            path: docRef.path,
            _ref: docRef,
            get: async () => {
              const snap = await getDoc(docRef);
              return {
                id: snap.id,
                exists: snap.exists(),
                data: () => snap.data(),
                ref: docRef,
              };
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
            collection: (subColName: string): any => {
              return adminDb.collection(`${colName}/${docRef.id}/${subColName}`);
            }
          };
        },
        add: async (data: any) => {
          const docRef = await addDoc(colRef, data);
          return { id: docRef.id, _ref: docRef };
        },
        where: (fieldPath: string, opStr: any, value: any): any => {
          const q = query(colRef, where(fieldPath, opStr, value));
          return createClientQueryWrapper(q, clientDb);
        },
        limit: (num: number): any => {
          const q = query(colRef, limit(num));
          return createClientQueryWrapper(q, clientDb);
        },
        orderBy: (fieldPath: string, directionStr?: any): any => {
          const q = query(colRef, orderBy(fieldPath, directionStr));
          return createClientQueryWrapper(q, clientDb);
        },
        get: async () => {
          const snap = await getDocs(colRef);
          const docs = snap.docs.map((d: any) => ({
            id: d.id,
            exists: d.exists(),
            data: () => d.data(),
            ref: d.ref,
          }));
          return {
            docs,
            size: docs.length,
            empty: docs.length === 0,
            forEach: (cb: any) => docs.forEach(cb),
          };
        }
      };
    }
  },
  doc: (path: string): any => {
    const parts = path.split("/");
    const colName = parts.slice(0, -1).join("/");
    const docId = parts[parts.length - 1];
    return adminDb.collection(colName).doc(docId);
  },
  batch: (): any => {
    if (adminFirestoreInstance) {
      const b = adminFirestoreInstance.batch();
      return {
        set: (docRef: any, data: any, options?: { merge?: boolean }) => {
          b.set(docRef._ref || docRef, data, options || {});
          return this;
        },
        update: (docRef: any, data: any) => {
          b.update(docRef._ref || docRef, data);
          return this;
        },
        delete: (docRef: any) => {
          b.delete(docRef._ref || docRef);
          return this;
        },
        commit: async () => await b.commit()
      };
    } else {
      const clientDb = getClientDb();
      const { writeBatch } = getClientFirestoreFns();
      const b = writeBatch(clientDb);
      return {
        set: (docRef: any, data: any, options?: { merge?: boolean }) => {
          b.set(docRef._ref || docRef, data, options || {});
          return this;
        },
        update: (docRef: any, data: any) => {
          b.update(docRef._ref || docRef, data);
          return this;
        },
        delete: (docRef: any) => {
          b.delete(docRef._ref || docRef);
          return this;
        },
        commit: async () => await b.commit()
      };
    }
  },
  runTransaction: async (updateFunction: (transaction: any) => Promise<any>): Promise<any> => {
    if (adminFirestoreInstance) {
      return await adminFirestoreInstance.runTransaction(async (t: any) => {
        const wrappedTransaction = {
          get: async (docRef: any) => {
            const snap = await t.get(docRef._ref || docRef);
            return {
              id: snap.id,
              exists: snap.exists,
              data: () => snap.data(),
              ref: docRef,
            };
          },
          update: (docRef: any, data: any) => {
            t.update(docRef._ref || docRef, data);
          },
          set: (docRef: any, data: any, options?: { merge?: boolean }) => {
            t.set(docRef._ref || docRef, data, options || {});
          },
          delete: (docRef: any) => {
            t.delete(docRef._ref || docRef);
          }
        };
        return await updateFunction(wrappedTransaction);
      });
    } else {
      const clientDb = getClientDb();
      const { runTransaction: clientRunTransaction } = getClientFirestoreFns();
      return await clientRunTransaction(clientDb, async (t: any) => {
        const wrappedTransaction = {
          get: async (docRef: any) => {
            const snap = await t.get(docRef._ref || docRef);
            return {
              id: snap.id,
              exists: snap.exists(),
              data: () => snap.data(),
              ref: docRef,
            };
          },
          update: (docRef: any, data: any) => {
            t.update(docRef._ref || docRef, data);
          },
          set: (docRef: any, data: any, options?: { merge?: boolean }) => {
            t.set(docRef._ref || docRef, data, options || {});
          },
          delete: (docRef: any) => {
            t.delete(docRef._ref || docRef);
          }
        };
        return await updateFunction(wrappedTransaction);
      });
    }
  }
};

function createAdminQueryWrapper(queryRef: any): any {
  return {
    where: (fieldPath: string, opStr: string, value: any): any => {
      return createAdminQueryWrapper(queryRef.where(fieldPath, opStr, value));
    },
    limit: (num: number): any => {
      return createAdminQueryWrapper(queryRef.limit(num));
    },
    orderBy: (fieldPath: string, directionStr?: string): any => {
      return createAdminQueryWrapper(queryRef.orderBy(fieldPath, directionStr || 'asc'));
    },
    get: async () => {
      const snap = await queryRef.get();
      const docs = snap.docs.map((d: any) => ({
        id: d.id,
        exists: d.exists,
        data: () => d.data(),
        ref: d.ref,
      }));
      return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (cb: any) => docs.forEach(cb),
      };
    }
  };
}

function createClientQueryWrapper(q: any, clientDb: any): any {
  const { getDocs, query, where, limit, orderBy } = getClientFirestoreFns();
  return {
    where: (fieldPath: string, opStr: any, value: any): any => {
      return createClientQueryWrapper(query(q, where(fieldPath, opStr, value)), clientDb);
    },
    limit: (num: number): any => {
      return createClientQueryWrapper(query(q, limit(num)), clientDb);
    },
    orderBy: (fieldPath: string, directionStr?: any): any => {
      return createClientQueryWrapper(query(q, orderBy(fieldPath, directionStr)), clientDb);
    },
    get: async () => {
      const snap = await getDocs(q);
      const docs = snap.docs.map((d: any) => ({
        id: d.id,
        exists: d.exists(),
        data: () => d.data(),
        ref: d.ref,
      }));
      return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (cb: any) => docs.forEach(cb),
      };
    }
  };
}

export const adminAuth = {
  async verifyIdToken(token: string): Promise<{
    uid: string;
    email: string;
    email_verified?: boolean;
    role?: string;
    [key: string]: any;
  }> {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw new Error("Invalid token: token cannot be empty");
    }

    const cleanToken = token.trim();

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

    const projectId = "project-4d647072-e69a-484c-98c";
    if (payload.aud !== projectId) {
      throw new Error(`Token audience mismatch (expected ${projectId}, got ${payload.aud})`);
    }
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIss) {
      throw new Error(`Token issuer mismatch (expected ${expectedIss}, got ${payload.iss})`);
    }

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

export async function verifyAdminUser(
  req: NextRequest,
  requiredRole?: "MASTER_ADMIN" | "ADMIN" | "MARKETING"
): Promise<{ uid: string; email: string; role: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.split("Bearer ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  let isAdmin = false;
  let userRole = decoded.role || "user";

  if (decoded.email === "miratechindustries@gmail.com") {
    isAdmin = true;
    userRole = "MASTER_ADMIN";
  } else {
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.isMasterAdmin || userData.isAdmin || userData.role === "admin") {
        isAdmin = true;
        userRole = userData.role || "ADMIN";
      } else if (requiredRole === "MARKETING" && (userData.department === "marketing" || userData.role === "marketing")) {
        isAdmin = true;
        userRole = "MARKETING";
      }
    }
  }

  if (!isAdmin || (requiredRole && userRole !== requiredRole && userRole !== "MASTER_ADMIN")) {
    throw new Error("Insufficient permissions");
  }

  return { uid: decoded.uid, email: decoded.email, role: userRole };
}

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

export default adminDb;
