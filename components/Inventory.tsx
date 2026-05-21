"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, AlertTriangle, ArrowUpDown, ChevronDown, Trash2, Edit, Save, X, Layers, Box, TrendingUp, CheckCircle2 } from "lucide-react";
import { auth } from "../lib/firebase";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
}

interface CategoryConfig {
  name: string;
  color: string;
  icon: string;
}

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { name: "Networking", color: "bg-blue-100 text-blue-800", icon: "Network" },
  { name: "Cabling", color: "bg-amber-100 text-amber-800", icon: "Cable" },
  { name: "Servers", color: "bg-slate-100 text-slate-800", icon: "Server" },
  { name: "Power Supply", color: "bg-emerald-100 text-emerald-800", icon: "Zap" },
  { name: "Spare Parts", color: "bg-purple-100 text-purple-800", icon: "Settings" },
];

// Helper to render icons
const IconRenderer = ({ name, className }: { name: string; className?: string }) => {
  const icons: { [key: string]: any } = { Network, Cable: Box, Server, Zap, Settings, Layers }; // Map names to icons
  const Icon = icons[name] || Box;
  return <Icon className={className} />;
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // ... (rest of the component) ...
  
  // Inside return:

  // 1. Filter bar:
  //    ...
  //    <button
  //      key={cat.name}
  //      onClick={() => setCategoryFilter(cat.name)}
  //      className={`px-2.5 py-1 border rounded-md text-[10px] sm:text-xs font-bold transition whitespace-nowrap cursor-pointer ${
  //        categoryFilter === cat.name
  //          ? `${cat.color} border-current`
  //          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
  //      }`}
  //    >
  //      <IconRenderer name={cat.icon} className="h-3 w-3 inline mr-1" />
  //      {cat.name}
  //    </button>

  // 2. Table row rendering for Category column:
  //    ...
  //    const config = categoryConfigs.find(c => c.name === it.category);
  //    ...
  //    <td>
  //      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${config?.color || 'bg-slate-100 text-slate-800'}`}>
  //        {config && <IconRenderer name={config.icon} className="h-2.5 w-2.5" />}
  //        {it.category}
  //      </span>
  //    </td>

  // Form Fields
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Networking");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(5);

  useEffect(() => {
    const user = auth.currentUser;
    const cacheKey = user ? `miratech_inventory_${user.uid}` : "miratech_inventory_guest";
    const cached = localStorage.getItem(cacheKey);
    
    // Also load/save category configs... (will do later)

    if (cached) {
      setItems(JSON.parse(cached));
    } else {
      const initial: InventoryItem[] = [
        { id: "INV-001", name: "Core Switch 24-Port", sku: "NET-SW-24", category: "Networking", price: 350.00, stock: 15, minStock: 5 },
        { id: "INV-002", name: "SFP+ Fiber Module 10G", sku: "NET-SFP-10G", category: "Networking", price: 45.00, stock: 42, minStock: 10 },
        { id: "INV-003", name: "Cat6A Shielded Cable (305m)", sku: "CAB-C6A-S", category: "Cabling", price: 180.00, stock: 4, minStock: 5 },
        { id: "INV-004", name: "Pro Rack Server 1U", sku: "SRV-1U-SYS", category: "Servers", price: 1250.00, stock: 3, minStock: 2 },
        { id: "INV-005", name: "Smart UPS 1500VA", sku: "PWR-UPS-1500", category: "Power Supply", price: 290.00, stock: 0, minStock: 3 },
      ];
      setItems(initial);
      localStorage.setItem(cacheKey, JSON.stringify(initial));
    }
  }, []);

  const saveToLocal = (updatedList: InventoryItem[]) => {
    setItems(updatedList);
    const user = auth.currentUser;
    const cacheKey = user ? `miratech_inventory_${user.uid}` : "miratech_inventory_guest";
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    // Log action to audit trail
    const auditKey = user ? `miratech_audit_logs_${user.uid}` : "miratech_audit_logs_guest";
    const oldLogs = JSON.parse(localStorage.getItem(auditKey) || "[]");
    const newLog = {
      action: "Inventory Updated",
      detail: `Total inventory updated to ${updatedList.length} items.`,
      timestamp: new Date().toISOString(),
      user: user?.email || "Manager",
      ip: "127.0.0.1"
    };
    localStorage.setItem(auditKey, JSON.stringify([newLog, ...oldLogs]));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) return alert("Please fill details");

    const newItemId = id || `INV-${String(items.length + 101)}`;
    const newItem: InventoryItem = {
      id: newItemId,
      name,
      sku: sku.toUpperCase(),
      category,
      price: Number(price),
      stock: Number(stock),
      minStock: Number(minStock),
    };

    const updated = [...items, newItem];
    saveToLocal(updated);
    resetForm();
    setIsOpen(false);
  };

  const resetForm = () => {
    setId("");
    setName("");
    setSku("");
    setCategory("Networking");
    setPrice(0);
    setStock(0);
    setMinStock(5);
    setEditingItem(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setId(item.id);
    setName(item.name);
    setSku(item.sku);
    setCategory(item.category);
    setPrice(item.price);
    setStock(item.stock);
    setMinStock(item.minStock);
    setIsOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const updated = items.map((it) =>
      it.id === id
        ? {
            ...it,
            name,
            sku: sku.toUpperCase(),
            category,
            price: Number(price),
            stock: Number(stock),
            minStock: Number(minStock),
          }
        : it
    );
    saveToLocal(updated);
    resetForm();
    setIsOpen(false);
  };

  const handleDelete = (itemId: string) => {
    if (confirm("Are you sure you want to delete this core stock item?")) {
      const updated = items.filter((it) => it.id !== itemId);
      saveToLocal(updated);
    }
  };

  const filteredItems = items.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.sku.toLowerCase().includes(search.toLowerCase()) ||
      it.id.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "All" || it.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // KPI Calculations
  const totalItems = items.reduce((sum, it) => sum + it.stock, 0);
  const outOfStock = items.filter((it) => it.stock === 0).length;
  const lowStock = items.filter((it) => it.stock > 0 && it.stock <= it.minStock).length;
  const portfolioValue = items.reduce((sum, it) => sum + it.price * it.stock, 0);

  return (
    <div className="space-y-4">
      {/* Upper Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Enterprise Inventory</h1>
          <p className="text-[11px] text-slate-500">Track raw materials, structured equipment, and spare modules.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold cursor-pointer shadow-3xs transition"
        >
          <Plus className="h-3.5 w-3.5" /> Register Item
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Units Stocked</p>
          <h3 className="text-base font-extrabold text-slate-800 mt-1 font-mono">{totalItems}</h3>
          <p className="text-[8px] text-slate-400">Sum of active packages</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Warnings</p>
          <h3 className="text-base font-extrabold text-amber-600 mt-1 font-mono">{lowStock}</h3>
          <p className="text-[8px] text-amber-500 font-medium">Under critical safety levels</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stock-Out Alerts</p>
          <h3 className="text-base font-extrabold text-red-600 mt-1 font-mono">{outOfStock}</h3>
          <p className="text-[8px] text-red-500 font-medium font-mono">Immediate replenishment required</p>
        </div>
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-lg shadow-3xs">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Portfolio Net Asset</p>
          <h3 className="text-base font-extrabold text-blue-700 mt-1 font-mono">${portfolioValue.toLocaleString()}</h3>
          <p className="text-[8px] text-blue-500 font-medium">Evaluated at sales tier price</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search descriptions or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden"
          />
        </div>
        
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {[{ name: "All", color: "bg-slate-100 text-slate-800", icon: "Layers" }, ...categoryConfigs].map((cat) => (
            <button
              key={cat.name}
              onClick={() => setCategoryFilter(cat.name)}
              className={`px-2.5 py-1 border rounded-md text-[10px] sm:text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                categoryFilter === cat.name
                  ? `${cat.color} border-current`
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <IconRenderer name={cat.icon} className="h-3 w-3 inline mr-1" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* High-density grid table */}
      <div className="overflow-x-auto bg-white border border-slate-200/80 rounded-lg shadow-3xs">
        <table className="high-density-table w-full text-left border-collapse">
          <thead>
            <tr>
              <th>ID</th>
              <th>SKU Code</th>
              <th>Description Item</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Stock Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                  No inventory pieces registered. Click &quot;Register Item&quot; to begin.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => {
                const isOut = it.stock === 0;
                const isLow = it.stock <= it.minStock && it.stock > 0;
                let statusBadge = (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-150">
                    <CheckCircle2 className="h-2.5 w-2.5" /> {it.stock} In Stock
                  </span>
                );
                if (isOut) {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-150">
                      <AlertTriangle className="h-2.5 w-2.5" /> Out of Stock
                    </span>
                  );
                } else if (isLow) {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-150">
                      <AlertTriangle className="h-2.5 w-2.5" /> {it.stock} Low Stock
                    </span>
                  );
                }

                return (
                  <tr key={it.id} className="hover:bg-slate-50/50">
                    <td className="font-mono font-bold text-slate-900">{it.id}</td>
                    <td className="font-mono text-xs text-blue-800 font-bold uppercase">{it.sku}</td>
                    <td className="font-semibold text-slate-800">{it.name}</td>
                    <td>
                      {(() => {
                        const config = categoryConfigs.find(c => c.name === it.category);
                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${config?.color || 'bg-slate-100 text-slate-800'}`}>
                            <IconRenderer name={config?.icon || 'Box'} className="h-2.5 w-2.5" />
                            {it.category}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="font-mono font-bold">${it.price.toFixed(2)}</td>
                    <td>{statusBadge}</td>
                    <td className="text-right space-x-1.5 py-1">
                      <button
                        onClick={() => handleEdit(it)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md cursor-pointer transition inline-flex"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition inline-flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Form Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-blue-905 uppercase tracking-wide">
                {editingItem ? "Edit Stock Item" : "Register Stock Item"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={editingItem ? handleUpdate : handleCreate} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item ID (Optional)</label>
                  <input
                    type="text"
                    disabled={!!editingItem}
                    placeholder="Auto-assigned"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SKU Unique Code</label>
                  <input
                    type="text"
                    required
                    placeholder="NET-SW-24"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description / Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server Switch 48-port POE"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full"
                  >
                    {categoryConfigs.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sales Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening Stock</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Safety Min Stock</label>
                  <input
                    type="number"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-md font-bold text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-bold text-[10px]"
                >
                  {editingItem ? "Update Changes" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
