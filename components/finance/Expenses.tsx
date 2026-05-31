"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, X, DollarSign, Calendar, FileText } from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { Expense } from "../../lib/types";

export default function Expenses() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [businessId, setBusinessId] = useState<string | null>(null);

    useEffect(() => {
        async function loadBusiness() {
            if (!auth.currentUser) return;
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
            setBusinessId(userSnap.data()?.businessId || null);
        }
        loadBusiness();
    }, []);

    useEffect(() => {
        if (!businessId) return;
        async function fetchExpenses() {
            const q = query(collection(db, "expenses"), where("businessId", "==", businessId));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
            setExpenses(data);
        }
        fetchExpenses();
    }, [businessId]);

    // ... handleCreate, handleDelete, etc. (similar to Inventory/Customers)

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Expenses</h2>
            {/* Table/List of expenses */}
            <div className="bg-white border rounded-lg p-4 font-mono text-sm text-slate-500">
                Expenses listing here...
            </div>
        </div>
    );
}
