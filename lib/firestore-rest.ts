import firebaseConfig from '@/firebase-applet-config.json';

export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return {
      mapValue: {
        fields,
      },
    };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

/**
 * Persists a document to Firestore using the REST API authenticated with an end-user ID Token.
 */
export async function setFirestoreDocRest(
  collectionPath: string,
  docId: string,
  data: Record<string, any>,
  idToken: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/${collectionPath}/${docId}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(data),
      }),
    });

    const resJson = await res.json();
    if (!res.ok) {
      const errMsg = resJson?.error?.message || `Firestore REST API error (${res.status})`;
      return { success: false, error: errMsg };
    }

    return { success: true, data: resJson };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error in Firestore REST call' };
  }
}

/**
 * Creates an audit log document using the REST API with an ID token.
 */
export async function addFirestoreDocRest(
  collectionPath: string,
  data: Record<string, any>,
  idToken: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/${collectionPath}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(data),
      }),
    });

    const resJson = await res.json();
    if (!res.ok) {
      const errMsg = resJson?.error?.message || `Firestore REST API error (${res.status})`;
      return { success: false, error: errMsg };
    }

    const name = resJson.name || '';
    const id = name.split('/').pop();
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error in Firestore REST call' };
  }
}
