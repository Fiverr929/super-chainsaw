"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingBag, 
  ShoppingCart,
  Check, 
  ChevronDown, 
  LayoutGrid, 
  Image as ImageIcon,
  Settings
} from "lucide-react";
import SettingsModal from "./SettingsModal";

type Store = {
  id: string;
  name: string;
  sellerId?: string;
};

interface SidebarProps {
  activeView?: "spreadsheet" | "image";
  setActiveView?: (view: "spreadsheet" | "image") => void;
  workstation?: "etsy" | "amazon";
  setWorkstation?: (ws: "etsy" | "amazon") => void;
}

export default function Sidebar({ 
  activeView = "spreadsheet", 
  setActiveView,
  workstation = "etsy",
  setWorkstation
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("workstation_sidebar_open") === "true";
    }
    return false;
  });

  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open);
    if (typeof window !== "undefined") {
      localStorage.setItem("workstation_sidebar_open", String(open));
    }
  };

  // Etsy Store States
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  // Amazon Store States
  const [amazonStores, setAmazonStores] = useState<Store[]>([]);
  const [activeAmazonStoreId, setActiveAmazonStoreId] = useState<string | null>(null);
  
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [workstationDropdownOpen, setWorkstationDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Load stores from local storage
  useEffect(() => {
    // Etsy stores
    const savedStores = localStorage.getItem("workstation_etsy_stores");
    const savedActiveId = localStorage.getItem("workstation_etsy_active_store_id");
    if (savedStores) {
      try {
        const parsed = JSON.parse(savedStores);
        if (Array.isArray(parsed)) {
          setStores(parsed);
          if (savedActiveId && parsed.some((s) => s.id === savedActiveId)) {
            setActiveStoreId(savedActiveId);
          } else if (parsed.length > 0) {
            setActiveStoreId(parsed[0].id);
          }
        }
      } catch {}
    }

    // Amazon stores
    const savedAmazonStores = localStorage.getItem("workstation_amazon_stores");
    const savedActiveAmazonId = localStorage.getItem("workstation_amazon_active_store_id");
    if (savedAmazonStores) {
      try {
        const parsed = JSON.parse(savedAmazonStores);
        if (Array.isArray(parsed)) {
          setAmazonStores(parsed);
          if (savedActiveAmazonId && parsed.some((s) => s.id === savedActiveAmazonId)) {
            setActiveAmazonStoreId(savedActiveAmazonId);
          } else if (parsed.length > 0) {
            setActiveAmazonStoreId(parsed[0].id);
          }
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
    window.dispatchEvent(new Event("etsy-store-changed"));
  };

  const saveAmazonStores = (newStores: Store[], newActiveId: string | null) => {
    setAmazonStores(newStores);
    setActiveAmazonStoreId(newActiveId);
    localStorage.setItem("workstation_amazon_stores", JSON.stringify(newStores));
    if (newActiveId) {
      localStorage.setItem("workstation_amazon_active_store_id", newActiveId);
    } else {
      localStorage.removeItem("workstation_amazon_active_store_id");
    }
    window.dispatchEvent(new Event("amazon-store-changed"));
  };

  // Etsy Active Store details
  const activeStore = stores.find(s => s.id === activeStoreId);
  const hasStores = stores.length > 0;

  // Amazon Active Store details
  const activeAmazonStore = amazonStores.find(s => s.id === activeAmazonStoreId);
  const hasAmazonStores = amazonStores.length > 0;

  // Collapsed Sidebar View
  if (!isOpen) {
    return (
      <div 
        className="w-12 h-full border-r border-zinc-200 bg-white flex flex-col items-center py-4 transition-all duration-300 relative z-10"
      >
        <button 
          onClick={() => handleSetIsOpen(true)}
          className="p-1.5 rounded-none hover:bg-zinc-100 text-zinc-500 mb-4"
          title="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>

        <div className="space-y-4 flex-1 flex flex-col items-center w-full">
          {workstation === "etsy" ? (
            <button 
              onClick={() => handleSetIsOpen(true)}
              className={`p-2 rounded-none transition-colors ${hasStores ? 'text-blue-500 bg-blue-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
              title={hasStores ? `Etsy: ${activeStore?.name}` : "No Etsy Store"}
            >
              <ShoppingBag size={18} />
            </button>
          ) : (
            <button 
              onClick={() => handleSetIsOpen(true)}
              className={`p-2 rounded-none transition-colors ${hasAmazonStores ? 'text-blue-500 bg-blue-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
              title={hasAmazonStores ? `Amazon: ${activeAmazonStore?.name}` : "No Amazon Store"}
            >
              <ShoppingCart size={18} />
            </button>
          )}
        </div>

        {/* Collapsed Sidebar Settings Button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors mt-auto"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          etsyStores={stores}
          activeEtsyStoreId={activeStoreId}
          onEtsyStoresChange={saveStores}
          amazonStores={amazonStores}
          activeAmazonStoreId={activeAmazonStoreId}
          onAmazonStoresChange={saveAmazonStores}
        />
      </div>
    );
  }

  // Expanded Sidebar View
  return (
    <>
      <div className="w-64 h-full border-r border-zinc-200 bg-white flex flex-col transition-all duration-300 relative z-10">
        
        {/* Workstation Selection Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-200">
          <div className="relative flex-1">
            <button
              onClick={() => setWorkstationDropdownOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-semibold text-zinc-800 hover:text-blue-500 transition-colors"
            >
              <span>{workstation === "etsy" ? "Etsy Workstation" : "Amazon Workstation"}</span>
              <ChevronDown size={14} className="opacity-60" />
            </button>
            
            {workstationDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWorkstationDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-zinc-200 rounded-none shadow-lg py-1 w-48">
                  <button
                    onClick={() => {
                      setWorkstation?.("etsy");
                      setWorkstationDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${workstation === "etsy" ? "text-blue-600 font-semibold" : "text-zinc-700"}`}
                  >
                    Etsy Workstation
                  </button>
                  <button
                    onClick={() => {
                      setWorkstation?.("amazon");
                      setWorkstationDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${workstation === "amazon" ? "text-blue-600 font-semibold" : "text-zinc-700"}`}
                  >
                    Amazon Workstation
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => handleSetIsOpen(false)}
            className="p-1.5 rounded-none hover:bg-zinc-100 text-zinc-500"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* View selection tabs */}
        <div className="px-3 py-2 border-b border-zinc-200">
          <div className="space-y-1">
            <button
              onClick={() => setActiveView?.('spreadsheet')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-none text-sm transition-colors ${activeView === 'spreadsheet' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              <LayoutGrid size={16} />
              Spreadsheet
            </button>
            <button
              onClick={() => setActiveView?.('image')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-none text-sm transition-colors ${activeView === 'image' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              <ImageIcon size={16} />
              Image Pipeline
            </button>
          </div>
        </div>
        
        {/* Stores Panel */}
        <div className="flex-1 overflow-y-auto p-3">
          {workstation === "etsy" ? (
            hasStores && activeStore ? (
              <div className="mb-3">
                <div className="relative mb-1">
                  <button
                    onClick={() => setStoreDropdownOpen((o) => !o)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-none border text-xs font-medium transition-colors ${
                      storeDropdownOpen
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-zinc-200 text-zinc-700 hover:border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <ShoppingBag size={12} className="text-blue-500 shrink-0" />
                    <span className="flex-1 text-left truncate">
                      {activeStore.name}
                    </span>
                    <div className="w-1.5 h-1.5 bg-green-500 shrink-0" />
                    <ChevronDown size={11} className={`text-zinc-400 shrink-0 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {storeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStoreDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-none py-1 overflow-hidden">
                        {stores.map((store) => (
                          <div
                            key={store.id}
                            className="group/item flex items-center gap-2 px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                            onClick={() => {
                              setStoreDropdownOpen(false);
                              saveStores(stores, store.id);
                            }}
                          >
                            <Check size={11} className={`shrink-0 ${store.id === activeStoreId ? "text-blue-500" : "text-transparent"}`} />
                            <span className="flex-1 truncate text-zinc-700">{store.name}</span>
                          </div>
                        ))}
                        <div className="border-t border-zinc-100 mt-1 pt-1">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-500 hover:bg-blue-50"
                            onClick={() => { setStoreDropdownOpen(false); setShowSettingsModal(true); }}
                          >
                            <Settings size={11} /> Manage Etsy Stores
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-3 rounded-none border border-dashed border-zinc-200 p-4 text-center">
                <ShoppingBag size={20} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-600 mb-1">No Etsy store connected</p>
                <p className="text-[11px] text-zinc-400 mb-3 leading-tight">Connect your store to enable automated publishing</p>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-none hover:bg-blue-700 font-medium transition-colors"
                >
                  Connect Etsy
                </button>
              </div>
            )
          ) : (
            // Amazon Workstation store selection
            hasAmazonStores && activeAmazonStore ? (
              <div className="mb-3">
                <div className="relative mb-1">
                  <button
                    onClick={() => setStoreDropdownOpen((o) => !o)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-none border text-xs font-medium transition-colors ${
                      storeDropdownOpen
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-zinc-200 text-zinc-700 hover:border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <ShoppingCart size={12} className="text-blue-500 shrink-0" />
                    <span className="flex-1 text-left truncate">
                      {activeAmazonStore.name}
                    </span>
                    <div className="w-1.5 h-1.5 bg-green-500 shrink-0" />
                    <ChevronDown size={11} className={`text-zinc-400 shrink-0 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {storeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStoreDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-none py-1 overflow-hidden">
                        {amazonStores.map((store) => (
                          <div
                            key={store.id}
                            className="group/item flex items-center gap-2 px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                            onClick={() => {
                              setStoreDropdownOpen(false);
                              saveAmazonStores(amazonStores, store.id);
                            }}
                          >
                            <Check size={11} className={`shrink-0 ${store.id === activeAmazonStoreId ? "text-blue-500" : "text-transparent"}`} />
                            <span className="flex-1 truncate text-zinc-700">{store.name}</span>
                          </div>
                        ))}
                        <div className="border-t border-zinc-100 mt-1 pt-1">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-500 hover:bg-blue-50"
                            onClick={() => { setStoreDropdownOpen(false); setShowSettingsModal(true); }}
                          >
                            <Settings size={11} /> Manage Amazon Stores
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-3 rounded-none border border-dashed border-zinc-200 p-4 text-center">
                <ShoppingCart size={20} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-600 mb-1">No Amazon store connected</p>
                <p className="text-[11px] text-zinc-400 mb-3 leading-tight">Connect your store to map product category presets</p>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-none hover:bg-blue-700 font-medium transition-colors"
                >
                  Connect Amazon
                </button>
              </div>
            )
          )}
        </div>

        {/* Expanded Sidebar Settings Button */}
        <div className="flex-none p-3 border-t border-zinc-200 bg-white">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-none text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          >
            <Settings size={14} className="text-zinc-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        etsyStores={stores}
        activeEtsyStoreId={activeStoreId}
        onEtsyStoresChange={saveStores}
        amazonStores={amazonStores}
        activeAmazonStoreId={activeAmazonStoreId}
        onAmazonStoresChange={saveAmazonStores}
      />
    </>
  );
}
