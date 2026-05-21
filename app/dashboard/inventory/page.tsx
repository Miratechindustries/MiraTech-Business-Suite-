'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { Package, Plus, Search, Filter } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { Product } from '@/lib/types';
import AddProductModal from '@/components/AddProductModal';

export default function InventoryPage() {
  const { business } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!business || !business.id) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'businesses', business.id, 'inventory'));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    setLoading(false);
  }, [business]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-500">Manage your products and stock levels.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95">
          <Plus size={18} />
          Add Product
        </button>
      </div>
      
      {loading ? (
        <div>Loading inventory...</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 p-20 text-center">
            <div className="max-w-xs mx-auto">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <Package size={32} />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">No products found</h3>
              <p className="mt-2 text-sm text-slate-500">Get started by creating your first product in the inventory system.</p>
            </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b text-xs font-bold uppercase tracking-wider text-slate-400 p-4">
                 <th className="p-4">SKU</th>
                 <th className="p-4">Name</th>
                 <th className="p-4 text-right">Price</th>
                 <th className="p-4 text-right">Stock</th>
               </tr>
             </thead>
             <tbody className="divide-y dark:divide-slate-800">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="p-4 font-mono text-sm">{p.sku}</td>
                    <td className="p-4">{p.name}</td>
                    <td className="p-4 text-right">{p.sellPrice}</td>
                    <td className="p-4 text-right">{p.stockQuantity} {p.unit}</td>
                  </tr>
                ))}
             </tbody>
           </table>
        </div>
      )}
      
      {business && business.id && (
        <AddProductModal 
          isOpen={isModalOpen} 
          onClose={() => setModalOpen(false)} 
          businessId={business.id}
          onProductAdded={fetchProducts}
        />
      )}
    </div>
  );
}
