import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "fs";
import path from "path";

describe("MiraTech Multi-Tenant Security Rules & Cross-Tenant Isolation", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "miratech-security-test",
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  test("unauthenticated user cannot read or write data", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const docRef = db.collection("companies").doc("biz_a").collection("invoices").doc("inv_1");
    await assertFails(docRef.get());
    await assertFails(docRef.set({ companyId: "biz_a", amount: 100 }));
  });

  test("user from Business A can access Business A data", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("user_a").set({
        companyId: "biz_a",
        email: "usera@biz-a.com"
      });
    });

    const db = testEnv.authenticatedContext("user_a", { companyId: "biz_a" }).firestore();
    const docRef = db.collection("companies").doc("biz_a").collection("invoices").doc("inv_1");
    
    await assertSucceeds(docRef.set({ companyId: "biz_a", amount: 500 }));
    await assertSucceeds(docRef.get());
  });

  test("user from Business A CANNOT access Business B data", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc("user_a").set({
        companyId: "biz_a",
        email: "usera@biz-a.com"
      });
      await context.firestore().collection("companies").doc("biz_b").collection("invoices").doc("inv_b1").set({
        companyId: "biz_b",
        amount: 1000
      });
    });

    const db = testEnv.authenticatedContext("user_a", { companyId: "biz_a" }).firestore();
    const docRef = db.collection("companies").doc("biz_b").collection("invoices").doc("inv_b1");

    await assertFails(docRef.get());
    await assertFails(docRef.set({ companyId: "biz_b", amount: 2000 }));
  });

  test("master admin can access any tenant data", async () => {
    const adminDb = testEnv.authenticatedContext("admin_user", { email: "miratechindustries@gmail.com", role: "MASTER_ADMIN" }).firestore();
    const docRef = adminDb.collection("companies").doc("biz_b").collection("invoices").doc("inv_b1");

    await assertSucceeds(docRef.set({ companyId: "biz_b", amount: 5000 }));
    await assertSucceeds(docRef.get());
  });
});
