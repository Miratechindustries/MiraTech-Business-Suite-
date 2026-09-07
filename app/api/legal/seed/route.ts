import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { LEGAL_DOCUMENTS, LegalDocument } from "@/lib/legalData";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const docsSnapshot = await adminDb.collection("legal_documents").get();
    
    if (docsSnapshot.empty) {
      // Auto-seed if collection is currently empty
      const batchWrites = LEGAL_DOCUMENTS.map(async (doc) => {
        const docRef = adminDb.collection("legal_documents").doc(doc.slug);
        const { versions, ...docData } = doc;
        await docRef.set({
          ...docData,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Seed previous versions subcollection
        if (versions && versions.length > 0) {
          for (const ver of versions) {
            await docRef.collection("previous_versions").doc(ver.version).set({
              ...ver,
              createdAt: new Date().toISOString(),
            });
          }
        }
      });

      await Promise.all(batchWrites);
      return NextResponse.json({ 
        seeded: true, 
        count: LEGAL_DOCUMENTS.length,
        documents: LEGAL_DOCUMENTS 
      });
    }

    const fetchedDocs: any[] = [];
    for (const snap of docsSnapshot.docs) {
      const data = snap.data();
      const versionsSnap = await snap.ref.collection("previous_versions").get();
      const versions = versionsSnap.docs.map((v: any) => v.data());
      fetchedDocs.push({
        id: snap.id,
        ...data,
        versions: versions.length > 0 ? versions : (data.versions || [])
      });
    }

    return NextResponse.json({
      seeded: false,
      count: fetchedDocs.length,
      documents: fetchedDocs
    });
  } catch (error: any) {
    console.error("Legal documents fetch / seed error:", error);
    // Fallback to in-memory dataset
    return NextResponse.json({
      seeded: false,
      count: LEGAL_DOCUMENTS.length,
      documents: LEGAL_DOCUMENTS,
      warning: error.message
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const results = [];
    for (const doc of LEGAL_DOCUMENTS) {
      const docRef = adminDb.collection("legal_documents").doc(doc.slug);
      const { versions, ...docData } = doc;
      await docRef.set({
        ...docData,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (versions && versions.length > 0) {
        for (const ver of versions) {
          await docRef.collection("previous_versions").doc(ver.version).set({
            ...ver,
            createdAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
      results.push(doc.slug);
    }

    return NextResponse.json({
      success: true,
      seededSlugs: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Failed to seed legal documents:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
