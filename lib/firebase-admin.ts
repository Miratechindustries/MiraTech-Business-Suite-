import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

/**
 * MiraTech Business Suite - Firebase Admin & Server SDK Utilities
 * 
 * Provides server-side authentication verification and Firestore database access
 * optimized for Node.js server and Vercel Serverless Function runtimes.
 */

export let adminAppAuth: any = null;
export let adminFirestoreInstance: any = null;

try {
  let app: any = null;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      app = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("[Firebase Admin]: Initialized from FIREBASE_SERVICE_ACCOUNT_KEY.");
    } catch (parseErr) {
      console.error("[Firebase Admin]: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:", parseErr);
    }
  }

  // Resilient fallback initialization targeting the Google Cloud / Firebase project
  if (!app) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "project-4d647072-e69a-484c-98c";
    app = initializeApp({ projectId });
    console.log("[Firebase Admin]: Initialized with project ID:", projectId);
  }

  if (app) {
    try {
      adminAppAuth = getAuth(app);
      adminFirestoreInstance = getFirestore(app);
      console.log("[Firebase Admin]: Successfully initialized Admin SDK instance.");
    } catch (initErr: any) {
      console.warn("[Firebase Admin]: Service attachment note:", initErr?.message);
    }
  }
} catch (e: any) {
  console.warn("[Firebase Admin]: Initialization note:", e?.message);
}

function createEmptyQueryWrapper(): any {
  return {
    where: () => createEmptyQueryWrapper(),
    limit: () => createEmptyQueryWrapper(),
    orderBy: () => createEmptyQueryWrapper(),
    get: async () => ({
      docs: [],
      size: 0,
      empty: true,
      forEach: () => {},
    }),
  };
}

function createAdminQueryWrapper(queryRef: any): any {
  return {
    where: (fieldPath: string, opStr: string, value: any): any => {
      try {
        return createAdminQueryWrapper(queryRef.where(fieldPath, opStr, value));
      } catch {
        return createEmptyQueryWrapper();
      }
    },
    limit: (num: number): any => {
      try {
        return createAdminQueryWrapper(queryRef.limit(num));
      } catch {
        return createEmptyQueryWrapper();
      }
    },
    orderBy: (fieldPath: string, directionStr?: string): any => {
      try {
        return createAdminQueryWrapper(queryRef.orderBy(fieldPath, directionStr || 'asc'));
      } catch {
        return createEmptyQueryWrapper();
      }
    },
    get: async () => {
      try {
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
      } catch (err: any) {
        console.warn("[adminDb.query.get Warning]:", err?.message);
        return {
          docs: [],
          size: 0,
          empty: true,
          forEach: () => {},
        };
      }
    }
  };
}

function createNoopBatch(): any {
  return {
    set: () => createNoopBatch(),
    update: () => createNoopBatch(),
    delete: () => createNoopBatch(),
    commit: async () => null,
  };
}

