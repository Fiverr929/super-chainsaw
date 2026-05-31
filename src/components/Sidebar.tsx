"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag, Plus, Check, Loader2, ChevronDown, Trash2 } from "lucide-react";

type Store = {
  id: string;
  name: string;
};

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Load from local storage if exists
  useEffect(() => {
    const savedStores = localStorage.getItem("workstation_etsy_stores");
    const savedActiveId = localStorage.getItem("workstation_etsy_active_store_id");
    
    if (savedStores) {
      try {
        const parsed = JSON.parse(savedStores);
        // eslint-disable-next-line
        setStores(parsed);
        if (savedActiveId && parsed.some((s: Store) => s.id === savedActiveId)) {
          setActiveStoreId(savedActiveId);
        } else if (parsed.length > 0) {
          setActiveStoreId(parsed[0].id);
        }
      } catch {}
    }
  }, []);

  const saveStores = (newStores: Store[], newActiveId: string | null) => {
    setStores(newStores);
    setActiveStoreId(newActiveId);
    localStorage.setItem("workstation_etsy_stores", JSON.stringify(newStores));
    if (newActiveId) {
      localStorage.setItem("workstation_etsy_active_store_id", newActiveId);
    } else {
      localStorage.removeItem("workstation_etsy_active_store_id");
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/etsy/shop');
      const data = await res.json();
      
      if (data.shop_name) {
        const newStore = { id: String(Date.now()), name: data.shop_name };
        const newStores = [...stores, newStore];
        saveStores(newStores, newStore.id);
        setShowDialog(false);
      } else {
        alert("Failed to connect to Etsy store.");
      }
    } catch {
      alert("Error connecting to Etsy.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStores = stores.filter(s => s.id !== id);
    const newActiveId = activeStoreId === id 
      ? (newStores.length > 0 ? newStores[0].id : null) 
      : activeStoreId;
    saveStores(newStores, newActiveId);
  };

  const activeStore = stores.find(s => s.id === activeStoreId);
  const hasStores = stores.length > 0;

  if (!isOpen) {
    return (
      <div 
        className="w-12 h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col items-center py-4 transition-all duration-300 relative z-10"
      >
        <button 
          onClick={() => setIsOpen(true)}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 mb-4"
          title="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
        <button 
          onClick={() => setIsOpen(true)}
          className={`p-2 rounded-md transition-colors ${hasStores ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          title={hasStores ? "Etsy Connected" : "Connect Etsy"}
        >
          <ShoppingBag size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col transition-all duration-300 relative z-10">
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Workstation</span>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {hasStores && activeStore ? (
            <div className="mb-3">
              <div className="relative mb-1">
                <button
                  onClick={() => setStoreDropdownOpen((o) => !o)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    storeDropdownOpen
                      ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/40 dark:text-orange-400"
                      : "bg-white border-zinc-200 text-zinc-700 hover:border-orange-200 hover:bg-orange-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-orange-800/40 dark:hover:bg-orange-900/10"
                  }`}
                >
                  <ShoppingBag size={12} className="text-orange-400 shrink-0" />
                  <span className="flex-1 text-left truncate">
                    {activeStore.name}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <ChevronDown size={11} className={`text-zinc-400 shrink-0 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {storeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setStoreDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 overflow-hidden">
                      {stores.map((store) => (
                        <div
                          key={store.id}
                          className="group/item flex items-center gap-2 px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer"
                          onClick={() => {
                            setStoreDropdownOpen(false);
                            setActiveStoreId(store.id);
                            localStorage.setItem("workstation_etsy_active_store_id", store.id);
                          }}
                        >
                          <Check size={11} className={`shrink-0 ${store.id === activeStoreId ? "text-orange-500" : "text-transparent"}`} />
                          <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{store.name}</span>
                          <span
                            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-zinc-300 hover:text-red-500 shrink-0 cursor-pointer rounded"
                            onClick={(e) => handleDisconnect(store.id, e)}
                            title="Disconnect store"
                          >
                            <Trash2 size={10} />
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                          onClick={() => { setStoreDropdownOpen(false); setShowDialog(true); }}
                        >
                          <Plus size={11} /> Add Etsy Store
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-dashed border-orange-200 dark:border-orange-800/30 p-4 text-center">
              <ShoppingBag size={20} className="text-orange-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">No Etsy store connected</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-3 leading-tight">Connect your store to push listings directly from the grid</p>
              <button
                onClick={() => setShowDialog(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 font-medium transition-colors shadow-sm"
              >
                <Plus size={12} /> Connect Etsy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowDialog(false)}>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-xl max-w-sm w-full mx-4 border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <ShoppingBag size={24} className="text-orange-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-center text-zinc-900 dark:text-zinc-100 mb-2">Connect with Etsy</h3>
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-6">
              Connect your Etsy store to enable automated publishing and live taxonomy syncing.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDialog(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                disabled={isConnecting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConnect}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm"
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Store'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
