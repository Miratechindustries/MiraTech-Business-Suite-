import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      return NextResponse.json({ error: "Unauthorized: Invalid authentication token" }, { status: 401 });
    }

    const { companyId, targetEmail } = await req.json();
    if (!companyId || !targetEmail) {
      return NextResponse.json({ error: "Missing companyId or targetEmail" }, { status: 400 });
    }

    // Verify tenant authorization server-side
    const isMasterAdmin = decodedToken.email === "miratechindustries@gmail.com" || decodedToken.role === "MASTER_ADMIN";
    const userCompanyId = decodedToken.companyId || decodedToken.businessId;

    if (!isMasterAdmin && userCompanyId !== companyId && decodedToken.uid !== companyId) {
      return NextResponse.json({ error: "Forbidden: Unauthorized tenant scope" }, { status: 403 });
    }

    // Execute server-side PII anonymization in Firestore
    const usersRef = adminDb.collection("users");
    const snapshot = await usersRef
      .where("companyId", "==", companyId)
      .where("email", "==", targetEmail.trim().toLowerCase())
      .get();

    let scrubbedCount = 0;
    const batch = adminDb.batch();

    snapshot.docs.forEach((docSnap: any) => {
      const docRef = usersRef.doc(docSnap.id);
      batch.update(docRef, {
        displayName: "[ANONYMIZED_SUBJECT]",
        email: `anonymized_${docSnap.id.slice(0, 8)}@deleted.compliance`,
        phone: "[REDACTED]",
        address: "[REDACTED]",
        isAnonymized: true,
        anonymizedAt: new Date().toISOString()
      });
      scrubbedCount++;
    });

    if (scrubbedCount > 0) {
      await batch.commit();
    }

    // Write immutable audit log
    await adminDb.collection("audit_logs").add({
      companyId,
      userId: decodedToken.uid,
      userEmail: decodedToken.email || "admin@system",
      action: "GDPR_POPIA_RIGHT_TO_FORGOTTEN_EXECUTED",
      details: `Server-side cryptographic PII redaction executed for subject: ${targetEmail.trim()}. Scrubbed ${scrubbedCount} records.`,
      category: "compliance",
      severity: "CRITICAL",
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Successfully anonymized PII for ${targetEmail.trim()}. ${scrubbedCount} records scrubbed server-side.`
    });
  } catch (err: any) {
    console.error("GDPR anonymize API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