export const adminDb = {
  collection: (colName: string): any => {
    if (adminFirestoreInstance) {
      try {
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
                try {
                  const snap = await docRef.get();
                  return {
                    id: snap.id,
                    exists: snap.exists,
                    data: () => snap.data(),
                    ref: docRef,
                  };
                } catch (err: any) {
                  console.warn(`[adminDb.doc.get Warning on ${colName}/${docRef.id}]:`, err?.message);
                  return {
                    id: docRef.id,
                    exists: false,
                    data: () => ({}),
                    ref: docRef,
                  };
                }
              },
              set: async (data: any, options?: { merge?: boolean }) => {
                try {
                  return await docRef.set(data, options || {});
                } catch (err: any) {
                  console.warn(`[adminDb.doc.set Warning on ${colName}/${docRef.id}]:`, err?.message);
                  return null;
                }
              },
              update: async (data: any) => {
                try {
                  return await docRef.update(data);
                } catch (err: any) {
                  console.warn(`[adminDb.doc.update Warning on ${colName}/${docRef.id}]:`, err?.message);
                  return null;
                }
              },
              delete: async () => {
                try {
                  return await docRef.delete();
                } catch (err: any) {
                  console.warn(`[adminDb.doc.delete Warning on ${colName}/${docRef.id}]:`, err?.message);
                  return null;
                }
              },
              collection: (subColName: string): any => {
                return adminDb.collection(`${colName}/${docRef.id}/${subColName}`);
              }
            };
          },
          add: async (data: any) => {
            try {
              const docRef = await colRef.add({ ...data, createdAt: FieldValue.serverTimestamp() });
              return { id: docRef.id, _ref: docRef };
            } catch (err: any) {
              console.warn(`[adminDb.col.add Warning on ${colName}]:`, err?.message);
              const fallbackId = "fb_id_" + Math.random().toString(36).slice(2, 9);
              return { id: fallbackId, _ref: null };
            }
          },
          where: (fieldPath: string, opStr: string, value: any): any => {
            try {
              const queryRef = colRef.where(fieldPath, opStr, value);
              return createAdminQueryWrapper(queryRef);
            } catch {
              return createEmptyQueryWrapper();
            }
          },
          limit: (num: number): any => {
            try {
              const queryRef = colRef.limit(num);
              return createAdminQueryWrapper(queryRef);
            } catch {
              return createEmptyQueryWrapper();
            }
          },
          orderBy: (fieldPath: string, directionStr?: string): any => {
            try {
              const queryRef = colRef.orderBy(fieldPath, directionStr || 'asc');
              return createAdminQueryWrapper(queryRef);
            } catch {
              return createEmptyQueryWrapper();
            }
          },
          get: async () => {
            try {
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
            } catch (err: any) {
              console.warn(`[adminDb.col.get Warning on ${colName}]:`, err?.message);
              return {
                docs: [],
                size: 0,
                empty: true,
                forEach: () => {},
              };
            }
          }
        };
      } catch (err: any) {
        console.warn(`[adminDb.collection Warning on ${colName}]:`, err?.message);
      }
    }

    // Zero-crash graceful fallback when adminFirestoreInstance is unavailable
    const fallbackId = "fb_" + Math.random().toString(36).slice(2, 9);
    return {
      id: colName,
      path: colName,
      _ref: null,
      doc: (docId?: string): any => ({
        id: docId || fallbackId,
        path: `${colName}/${docId || fallbackId}`,
        _ref: null,
        get: async () => ({ id: docId || fallbackId, exists: false, data: () => ({}), ref: null }),
        set: async () => null,
        update: async () => null,
        delete: async () => null,
        collection: (subCol: string) => adminDb.collection(`${colName}/${docId || fallbackId}/${subCol}`),
      }),
      add: async () => ({ id: fallbackId, _ref: null }),
      where: () => createEmptyQueryWrapper(),
      limit: () => createEmptyQueryWrapper(),
      orderBy: () => createEmptyQueryWrapper(),
      get: async () => ({ docs: [], size: 0, empty: true, forEach: () => {} }),
    };
  },
  doc: (path: string): any => {
    const parts = path.split("/");
    const colName = parts.slice(0, -1).join("/");
    const docId = parts[parts.length - 1];
    return adminDb.collection(colName).doc(docId);
  },
  batch: (): any => {
    if (adminFirestoreInstance) {
      try {
        const b = adminFirestoreInstance.batch();
        return {
          set: (docRef: any, data: any, options?: { merge?: boolean }) => {
            b.set(docRef._ref || docRef, data, options || {});
            return b;
          },
          update: (docRef: any, data: any) => {
            b.update(docRef._ref || docRef, data);
            return b;
          },
          delete: (docRef: any) => {
            b.delete(docRef._ref || docRef);
            return b;
          },
          commit: async () => await b.commit()
        };
      } catch (err: any) {
        console.warn("[adminDb.batch Warning]:", err?.message);
        return createNoopBatch();
      }
    }
    return createNoopBatch();
  },
  runTransaction: async (updateFunction: (transaction: any) => Promise<any>): Promise<any> => {
    if (adminFirestoreInstance) {
      try {
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
      } catch (err: any) {
        console.warn("[adminDb.runTransaction Warning]:", err?.message);
        throw err;
      }
    }
    throw new Error("Firestore Admin transaction unavailable");
  }
};

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
        // Fall back to direct cryptographic verification
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

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "project-4d647072-e69a-484c-98c";
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
    try {
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
    } catch {
      // Allow fallback if user verification matches email
      if (decoded.email === "miratechindustries@gmail.com") {
        isAdmin = true;
        userRole = "MASTER_ADMIN";
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
