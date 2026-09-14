"use client";

import React, { useState, useEffect } from "react";
import { X, ShoppingBag, ShoppingCart, ChevronDown, ChevronUp, Check, Loader2, Sparkles, Eye, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getStoredGeminiApiKey, setStoredGeminiApiKey, removeStoredGeminiApiKey } from "@/lib/clientApiKey";

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
  const [isConnectingAmazon, setIsConnectingAmazon] = useState(false);

  // Accordion toggle states
  const [etsyOpen, setEtsyOpen] = useState(false);
  const [amazonOpen, setAmazonOpen] = useState(false);

  // Google AI Studio state
  const [geminiKey, setGeminiKey] = useState("");
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredGeminiApiKey();
      setGeminiKey(stored);
      setHasSavedKey(Boolean(stored));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectEtsy = async () => {
    setIsConnectingEtsy(true);
    try {
      window.location.href = '/api/etsy/auth';
    } catch {
      toast.error("Error connecting to Etsy");
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

  const handleSaveGeminiKey = () => {
    const trimmed = geminiKey.trim();
    if (!trimmed) {
      removeStoredGeminiApiKey();
      setHasSavedKey(false);
      toast.success("Google AI Studio key cleared");
      return;
    }
    setStoredGeminiApiKey(trimmed);
    setHasSavedKey(true);
    toast.success("Google AI Studio key saved locally");
  };

  const handleTestGeminiKey = async () => {
    const keyToTest = geminiKey.trim();
    if (!keyToTest) {
      toast.error("Please enter a Google AI Studio API key to test");
      return;
    }

    setIsTestingGemini(true);
    try {
      const res = await fetch("/api/ai/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setStoredGeminiApiKey(keyToTest);
        setHasSavedKey(true);
        toast.success(`Connection verified! Model: ${data.model || 'gemini-2.5-flash'}`);
      } else {
        toast.error(data.error || "Verification failed. Check your API key.");
      }
    } catch {
      toast.error("Failed to connect to verification service");
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleClearGeminiKey = () => {
    removeStoredGeminiApiKey();
    setGeminiKey("");
    setHasSavedKey(false);
    toast.success("Google AI Studio key removed");
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
              Workstation Settings
            </h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Connect your Google AI Studio key and marketplaces to automate metadata generation and listing management.
            </p>
          </div>

          <div className="space-y-6">

            {/* Google AI Studio Section */}
            <div className="flex flex-col border border-zinc-200 p-4 bg-zinc-50/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-none shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 text-sm">Google AI Studio</span>
                    {hasSavedKey ? (
                      <span className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                        <Check size={12} /> Key configured
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 mt-0.5">Key not configured</span>
                    )}
                  </div>
                </div>

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Get free key <ExternalLink size={11} />
                </a>
              </div>

              <p className="text-xs text-zinc-500 mt-3">
                Powers AI titles, bullet points, tags, and design extraction with Gemini 2.5 Flash. Your key stays stored in your browser.
              </p>

              {/* API Key Input Field */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="relative flex items-center">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs font-mono border border-zinc-200 bg-white px-3 py-2 pr-9 focus:outline-none focus:border-blue-500 text-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                    title={showGeminiKey ? "Hide key" : "Show key"}
                  >
                    {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestGeminiKey}
                      disabled={isTestingGemini || !geminiKey.trim()}
                      className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs px-3 py-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isTestingGemini && <Loader2 size={12} className="animate-spin" />}
                      Test & Verify
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGeminiKey}
                      className="border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 font-medium transition-colors"
                    >
                      Save Key
                    </button>
                  </div>

                  {hasSavedKey && (
                    <button
                      type="button"
                      onClick={handleClearGeminiKey}
                      className="text-zinc-400 hover:text-red-600 text-xs p-1 transition-colors flex items-center gap-1"
                      title="Clear stored key"
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Etsy Row */}
            <div className="flex flex-col border-t border-zinc-100 pt-6">
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

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
