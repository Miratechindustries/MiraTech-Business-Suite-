const fs = require('fs');
let content = fs.readFileSync('/app/applet/app/register/page.tsx', 'utf8');

const replacement = `    try {
      const batch = writeBatch(db);
      const businessesRef = collection(db, "businesses");
      const newBusinessRef = doc(businessesRef);
      
      batch.set(newBusinessRef, {
        ownerId: auth.currentUser.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        taxId: formData.taxId,
        registrationNumber: formData.registrationNumber,
        subscriptionPlan: formData.subscriptionPlan,
        status: "active",
        createdAt: new Date().toISOString(),
      });

      const userRef = doc(db, "users", auth.currentUser.uid);
      batch.set(userRef, {
        role: "BUSINESS_ADMIN",
        businessId: newBusinessRef.id,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await batch.commit();

      router.push("/");
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.CREATE, "businesses");
      } catch (firestoreError: any) {
        try {
          const parsed = JSON.parse(firestoreError.message);
          setGlobalError(parsed.error || "Failed to register business.");
        } catch {
          setGlobalError(error.message || "An unexpected error occurred. Please try again.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };`;

const newContent = content.replace(/    try \{[\s\S]*?\} finally \{\s*setIsLoading\(false\);\s*\}\s*\};/m, replacement);
const finalContent = newContent.replace(/import \{.*?\} from "firebase\/firestore";/, 'import { collection, doc, writeBatch } from "firebase/firestore";').replace(/Complete Registration & Pay\s*<CreditCard className="w-4 h-4 ml-2" \/>/, 'Complete Registration\n                    <CheckCircle2 className="w-4 h-4 ml-2" />');

fs.writeFileSync('/app/applet/app/register/page.tsx', finalContent);
console.log("Fixed page.tsx");
