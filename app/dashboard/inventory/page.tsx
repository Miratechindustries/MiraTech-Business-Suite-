'use client'

import React from 'react';
import { Package, Plus, Search, Filter } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Inventory</h1>
          <p className="text-sm text-slate-500">Manage your products and stock levels.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95">
          <Plus size={18} />
          Add Product
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <Filter size={18} />
          Filters
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-center p-20 text-center">
          <div className="max-w-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <Package size={32} />
            </div>
            <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">No products found</h3>
            <p className="mt-2 text-sm text-slate-500">Get started by creating your first product in the inventory system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
