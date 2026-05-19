'use client'

import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
            setUser(userData);
            localStorage.setItem('mira_user_profile', JSON.stringify(userData));

            if (userData.businessId) {
              const bizDoc = await getDoc(doc(db, 'businesses', userData.businessId));
              if (bizDoc.exists()) {
                const bizData = bizDoc.data() as Business;
                setBusiness(bizData);
                localStorage.setItem('mira_business_data', JSON.stringify(bizData));
              }
            }
          } else {
            // New user - create profile in Firestore
            const newUserData: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              businessId: '',
              role: user.email === 'miratechindustries@gmail.com' ? 'MASTER_ADMIN' : 'STAFF',
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
        } catch (e) {
          handleAppError(e, "Account Sync Failed");
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
