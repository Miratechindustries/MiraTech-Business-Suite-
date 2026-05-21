'use client'

import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { UserProfile, Business } from '@/lib/types';
import { handleAppError } from '@/lib/error-handler';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setBusiness, setLoading } = useAppStore();

  useEffect(() => {
    // Load cached data for instant appearance
    const cachedUser = localStorage.getItem('mira_user_profile');
    const cachedBiz = localStorage.getItem('mira_business_data');
    if (cachedUser) setUser(JSON.parse(cachedUser));
    if (cachedBiz) setBusiness(JSON.parse(cachedBiz));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            let updatedUserData = { ...userData };
            let needsUpdate = false;

            // Ensure master admin stays master admin
            if (user.email === 'miratechindustries@gmail.com' && userData.role !== 'MASTER_ADMIN') {
              updatedUserData.role = 'MASTER_ADMIN';
              needsUpdate = true;
            }

            // If businessId is missing, try to find it by adminEmail
            if (!userData.businessId && user.email) {
              const bizQuery = query(collection(db, 'businesses'), where('adminEmail', '==', user.email));
              const bizSnap = await getDocs(bizQuery);
              if (!bizSnap.empty) {
                const businessId = bizSnap.docs[0].id;
                updatedUserData.businessId = businessId;
                if (user.email !== 'miratechindustries@gmail.com') {
                  updatedUserData.role = 'BUSINESS_ADMIN';
                }
                needsUpdate = true;
              }
            }

            if (needsUpdate) {
              await updateDoc(userDocRef, {
                businessId: updatedUserData.businessId,
                role: updatedUserData.role,
                updatedAt: Date.now()
              });
            }

            setUser(updatedUserData);
            localStorage.setItem('mira_user_profile', JSON.stringify(updatedUserData));

            if (updatedUserData.businessId) {
              const bizDoc = await getDoc(doc(db, 'businesses', updatedUserData.businessId));
              if (bizDoc.exists()) {
                const bizData = bizDoc.data() as Business;
                setBusiness(bizData);
                localStorage.setItem('mira_business_data', JSON.stringify(bizData));
              }
            }
          } else {
            // New user - create profile in Firestore
            let businessId = '';
            let role: UserProfile['role'] = user.email === 'miratechindustries@gmail.com' ? 'MASTER_ADMIN' : 'STAFF';

            // Check if there is a business waiting for this admin email
            if (user.email) {
              const bizQuery = query(collection(db, 'businesses'), where('adminEmail', '==', user.email));
              const bizSnap = await getDocs(bizQuery);
              
              if (!bizSnap.empty) {
                businessId = bizSnap.docs[0].id;
                if (user.email !== 'miratechindustries@gmail.com') {
                  role = 'BUSINESS_ADMIN';
                }
              }
            }

            const newUserData: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              businessId,
              role,
              status: 'active',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            
            try {
              await setDoc(userDocRef, newUserData);
              setUser(newUserData);
              localStorage.setItem('mira_user_profile', JSON.stringify(newUserData));
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
            }
          }
        } catch (e: any) {
          const msg = (e?.message || '').toLowerCase();
          if (msg.includes('permission-denied') || msg.includes('insufficient permissions')) {
            console.warn('[Sync] Permission warning during initial check');
          } else {
            handleAppError(e, "Account Sync Failed");
          }
        }
      } else {
        setUser(null);
        setBusiness(null);
        localStorage.removeItem('mira_user_profile');
        localStorage.removeItem('mira_business_data');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setBusiness, setLoading]);

  return <>{children}</>;
}
