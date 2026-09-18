/**
 * MiraTech Business Suite - Strict Server-Side Tenant Validation Middleware
 * 
 * Intercepts API requests to verify authenticated user session, tenant ID,
 * active membership, and role permissions before executing database operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";

export interface TenantContext {
  uid: string;
  email: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';
  permissions: string[];
}

/**
 * Validates request authorization and tenant membership.
 */
export async function validateTenantAccess(
  req: NextRequest,
  requiredPermission?: string
): Promise<{ context?: TenantContext; errorResponse?: NextResponse }> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        errorResponse: NextResponse.json({ error: "Unauthorized: Missing or invalid authorization token" }, { status: 401 }),
      };
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";

    // Extract tenantId from headers ('x-tenant-id') or query / URL params
    const tenantId = req.headers.get("x-tenant-id") || new URL(req.url).searchParams.get("tenantId");

    if (!tenantId) {
      return {
        errorResponse: NextResponse.json({ error: "Forbidden: Tenant ID not provided in request headers or parameters" }, { status: 400 }),
      };
    }

    // Verify user membership in tenant
    const membershipSnap = await adminDb
      .collection("companyMemberships")
      .where("userId", "==", uid)
      .where("companyId", "==", tenantId)
      .limit(1)
      .get();

    if (membershipSnap.empty) {
      // Also check if user is master admin
      const userDoc = await adminDb.collection("users").doc(uid).get();
      const userData = userDoc.data();
      const isMasterAdmin = userData?.role === 'master_admin' || userData?.isMasterAdmin === true;

      if (!isMasterAdmin) {
        return {
          errorResponse: NextResponse.json({ error: "Forbidden: User does not belong to this tenant" }, { status: 403 }),
        };
      }

      return {
        context: {
          uid,
          email,
          tenantId,
          role: 'owner',
          permissions: ['*'],
        },
      };
    }

    const membership = membershipSnap.docs[0].data();
    const role = membership.role || 'staff';
    const permissions = membership.permissions || [];

    if (requiredPermission && requiredPermission !== '*' && !permissions.includes(requiredPermission) && role !== 'owner' && role !== 'admin') {
      return {
        errorResponse: NextResponse.json({ error: `Forbidden: Insufficient permissions (required: ${requiredPermission})` }, { status: 403 }),
      };
    }

    return {
      context: {
        uid,
        email,
        tenantId,
        role,
        permissions,
      },
    };
  } catch (err: any) {
    console.error("[TenantMiddleware] Authentication error:", err);
    return {
      errorResponse: NextResponse.json({ error: `Authentication failed: ${err?.message || 'Invalid token'}` }, { status: 401 }),
    };
  }
}
