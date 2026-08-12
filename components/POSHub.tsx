'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { Search, ShoppingCart, Trash2, Printer, X, AlertTriangle, Save, Play } from 'lucide-react';
import { useToastStore } from "../lib/store";

// Thermal Receipt Preview Modal Component
const ThermalReceiptModal = ({ cart, total, tax, grandTotal, onClose }: any) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
    <div id="receipt-print-area" className="bg-white p-6 rounded-2xl w-80 text-center font-mono print:w-full print:p-0 print:rounded-none">
      <h2 className="font-bold text-lg mb-4 print:text-2xl">RECEIPT</h2>
      <div className="text-left space-y-1 mb-4 border-b pb-4">
        {cart.map((item: any) => (
          <div key={item.id} className="flex justify-between text-xs print:text-base">
            <span>{item.name} x{item.quantity}</span>
            <span>E{(Number(item.price) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="text-right text-xs space-y-1 print:text-base">
        <p>Subtotal: E{total.toFixed(2)}</p>
        <p>Tax (15%): E{tax.toFixed(2)}</p>
        <p className="font-bold">Total: E{grandTotal.toFixed(2)}</p>
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold print:hidden">Close</button>
    </div>
    <style jsx global>{`
      @media print {
        body * { visibility: hidden; }
        #receipt-print-area, #receipt-print-area * { visibility: visible; }
        #receipt-print-area { position: absolute; left: 0; top: 0; }
      }
    `}</style>
  </div>
);

export default function POSHub({ companyId, userId }: { companyId: string, userId: string }) {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [heldTransactions, setHeldTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [dailySummary, setDailySummary] = useState({ revenue: 0, tax: 0, itemsSold: 0 });
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [showOpeningFloatModal, setShowOpeningFloatModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const addToast = useToastStore((state) => state.addToast);

  const TAX_RATE = 0.15;

  useEffect(() => {
    const handleOnline = () => {
        setIsOffline(false);
        syncOfflineTransactions();
        addToast('Back online, syncing transactions...', 'info');
    };
    const handleOffline = () => {
        setIsOffline(true);
        addToast('Connection lost, transactions will be queued', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if user has an active shift
    const checkShift = async () => {
        const shiftsRef = collection(db, "companies", companyId, "shifts");
        const q = query(shiftsRef, where("userId", "==", userId), where("endTime", "==", null));
        const snap = await getDocs(q);
        if (!snap.empty) {
            setIsClockedIn(true);
            setCurrentShiftId(snap.docs[0].id);
        }
    };
    checkShift();

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

    return () => { 
        unsub(); 
        unsubSales(); 
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [companyId, userId]);

  const saveToOfflineQueue = (saleRecord: any, cart: any[]) => {
      const queue = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      localStorage.setItem('pos_offline_queue', JSON.stringify([...queue, { saleRecord, cart }]));
      setCart([]);
      setShowReceipt(true);
      setLastSale({ cart, total: saleRecord.totalAmount / (1 + TAX_RATE), tax: saleRecord.totalAmount - (saleRecord.totalAmount / (1 + TAX_RATE)), grandTotal: saleRecord.totalAmount });
  };

  const syncOfflineTransactions = async () => {
      const queue = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
      if (queue.length === 0) return;
      
      const remainingQueue = [];
      for (const { saleRecord, cart } of queue) {
          try {
              // Re-add createdAt server timestamp
              await addDoc(collection(db, "companies", companyId, "pos_sales"), { ...saleRecord, createdAt: serverTimestamp() });
              for (const item of cart) {
                  const prodRef = doc(db, "products", item.id);
                  await updateDoc(prodRef, { stock: (Number(item.stock) || 0) - item.quantity });
              }
          } catch (e) {
              console.error("Sync failed", e);
              remainingQueue.push({ saleRecord, cart });
          }
      }
      localStorage.setItem('pos_offline_queue', JSON.stringify(remainingQueue));
      if (remainingQueue.length === 0) addToast('All transactions synced', 'success');
  };

  const toggleShift = async () => {
      if (isClockedIn) {
          // Clock out
          await updateDoc(doc(db, "companies", companyId, "shifts", currentShiftId!), { endTime: serverTimestamp() });
          setIsClockedIn(false);
          setCurrentShiftId(null);
          addToast("Clocked out successfully", "success");
      } else {
          // Open Modal to declare float
          setShowOpeningFloatModal(true);
      }
  };

  const confirmClockIn = async () => {
      const docRef = await addDoc(collection(db, "companies", companyId, "shifts"), {
          userId,
          startTime: serverTimestamp(),
          endTime: null,
          openingFloat
      });
      setIsClockedIn(true);
      setCurrentShiftId(docRef.id);
      setShowOpeningFloatModal(false);
      addToast("Clocked in successfully", "success");
  };

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

  const processSale = async (payments: { method: string, amount: number }[]) => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * item.quantity), 0);
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;

    const saleRecord = {
        items: cart,
        totalAmount,
        payments, // Record split payments
        shiftId: currentShiftId, // Link to shift
        createdAt: serverTimestamp()
    };

    if (navigator.onLine && !isOffline) {
        try {
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
            saveToOfflineQueue(saleRecord, cart);
            addToast('Connection failed, transaction queued', 'warning');
        }
    } else {
        saveToOfflineQueue(saleRecord, cart);
        addToast('Offline, transaction queued', 'warning');
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * item.quantity), 0);
  const tax = subtotal * TAX_RATE;
  const grandTotal = subtotal + tax;

  const lowStockItems = useMemo(() => inventoryItems.filter(item => item.stock < 10), [inventoryItems]);

  return (
    <div className="p-6 space-y-6">
      {showReceipt && <ThermalReceiptModal {...lastSale} onClose={() => setShowReceipt(false)} />}
      {showOpeningFloatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl w-80 text-center">
                <h2 className="font-bold text-lg mb-4">Declare Opening Float</h2>
                <input type="number" placeholder="Amount" className="w-full p-2 border rounded-xl text-xs mb-4" value={openingFloat} onChange={(e) => setOpeningFloat(Number(e.target.value))}/>
                <button onClick={confirmClockIn} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">Confirm & Clock In</button>
            </div>
        </div>
      )}
      
      <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <h1 className="text-xl font-black">POS System</h1>
            <button onClick={toggleShift} className={`px-4 py-2 rounded-xl text-xs font-bold ${isClockedIn ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {isClockedIn ? "Clock Out" : "Clock In"}
            </button>
          </div>
      </div>

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
            <button onClick={() => processSale([{ method: 'cash', amount: grandTotal }])} className="w-full bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs mt-4">
                Checkout (Cash)
            </button>
        </div>
      </div>
    </div>
  );
}
