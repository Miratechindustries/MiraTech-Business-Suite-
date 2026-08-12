import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const { companyId, poId, grnId, invoiceId } = await req.json();

    if (!companyId || !poId || !grnId || !invoiceId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch documents
    const poRef = doc(db, "companies", companyId, "purchase_orders", poId);
    const grnRef = doc(db, "companies", companyId, "goods_received", grnId);
    const invRef = doc(db, "companies", companyId, "supplier_invoices", invoiceId);

    const [poSnap, grnSnap, invSnap] = await Promise.all([
      getDoc(poRef),
      getDoc(grnRef),
      getDoc(invRef)
    ]);

    if (!poSnap.exists() || !grnSnap.exists() || !invSnap.exists()) {
      return NextResponse.json({ error: "One or more documents not found" }, { status: 404 });
    }

    const po = poSnap.data();
    const grn = grnSnap.data();
    const invoice = invSnap.data();

    const discrepancies = [];

    // 2. Perform Matching Logic (Simplified)
    // Assuming items are arrays of { name, quantity, unitPrice }
    
    // Check Quantities: PO vs GRN vs Invoice
    po.items.forEach((poItem: any) => {
        const grnItem = grn.items.find((i: any) => i.name === poItem.name);
        const invItem = invoice.items.find((i: any) => i.name === poItem.name);
        
        if (grnItem && grnItem.quantity !== poItem.quantity) {
            discrepancies.push(`Quantity discrepancy for ${poItem.name}: Ordered ${poItem.quantity}, Received ${grnItem.quantity}`);
        }
        if (invItem && invItem.quantity !== poItem.quantity) {
            discrepancies.push(`Quantity discrepancy for ${poItem.name}: Ordered ${poItem.quantity}, Invoiced ${invItem.quantity}`);
        }
        
        // Check Price: PO vs Invoice
        if (invItem && invItem.unitPrice !== poItem.unitPrice) {
            discrepancies.push(`Price discrepancy for ${poItem.name}: Ordered at ${poItem.unitPrice}, Invoiced at ${invItem.unitPrice}`);
        }
    });

    return NextResponse.json({
        matched: discrepancies.length === 0,
        discrepancies
    });

  } catch (error) {
    console.error("Three-way matching error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
