'use client'

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Product } from '@/lib/types';
import { toast } from 'sonner';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  onProductAdded: () => void;
}

export default function AddProductModal({ isOpen, onClose, businessId, onProductAdded }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    categoryId: 'general',
    buyPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    minStockLevel: 0,
    unit: 'pcs'
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        businessId,
        createdAt: Date.now()
      });
      toast.success('Product added successfully');
      onProductAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Add New Product</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Product Name" className="w-full p-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="text" placeholder="SKU" className="w-full p-2 border rounded-lg" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Buy Price" className="w-full p-2 border rounded-lg" value={formData.buyPrice} onChange={e => setFormData({...formData, buyPrice: parseFloat(e.target.value)})} required />
            <input type="number" placeholder="Sell Price" className="w-full p-2 border rounded-lg" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: parseFloat(e.target.value)})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Initial Stock" className="w-full p-2 border rounded-lg" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: parseInt(e.target.value)})} required />
            <input type="number" placeholder="Min Stock Level" className="w-full p-2 border rounded-lg" value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: parseInt(e.target.value)})} required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold" disabled={loading}>
            {loading ? 'Adding...' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}
