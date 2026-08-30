import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication session required." }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: "Invalid authentication token." }, { status: 401 });
    }

    const { companyId, poId, grnId, invoiceId } = await req.json();

    if (!companyId || !poId || !grnId || !invoiceId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify tenant authorization server-side
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();
    const userCompanyId = userData?.companyId || decodedToken.companyId || decodedToken.businessId;
    const isMasterAdmin = decodedToken.email === "miratechindustries@gmail.com" || decodedToken.role === "MASTER_ADMIN";

    if (!isMasterAdmin && userCompanyId !== companyId && decodedToken.uid !== companyId) {
      return NextResponse.json({ error: "Access denied: Cross-business tenant isolation violation." }, { status: 403 });
    }

    // 1. Fetch documents via Admin SDK
    const poRef = adminDb.collection("companies").doc(companyId).collection("purchase_orders").doc(poId);
    const grnRef = adminDb.collection("companies").doc(companyId).collection("goods_received").doc(grnId);
    const invRef = adminDb.collection("companies").doc(companyId).collection("supplier_invoices").doc(invoiceId);

    const [poSnap, grnSnap, invSnap] = await Promise.all([
      poRef.get(),
      grnRef.get(),
      invRef.get()
    ]);

    if (!poSnap.exists || !grnSnap.exists || !invSnap.exists) {
      return NextResponse.json({ error: "One or more documents not found" }, { status: 404 });
    }

    const po = poSnap.data() || {};
    const grn = grnSnap.data() || {};
    const invoice = invSnap.data() || {};

    const discrepancies: string[] = [];

    // 2. Perform Matching Logic
    const poItems = po.items || [];
    const grnItems = grn.items || [];
    const invItems = invoice.items || [];

    poItems.forEach((poItem: any) => {
        const grnItem = grnItems.find((i: any) => i.name === poItem.name);
        const invItem = invItems.find((i: any) => i.name === poItem.name);
        
        if (grnItem && grnItem.quantity !== poItem.quantity) {
            discrepancies.push(`Quantity discrepancy for ${poItem.name}: Ordered ${poItem.quantity}, Received ${grnItem.quantity}`);
        }
        if (invItem && invItem.quantity !== poItem.quantity) {
            discrepancies.push(`Quantity discrepancy for ${poItem.name}: Ordered ${poItem.quantity}, Invoiced ${invItem.quantity}`);
        }
        if (invItem && invItem.unitPrice !== poItem.unitPrice) {
            discrepancies.push(`Price discrepancy for ${poItem.name}: Ordered at ${poItem.unitPrice}, Invoiced at ${invItem.unitPrice}`);
        }
    });

    return NextResponse.json({
        matched: discrepancies.length === 0,
        discrepancies
    });

  } catch (error: any) {
    console.error("Three-way matching error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

