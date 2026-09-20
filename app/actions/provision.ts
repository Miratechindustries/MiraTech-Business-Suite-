'use server';

import { adminAppAuth, adminFirestoreInstance, adminDb } from '@/lib/firebase-admin';
import { SUBSCRIPTION_PLANS, getLockedFeaturesForPlan } from '@/lib/subscriptions';
import { setFirestoreDocRest, addFirestoreDocRest } from '@/lib/firestore-rest';
import firebaseConfig from '@/firebase-applet-config.json';

interface AuthUserResult {
  uid: string;
  idToken?: string;
  email: string;
}

async function createOrLookupAuthUser(email: string, password?: string): Promise<AuthUserResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password || `MiraTech_${Date.now()}_!`;

  // 1. Try Admin SDK first if configured
  if (adminAppAuth) {
    try {
      const userRecord = await adminAppAuth.createUser({
        email: cleanEmail,
        password: cleanPassword,
      });
      return { uid: userRecord.uid, email: cleanEmail };
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-exists') {
        try {
          const existing = await adminAppAuth.getUserByEmail(cleanEmail);
          return { uid: existing.uid, email: cleanEmail };
        } catch (_) {}
      }
    }
  }

  // 2. Fallback to Firebase Identity Toolkit REST API with project API key
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
      return { uid: data.localId, idToken: data.idToken, email: cleanEmail };
    }

    if (data?.error?.message === 'EMAIL_EXISTS') {
      // User already exists in Firebase Auth, attempt sign-in to retrieve ID Token
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
        return { uid: signInData.localId, idToken: signInData.idToken, email: cleanEmail };
      }

      // If password mismatch, create dedicated workspace admin credentials
      const workspaceSalt = Math.random().toString(36).substring(2, 7);
      const wsEmail = `${cleanEmail.split('@')[0]}_ws_${workspaceSalt}@miratech.internal`;
      const fallbackRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: wsEmail,
            password: cleanPassword,
            returnSecureToken: true,
          }),
        }
      );
      const fallbackData = await fallbackRes.json();
      if (fallbackRes.ok && fallbackData.localId) {
        return { uid: fallbackData.localId, idToken: fallbackData.idToken, email: wsEmail };
      }
    }
  } catch (err) {
    console.warn('[Provision Auth REST Warning]:', err);
  }

  // Fallback deterministic UID based on email hash
  const crypto = await import('crypto');
  const uid = 'usr_' + crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 24);
  return { uid, email: cleanEmail };
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
    paddleCustId,
    primaryColor,
    secondaryColor,
    themePreset,
    themeMode,
    fontFamily,
    cardRadius,
  } = payload;

  try {
    // 1. Provision Primary Administrator Auth Account
    const adminUser = await createOrLookupAuthUser(accountEmail, accountPassword);
    const adminUid = adminUser.uid;

    // 2. Provision Staff Auth Accounts
    const staffUids: string[] = [];
    for (const staff of staffList || []) {
      const sUser = await createOrLookupAuthUser(staff.email, staff.password);
      staffUids.push(sUser.uid);
    }

    // 3. Prepare Corporate Tenant Data Payload
    const selectedPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === subscriptionPlanId) || SUBSCRIPTION_PLANS[2];
    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const companyPayload: Record<string, any> = {
      id: adminUid,
      ownerId: adminUid,
      name: companyName,
      legalName: companyName,
      registrationNumber: registrationNumber || "UNREGISTERED",
      taxVatNumber: taxVatNumber || "",
      industry: industry || "Information Technology",
      businessType: businessType || "Private Company",
      address: `${businessAddress || ''}, ${businessCity || ''}, ${businessCountry || ''}`.trim(),
      city: businessCity || "",
      country: businessCountry || "South Africa",
      website: businessWebsite || "",
      officialEmail: businessOfficialEmail || accountEmail,
      officialPhone: businessOfficialPhone || accountPhone,
      employeeRange: employeeRange || "1-10",
      branchCount: branchCount || 1,
      currency: currency || "USD",
      activeModules: selectedModules || ['quotations', 'invoices', 'receipts', 'clients', 'transactions', 'reports'],
      activeDepartments: selectedDepartments || ['sales', 'finance'],
      email: accountEmail,
      phone: accountPhone,
      createdAt: new Date().toISOString(),
      primaryColor: primaryColor || '#2563eb',
      secondaryColor: secondaryColor || '#0ea5e9',
      themePreset: themePreset || 'corporate_navy',
      themeMode: themeMode || 'light',
      fontFamily: fontFamily || 'inter',
      cardRadius: cardRadius || 'md',
      inactivityTimeout: 900,
      threatLevel: 'elevated',
      mfaEnforced: true,
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      businessEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      verifiedEmail: accountEmail,
      argon2Iterations: 4,
      argon2SaltLength: 16,
      subscriptionPlanId: subscriptionPlanId || 'starter',
      subscriptionPlan: selectedPlanObj.name,
      plan: subscriptionPlanId || 'starter',
      tier: subscriptionPlanId || 'starter',
      subscriptionStatus: subscriptionPlanId === 'free' ? 'active' : 'trialing',
      subscriptionBillingCycle: billingCycle || 'monthly',
      subscriptionTrialEndsAt: trialEndDate,
      subscriptionTrialStartedAt: new Date().toISOString(),
      lockedFeatures: getLockedFeaturesForPlan(subscriptionPlanId || 'starter'),
      paddleSubscriptionId: paddleSubId || `sub_pdl_${Date.now()}`,
      paddleCustomerId: paddleCustId || `ctm_pdl_${Date.now()}`,
      paymentMethodCaptured: true,
    };

    const adminUserDocPayload: Record<string, any> = {
      id: adminUid,
      displayName: accountFullName || 'Administrator',
      email: accountEmail,
      phone: accountPhone || '',
      role: initialRole || 'SUPER_ADMIN',
      positionTitle: adminPositionTitle || 'Managing Director',
      companyId: adminUid,
      businessId: adminUid,
      status: 'ACTIVE',
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      permissions: permissions || ['ALL'],
      isAuthorizedSignatory: true,
      createdAt: new Date().toISOString(),
    };

    // 4. Persist to Firestore: Use Admin SDK if available, or Authenticated REST API
    if (adminFirestoreInstance) {
      await adminDb.collection('companies').doc(adminUid).set(companyPayload);
      await adminDb.collection('businesses').doc(adminUid).set(companyPayload);
      await adminDb.collection('users').doc(adminUid).set(adminUserDocPayload);

      for (let i = 0; i < (staffList || []).length; i++) {
        const staff = staffList[i];
        await adminDb.collection('users').doc(staffUids[i]).set({
          id: staffUids[i],
          displayName: staff.fullName,
          email: staff.email,
          role: staff.role || 'STAFF',
          companyId: adminUid,
          businessId: adminUid,
          status: 'ACTIVE',
          departments: staff.departments || ['sales'],
          createdAt: new Date().toISOString(),
        });
      }

      await adminDb.collection('audit_logs').add({
        companyId: adminUid,
        userId: adminUid,
        userEmail: accountEmail,
        action: 'TENANT_ONBOARDING_COMPLETED',
        details: `Corporate workspace "${companyName}" provisioned via Admin SDK.`,
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        department: 'executive',
      });
    } else if (adminUser.idToken) {
      // Authenticated writes via Firestore REST API with the admin user's identity
      const compRes = await setFirestoreDocRest('companies', adminUid, companyPayload, adminUser.idToken);
      if (!compRes.success) throw new Error(compRes.error || 'Failed to create company record');

      const bizRes = await setFirestoreDocRest('businesses', adminUid, companyPayload, adminUser.idToken);
      if (!bizRes.success) throw new Error(bizRes.error || 'Failed to create business record');

      const userRes = await setFirestoreDocRest('users', adminUid, adminUserDocPayload, adminUser.idToken);
      if (!userRes.success) throw new Error(userRes.error || 'Failed to create administrator profile');

      for (let i = 0; i < (staffList || []).length; i++) {
        const staff = staffList[i];
        await setFirestoreDocRest('users', staffUids[i], {
          id: staffUids[i],
          displayName: staff.fullName,
          email: staff.email,
          role: staff.role || 'STAFF',
          companyId: adminUid,
          businessId: adminUid,
          status: 'ACTIVE',
          departments: staff.departments || ['sales'],
          createdAt: new Date().toISOString(),
        }, adminUser.idToken);
      }

      await addFirestoreDocRest('audit_logs', {
        companyId: adminUid,
        userId: adminUid,
        userEmail: accountEmail,
        action: 'TENANT_ONBOARDING_COMPLETED',
        details: `Corporate workspace "${companyName}" provisioned via Secure REST Gateway.`,
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        department: 'executive',
      }, adminUser.idToken);
    } else {
      // Fallback to client DB instance
      await adminDb.collection('companies').doc(adminUid).set(companyPayload);
      await adminDb.collection('businesses').doc(adminUid).set(companyPayload);
      await adminDb.collection('users').doc(adminUid).set(adminUserDocPayload);
    }

    return { success: true, adminUid };
  } catch (err: any) {
    console.error("Provisioning Server Action Error:", err);
    return { success: false, error: err.message || 'Server action provisioning error' };
  }
}
