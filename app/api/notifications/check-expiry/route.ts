
import { NextResponse } from 'next/server';

export async function POST() {
  const { db } = await import('@/lib/firebase');
  const { collection, query, where, getDocs, addDoc } = await import('firebase/firestore');

  try {
    const now = Date.now();
    const threeDaysFromNow = now + (3 * 24 * 60 * 60 * 1000);

    // Query for users with access expiring soon
    const q = query(
      collection(db, 'users'),
      where('accessExpiryDate', '>', now),
      where('accessExpiryDate', '<=', threeDaysFromNow)
    );

    const snapshot = await getDocs(q);
    const usersToNotify = snapshot.docs;

    const notifications = usersToNotify.map(async (userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Create notification for the user
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        businessId: userData.businessId || 'system', // Adjust if necessary
        title: 'Access Expiring Soon',
        message: `Your access is set to expire on ${new Date(userData.accessExpiryDate).toLocaleDateString()}. Please contact support to extend it.`,
        type: 'warning',
        isRead: false,
        createdAt: Date.now(),
      });

      // Also create one for Admin (placeholder businessId)
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin', // Or identify master admin
        businessId: 'system',
        title: 'User Access Expiring',
        message: `Access for user ${userData.email} will expire on ${new Date(userData.accessExpiryDate).toLocaleDateString()}.`,
        type: 'warning',
        isRead: false,
        createdAt: Date.now(),
      });
    });

    await Promise.all(notifications);

    return NextResponse.json({ success: true, count: usersToNotify.length });
  } catch (error) {
    console.error('Error checking expiry:', error);
    return NextResponse.json({ success: false, error: 'Failed to process notifications' }, { status: 500 });
  }
}
