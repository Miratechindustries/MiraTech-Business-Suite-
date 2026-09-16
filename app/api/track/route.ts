import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, postId, sourcePlatform, conversionType, companyId } = await req.json();
    
    if (!campaignId || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify campaign exists
    const campaignRef = adminDb.collection('companies').doc(companyId).collection('campaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();
    
    if (!campaignSnap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Store lead
    await adminDb.collection('companies').doc(companyId).collection('leads').add({
      companyId,
      campaignId,
      postId: postId || 'unknown',
      sourcePlatform: sourcePlatform || 'web',
      conversionType: conversionType || 'click',
      timestamp: Timestamp.now()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
