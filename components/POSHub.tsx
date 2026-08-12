'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { Search, ShoppingCart, Trash2, Printer, X, AlertTriangle, Save, Play } from 'lucide-react';
import { useToastStore } from "../lib/store";

// Thermal Receipt Preview Modal Component
const ThermalReceiptModal = ({ cart, total, tax, grandTotal, onClose }: any) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-2xl w-80 text-center font-mono">
      <h2 className="font-bold text-lg mb-4">RECEIPT</h2>
      <div className="text-left space-y-1 mb-4 border-b pb-4">
        {cart.map((item: any) => (
          <div key={item.id} className="flex justify-between text-xs">
            <span>{item.name} x{item.quantity}</span>
            <span>E{(Number(item.price) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="text-right text-xs space-y-1">
        <p>Subtotal: E{total.toFixed(2)}</p>
        <p>Tax (15%): E{tax.toFixed(2)}</p>
        <p className="font-bold">Total: E{grandTotal.toFixed(2)}</p>
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold">Close</button>
    </div>
  </div>
);

export default function POSHub({ companyId }: { companyId: string }) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [heldTransactions, setHeldTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [dailySummary, setDailySummary] = useState({ revenue: 0, tax: 0, itemsSold: 0 });
  const addToast = useToastStore((state) => state.addToast);

  const TAX_RATE = 0.15;

  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(query(collection(db, "products"), where("businessId", "==", companyId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventoryItems(items);
      setFilteredInventory(items);
    });
    
    // Daily Summary
    const today = new Date().toISOString().split('T')[0];
    const salesQuery = query(collection(db, "companies", companyId, "pos_sales"));
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      let revenue = 0;
      let tax = 0;
      let itemsSold = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.createdAt?.toDate().toISOString().split('T')[0] === today) {
          revenue += data.totalAmount;
          tax += (data.totalAmount * TAX_RATE) / (1 + TAX_RATE);
          itemsSold += data.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
        }
      });
      setDailySummary({ revenue, tax, itemsSold });
    });

    return () => { unsub(); unsubSales(); };
  }, [companyId]);

  useEffect(() => {
    const filtered = inventoryItems.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredInventory(filtered);
  }, [searchTerm, inventoryItems]);

  const addToCart = (product: any) => {
    setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
            return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const holdTransaction = () => {
    if (cart.length === 0) return;
    setHeldTransactions(prev => [...prev, cart]);
    setCart([]);
    addToast('Transaction held', 'info');
  };

  const resumeTransaction = (index: number) => {
    setCart(heldTransactions[index]);
    setHeldTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const scanBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        const product = inventoryItems.find(p => p.sku === searchTerm || p.id === searchTerm);
        if (product) {
            addToCart(product);
            setSearchTerm('');
            addToast(`Added ${product.name}`, 'success');
        } else {
            addToast('Product not found', 'error');
        }
    }
  };

  const processSale = async () => {
    if (cart.length === 0) return;
    try {
      const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * item.quantity), 0);
      const tax = subtotal * TAX_RATE;
      const totalAmount = subtotal + tax;

      const saleRecord = {
        items: cart,
        totalAmount,
        paymentMethod: 'cash',
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "companies", companyId, "pos_sales"), saleRecord);
      
      for (const item of cart) {
        const prodRef = doc(db, "products", item.id);
        await updateDoc(prodRef, { stock: (Number(item.stock) || 0) - item.quantity });
      }
      
      setLastSale({ cart, total: subtotal, tax, grandTotal: totalAmount });
      setCart([]);
      setShowReceipt(true);
      addToast('Sale processed successfully', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error processing sale', 'error');
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * item.quantity), 0);
  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  const lowStockItems = useMemo(() => inventoryItems.filter(item => item.stock < 10), [inventoryItems]);

  return (
    <div className="p-6 space-y-6">
      {showReceipt && <ThermalReceiptModal {...lastSale} onClose={() => setShowReceipt(false)} />}
      
      {/* Daily Summary & Alerts */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Daily Revenue</p>
            <p className="text-xl font-black">E{dailySummary.revenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Tax Collected</p>
            <p className="text-xl font-black">E{dailySummary.tax.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Items Sold</p>
            <p className="text-xl font-black">{dailySummary.itemsSold}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm relative">
            <p className="text-[10px] text-amber-800 font-bold uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3"/> Low Stock
            </p>
            <p className="text-xl font-black text-amber-900">{lowStockItems.length}</p>
            {lowStockItems.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Scan barcode or search product name..." 
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={scanBarcode}
            autoFocus
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
            <h3 className="font-bold text-xs mb-4">Inventory</h3>
            <div className="grid grid-cols-2 gap-3">
                {filteredInventory.map(item => (
                    <button key={item.id} onClick={() => addToCart(item)} className="p-3 border rounded-xl hover:bg-slate-50 text-left">
                        <p className="font-bold text-xs">{item.name}</p>
                        <p className="text-[10px] text-slate-500">Stock: {item.stock} | E{item.price}</p>
                    </button>
                ))}
            </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
            <h3 className="font-bold text-xs mb-4 flex items-center justify-between"><span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4"/> Cart</span>
                <button onClick={holdTransaction} className="text-xs bg-slate-100 px-2 py-1 rounded"><Save className="w-3 h-3 inline"/> Hold</button>
            </h3>
            
            {heldTransactions.length > 0 && (
                <div className="mb-4 bg-amber-50 p-2 rounded text-[10px]">
                    <p className="font-bold mb-1">Held Transactions:</p>
                    {heldTransactions.map((_, i) => <button key={i} onClick={() => resumeTransaction(i)} className="mr-2 underline"><Play className="w-3 h-3 inline"/> Resume {i+1}</button>)}
                </div>
            )}

            <div className="space-y-2 mb-4">
                {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs font-bold">
                        <span>{item.name} x{item.quantity}</span>
                        <div className="flex items-center gap-2">
                            <span>E{(Number(item.price) * item.quantity).toFixed(2)}</span>
                            <button onClick={() => removeFromCart(item.id)} className="text-rose-500"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t pt-4 text-xs space-y-1 font-bold">
                <div className="flex justify-between"><span>Subtotal</span><span>E{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax (15%)</span><span>E{tax.toFixed(2)}</span></div>
                <div className="flex justify-between text-base"><span>Total</span><span>E{grandTotal.toFixed(2)}</span></div>
            </div>
            <button onClick={processSale} className="w-full bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs mt-4">
                Complete Checkout
            </button>
        </div>
      </div>
    </div>
  );
}
