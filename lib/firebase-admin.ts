/**
 * MiraTech Business Suite - Firebase Admin & Server SDK Utilities
 * 
 * Provides server-side authentication verification and Firestore database access
 * without bundling client-side grpc/protobuf modules into Next.js server builds.
 */

let adminAppAuth: any = null;
let adminFirestoreInstance: any = null;

try {
  /* eslint-disable */
  const admin = require("firebase-admin");
  /* eslint-enable */
  if (admin && admin.apps && admin.apps.length > 0) {
    try {
      adminAppAuth = admin.auth();
      adminFirestoreInstance = admin.firestore();
    } catch (e) {
      // Ignored if app not fully bound
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : undefined;
      const app = admin.initializeApp(serviceAccount ? {
        credential: admin.credential.cert(serviceAccount)
      } : undefined);
      adminAppAuth = admin.auth(app);
      adminFirestoreInstance = admin.firestore(app);
    } catch (e) {
      console.warn("[Firebase Admin Init]: Could not initialize admin SDK with service account:", e);
    }
  } else {
    try {
      const defaultApp = admin.initializeApp();
      adminAppAuth = admin.auth(defaultApp);
      adminFirestoreInstance = admin.firestore(defaultApp);
    } catch (e) {
      // already initialized or fallback
    }
  }
} catch (e) {
  // firebase-admin optional load in lightweight environments
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
          const docRef = await colRef.add({ ...data, createdAt: adminFirestoreInstance ? require("firebase-admin").firestore.FieldValue.serverTimestamp() : new Date() });
          return { id: docRef.id, _ref: docRef };
        },
        where: (fieldPath: string, opStr: string, value: any): any => {
          const queryRef = colRef.where(fieldPath, opStr, value);
          return createAdminQueryWrapper(queryRef, adminFirestoreInstance);
        },
        limit: (num: number): any => {
          const queryRef = colRef.limit(num);
          return createAdminQueryWrapper(queryRef, adminFirestoreInstance);
        },
        orderBy: (fieldPath: string, directionStr?: string): any => {
          const queryRef = colRef.orderBy(fieldPath, directionStr || 'asc');
          return createAdminQueryWrapper(queryRef, adminFirestoreInstance);
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

function createAdminQueryWrapper(queryRef: any, adminFirestore: any): any {
  return {
    where: (fieldPath: string, opStr: string, value: any): any => {
      return createAdminQueryWrapper(queryRef.where(fieldPath, opStr, value), adminFirestore);
    },
    limit: (num: number): any => {
      return createAdminQueryWrapper(queryRef.limit(num), adminFirestore);
    },
    orderBy: (fieldPath: string, directionStr?: string): any => {
      return createAdminQueryWrapper(queryRef.orderBy(fieldPath, directionStr || 'asc'), adminFirestore);
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
