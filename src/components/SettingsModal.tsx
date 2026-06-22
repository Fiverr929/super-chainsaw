"use client";

import React, { useState } from "react";
import { X, ShoppingBag, ShoppingCart, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type Store = {
  id: string;
  name: string;
  sellerId?: string;
  refreshToken?: string;
  region?: string;
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  etsyStores: Store[];
  activeEtsyStoreId: string | null;
  onEtsyStoresChange: (newStores: Store[], newActiveId: string | null) => void;
  amazonStores: Store[];
  activeAmazonStoreId: string | null;
  onAmazonStoresChange: (newStores: Store[], newActiveId: string | null) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  etsyStores,
  activeEtsyStoreId,
  onEtsyStoresChange,
  amazonStores,
  activeAmazonStoreId,
  onAmazonStoresChange,
}: SettingsModalProps) {
  const [isConnectingEtsy, setIsConnectingEtsy] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("workstation_v2_amazon_tunnel_url") || "";
    }
    return "";
  });
  const handleTunnelUrlChange = (val: string) => {
    setTunnelUrl(val);
    localStorage.setItem("workstation_v2_amazon_tunnel_url", val);
  };
  const [isConnectingAmazon, setIsConnectingAmazon] = useState(false);

  // Accordion toggle states
  const [etsyOpen, setEtsyOpen] = useState(false);
  const [amazonOpen, setAmazonOpen] = useState(false);

  if (!isOpen) return null;

  const handleConnectEtsy = async () => {
    setIsConnectingEtsy(true);
    try {
      const res = await fetch("/api/etsy/shop");
      const data = await res.json();

      if (data.shop_name) {
        if (etsyStores.some((s) => s.name === data.shop_name)) {
          toast.error("Store is already connected");
          return;
        }

        const newStore: Store = { id: String(Date.now()), name: data.shop_name };
        const newStores = [...etsyStores, newStore];
        onEtsyStoresChange(newStores, newStore.id);
        setEtsyOpen(true);
        toast.success(`Successfully connected Etsy store: ${data.shop_name}`);
      } else {
        toast.error("Failed to connect to Etsy store");
      }
    } catch {
      toast.error("Error connecting to Etsy");
    } finally {
      setIsConnectingEtsy(false);
    }
  };

  const handleDisconnectEtsy = (id: string) => {
    const newStores = etsyStores.filter((s) => s.id !== id);
    const newActiveId = activeEtsyStoreId === id
      ? (newStores.length > 0 ? newStores[0].id : null)
      : activeEtsyStoreId;
    onEtsyStoresChange(newStores, newActiveId);
    toast.success("Etsy store disconnected");
  };

  // Real Amazon Auto-Connect using backend API
  const handleAutoConnectAmazon = async () => {
    setIsConnectingAmazon(true);
    try {
      const res = await fetch("/api/amazon/shop");
      const data = await res.json();

      if (data.shop_name) {
        if (amazonStores.some((s) => s.sellerId === data.seller_id)) {
          toast.error("This Amazon store is already connected");
          return;
        }

        const newStore: Store = { 
          id: String(Date.now()), 
          name: data.shop_name,
          sellerId: data.seller_id,
          refreshToken: data.refresh_token,
          region: data.region || "eu"
        };
        const newStores = [...amazonStores, newStore];
        onAmazonStoresChange(newStores, newStore.id);
        setAmazonOpen(true);
        toast.success(`Successfully connected Amazon store: ${data.shop_name}`);
      } else {
        toast.error(data.error || "Failed to verify Amazon SP-API credentials");
      }
    } catch {
      toast.error("Error connecting to Amazon API");
    } finally {
      setIsConnectingAmazon(false);
    }
  };

  const handleDisconnectAmazon = (id: string) => {
    const newStores = amazonStores.filter((s) => s.id !== id);
    const newActiveId = activeAmazonStoreId === id
      ? (newStores.length > 0 ? newStores[0].id : null)
      : activeAmazonStoreId;
    onAmazonStoresChange(newStores, newActiveId);
    toast.success("Amazon store disconnected");
  };

  const activeEtsyStore = etsyStores.find((s) => s.id === activeEtsyStoreId);
  const activeAmazonStore = amazonStores.find((s) => s.id === activeAmazonStoreId);

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/20 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-zinc-200 shadow-xl max-w-lg w-full mx-4 flex flex-col max-h-[85vh] rounded-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
            Settings & Connections
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-1">
              Link marketplaces
            </h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Link your store accounts to automate listing creation, push products, and manage metadata.
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Etsy Row */}
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-50 text-orange-600 rounded-none shrink-0">
                    <ShoppingBag size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 text-sm">Etsy Shop</span>
                    {activeEtsyStore ? (
                      <span className="text-xs text-blue-600 font-medium mt-0.5">
                        Connected to @{activeEtsyStore.name}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 mt-0.5">Not connected</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleConnectEtsy}
                  disabled={isConnectingEtsy}
                  className="rounded-none border border-zinc-200 hover:border-blue-200 hover:bg-blue-50/50 text-zinc-700 font-medium text-xs px-4 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isConnectingEtsy ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      Connecting
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
              </div>

              {etsyStores.length > 0 && (
                <div className="border border-zinc-200 rounded-none p-3.5 mt-3 bg-white">
                  <button
                    onClick={() => setEtsyOpen(!etsyOpen)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-zinc-800"
                  >
                    <span>Connected stores ({etsyStores.length})</span>
                    {etsyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {etsyOpen && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-zinc-100 animate-in fade-in duration-100">
                      {etsyStores.map((store) => (
                        <div 
                          key={store.id} 
                          className={`flex items-center justify-between p-2 rounded-none border text-xs cursor-pointer transition-colors ${
                            store.id === activeEtsyStoreId 
                              ? "border-blue-200 bg-blue-50/20" 
                              : "border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50"
                          }`}
                          onClick={() => onEtsyStoresChange(etsyStores, store.id)}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Check size={14} className={`shrink-0 ${store.id === activeEtsyStoreId ? "text-blue-600" : "text-transparent"}`} />
                            <span className="font-semibold text-zinc-700 truncate">{store.name}</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnectEtsy(store.id);
                            }}
                            className="rounded-none border border-zinc-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-500 text-[10px] px-2.5 py-0.5 font-medium transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Amazon Row */}
            <div className="flex flex-col border-t border-zinc-100 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-none shrink-0">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 text-sm">Amazon Seller Central</span>
                    {activeAmazonStore ? (
                      <span className="text-xs text-blue-600 font-medium mt-0.5">
                        Connected to @{activeAmazonStore.name}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 mt-0.5">Not connected</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleAutoConnectAmazon}
                  disabled={isConnectingAmazon}
                  className="rounded-none border border-zinc-200 hover:border-blue-200 hover:bg-blue-50/50 text-zinc-700 font-medium text-xs px-4 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Connect using API keys from local server environment variables"
                >
                  {isConnectingAmazon ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      Connecting
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
              </div>

              {/* Connected Amazon Stores Accordion */}
              {amazonStores.length > 0 && (
                <div className="border border-zinc-200 rounded-none p-3.5 mt-3 bg-white">
                  <button
                    onClick={() => setAmazonOpen(!amazonOpen)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-zinc-800"
                  >
                    <span>Connected stores ({amazonStores.length})</span>
                    {amazonOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {amazonOpen && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-zinc-100 animate-in fade-in duration-100">
                      {amazonStores.map((store) => (
                        <div 
                          key={store.id} 
                          className={`flex items-center justify-between p-2 rounded-none border text-xs cursor-pointer transition-colors ${
                            store.id === activeAmazonStoreId 
                              ? "border-blue-200 bg-blue-50/20" 
                              : "border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50"
                          }`}
                          onClick={() => onAmazonStoresChange(amazonStores, store.id)}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Check size={14} className={`shrink-0 ${store.id === activeAmazonStoreId ? "text-blue-600" : "text-transparent"}`} />
                            <div className="flex flex-col truncate">
                              <span className="font-semibold text-zinc-700 truncate">{store.name}</span>
                              {store.sellerId && (
                                <span className="text-[10px] text-zinc-400">ID: {store.sellerId}</span>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnectAmazon(store.id);
                            }}
                            className="rounded-none border border-zinc-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-500 text-[10px] px-2.5 py-0.5 font-medium transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Public Tunnel URL for testing */}
              <div className="mt-5 flex flex-col gap-1.5 border-t border-zinc-100 pt-5">
                <label className="text-xs font-semibold text-zinc-800">
                  Public Tunnel URL (for local image hosting)
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://funny-bears-jump.localtunnel.me"
                  value={tunnelUrl}
                  onChange={(e) => handleTunnelUrlChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-none border border-zinc-200 focus:outline-none focus:border-blue-500 bg-white text-zinc-900"
                />
                <span className="text-[10px] text-zinc-400 leading-normal">
                  Required to allow Amazon&apos;s servers to fetch your local product images. Expose your port 3000 using ngrok or localtunnel before publishing.
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
