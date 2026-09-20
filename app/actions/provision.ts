'use server';

import { adminAppAuth, adminDb } from '@/lib/firebase-admin';
import { SUBSCRIPTION_PLANS, getLockedFeaturesForPlan } from '@/lib/subscriptions';
import firebaseConfig from '@/firebase-applet-config.json';

async function createOrLookupAuthUser(email: string, password?: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password || `MiraTech_${Date.now()}_!`;

  // Try Admin SDK first if configured
  if (adminAppAuth) {
    try {
      const userRecord = await adminAppAuth.createUser({
        email: cleanEmail,
        password: cleanPassword,
      });
      return userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-exists') {
        try {
          const existing = await adminAppAuth.getUserByEmail(cleanEmail);
          return existing.uid;
        } catch (_) {}
      }
    }
  }

  // Fallback to Firebase Identity Toolkit REST API with project API key
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          returnSecureToken: true,
        }),
      }
    );

    const data = await res.json();
    if (res.ok && data.localId) {
      return data.localId;
    }

    if (data?.error?.message === 'EMAIL_EXISTS') {
      // User already exists in Firebase Auth, attempt sign-in to get UID
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPassword,
            returnSecureToken: true,
          }),
        }
      );
      const signInData = await signInRes.json();
      if (signInRes.ok && signInData.localId) {
        return signInData.localId;
      }
    }
  } catch (err) {
    console.warn('[Provision Auth REST Warning]:', err);
  }

  // Fallback deterministic UID based on email hash
  const crypto = await import('crypto');
  return 'usr_' + crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 24);
}

export async function provisionTenantAction(payload: any) {
  const { 
    accountEmail, 
    accountPassword, 
    companyName, 
    registrationNumber, 
    taxVatNumber, 
    industry, 
    businessType, 
    businessAddress, 
    businessCity, 
    businessCountry, 
    businessWebsite, 
    businessOfficialEmail, 
    businessOfficialPhone, 
    employeeRange, 
    branchCount, 
    currency, 
    selectedModules, 
    selectedDepartments, 
    accountFullName, 
    accountPhone, 
    adminPositionTitle, 
    initialRole, 
    permissions, 
    staffList, 
    subscriptionPlanId, 
    billingCycle,
    paddleSubId,
    paddleCustId
  } = payload;

  try {
    // 1. Provision Primary Administrator Auth Account
    const adminUid = await createOrLookupAuthUser(accountEmail, accountPassword);

    // 2. Provision Staff Auth Accounts
    const staffUids: string[] = [];
    for (const staff of staffList || []) {
      const sUid = await createOrLookupAuthUser(staff.email, staff.password);
      staffUids.push(sUid);
    }

    // 3. Write Company / Business Profile
    const selectedPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === subscriptionPlanId) || SUBSCRIPTION_PLANS[2];
    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const companyPayload = {
      id: adminUid,
      ownerId: adminUid,
      name: companyName,
      legalName: companyName,
      registrationNumber: registrationNumber || "UNREGISTERED",
      taxVatNumber: taxVatNumber || "",
      industry,
      businessType,
      address: `${businessAddress}, ${businessCity}, ${businessCountry}`,
      city: businessCity,
      country: businessCountry,
      website: businessWebsite || "",
      officialEmail: businessOfficialEmail || accountEmail,
      officialPhone: businessOfficialPhone || accountPhone,
      employeeRange,
      branchCount,
      currency,
      activeModules: selectedModules,
      activeDepartments: selectedDepartments,
      email: accountEmail,
      phone: accountPhone,
      createdAt: new Date().toISOString(),
      subscriptionPlanId,
      subscriptionPlan: selectedPlanObj.name,
      subscriptionStatus: subscriptionPlanId === 'free' ? 'active' : 'trialing',
      subscriptionBillingCycle: billingCycle,
      subscriptionTrialEndsAt: trialEndDate,
      lockedFeatures: getLockedFeaturesForPlan(subscriptionPlanId),
      paddleSubscriptionId: paddleSubId,
      paddleCustomerId: paddleCustId,
    };

    await adminDb.collection('companies').doc(adminUid).set(companyPayload);
    await adminDb.collection('businesses').doc(adminUid).set(companyPayload);

    // 4. Create User Documents
    await adminDb.collection('users').doc(adminUid).set({
      id: adminUid,
      displayName: accountFullName,
      email: accountEmail,
      role: initialRole,
      positionTitle: adminPositionTitle,
      companyId: adminUid,
      businessId: adminUid,
      status: 'ACTIVE',
      permissions,
      createdAt: new Date().toISOString(),
    });

    for (let i = 0; i < staffList.length; i++) {
      await adminDb.collection('users').doc(staffUids[i]).set({
        id: staffUids[i],
        displayName: staffList[i].fullName,
        email: staffList[i].email,
        role: staffList[i].role || 'STAFF',
        companyId: adminUid,
        businessId: adminUid,
        status: 'ACTIVE',
        departments: staffList[i].departments || ['sales'],
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, adminUid };
  } catch (err: any) {
    console.error("Provisioning Server Action Error:", err);
    return { success: false, error: err.message };
  }
}
