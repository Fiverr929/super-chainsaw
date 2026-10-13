"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import SettingsModal from "./SettingsModal";

type Store = {
  id: string;
  name: string;
  sellerId?: string;
};

type View = "assets" | "spreadsheet" | "image" | "pdf" | "products" | "creator";
type Workstation = "etsy" | "amazon" | "workspace";

interface SidebarProps {
  activeView?: View;
  setActiveView?: (view: View) => void;
  workstation?: Workstation;
  setWorkstation?: (ws: Workstation) => void;
}

const navButton = "group flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors";
const selectedNav = "bg-blue-50 font-medium text-blue-700";
const idleNav = "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950";

export default function Sidebar({
  activeView = "spreadsheet",
  setActiveView,
  workstation = "etsy",
  setWorkstation,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("workstation_sidebar_open") === "true";
    return false;
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [amazonStores, setAmazonStores] = useState<Store[]>([]);
  const [activeAmazonStoreId, setActiveAmazonStoreId] = useState<string | null>(null);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem("workstation_sidebar_open", String(open));
  };

  useEffect(() => {
    const savedStores = localStorage.getItem("workstation_etsy_stores");
    const savedActiveId = localStorage.getItem("workstation_etsy_active_store_id");
    if (savedStores) {
      try {
        const parsed = JSON.parse(savedStores);
        if (Array.isArray(parsed)) {
          setStores(parsed);
          if (savedActiveId && parsed.some((store) => store.id === savedActiveId)) setActiveStoreId(savedActiveId);
          else if (parsed.length) setActiveStoreId(parsed[0].id);
        }
      } catch { /* Ignore invalid browser store data and keep the workspace usable. */ }
    }

    if (!savedStores || savedStores === "[]") {
      fetch("/api/etsy/shop")
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!data?.shop_name) return;
          const store = { id: String(Date.now()), name: data.shop_name };
          setStores([store]);
          setActiveStoreId(store.id);
          localStorage.setItem("workstation_etsy_stores", JSON.stringify([store]));
          localStorage.setItem("workstation_etsy_active_store_id", store.id);
          window.dispatchEvent(new Event("etsy-store-changed"));
        })
        .catch(() => {});
    }

    const savedAmazonStores = localStorage.getItem("workstation_amazon_stores");
    const savedActiveAmazonId = localStorage.getItem("workstation_amazon_active_store_id");
    if (savedAmazonStores) {
      try {
        const parsed = JSON.parse(savedAmazonStores);
        if (Array.isArray(parsed)) {
          setAmazonStores(parsed);
          if (savedActiveAmazonId && parsed.some((store) => store.id === savedActiveAmazonId)) setActiveAmazonStoreId(savedActiveAmazonId);
          else if (parsed.length) setActiveAmazonStoreId(parsed[0].id);
        }
      } catch { /* Ignore invalid browser store data and keep the workspace usable. */ }
    }

    if (window.location.search.includes("etsy_connected=true")) {
      fetch("/api/etsy/shop")
        .then((response) => response.json())
        .then((data) => {
          if (data.shop_name) {
            const store = { id: String(Date.now()), name: data.shop_name };
            const current = savedStores ? JSON.parse(savedStores) : [];
            if (!current.some((item: Store) => item.name === data.shop_name)) {
              const updated = [...current, store];
              setStores(updated);
              setActiveStoreId(store.id);
              localStorage.setItem("workstation_etsy_stores", JSON.stringify(updated));
              localStorage.setItem("workstation_etsy_active_store_id", store.id);
            }
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(console.error);
    }
  }, []);

  const saveStores = (nextStores: Store[], nextActiveId: string | null) => {
    setStores(nextStores);
    setActiveStoreId(nextActiveId);
    localStorage.setItem("workstation_etsy_stores", JSON.stringify(nextStores));
    if (nextActiveId) localStorage.setItem("workstation_etsy_active_store_id", nextActiveId);
    else localStorage.removeItem("workstation_etsy_active_store_id");
    window.dispatchEvent(new Event("etsy-store-changed"));
  };

  const saveAmazonStores = (nextStores: Store[], nextActiveId: string | null) => {
    setAmazonStores(nextStores);
    setActiveAmazonStoreId(nextActiveId);
    localStorage.setItem("workstation_amazon_stores", JSON.stringify(nextStores));
    if (nextActiveId) localStorage.setItem("workstation_amazon_active_store_id", nextActiveId);
    else localStorage.removeItem("workstation_amazon_active_store_id");
    window.dispatchEvent(new Event("amazon-store-changed"));
  };

  const activeStore = stores.find((store) => store.id === activeStoreId);
  const activeAmazonStore = amazonStores.find((store) => store.id === activeAmazonStoreId);
  const isWorkspace = workstation === "workspace";

  const openWorkspaceView = (view: View) => {
    if (workstation !== "workspace") setWorkstation?.("workspace");
    setActiveView?.(view);
  };

  const openChannel = (channel: "etsy" | "amazon") => {
    setWorkstation?.(channel);
    setActiveView?.("spreadsheet");
  };

  const viewItems = [
    { view: "assets" as const, label: "Assets", hint: "Source media by listing", icon: Images, step: "01" },
    { view: "image" as const, label: "Design", hint: "Create or open artwork", icon: ImageIcon, step: "02" },
    { view: "creator" as const, label: "Mockups", hint: "Place artwork on a product", icon: LayoutGrid, step: "03" },
    { view: "products" as const, label: "Products", hint: "Review saved product drafts", icon: Package, step: "04" },
  ];

  const renderStoreCard = () => {
    if (workstation === "workspace") {
      return <div className="border border-zinc-200 bg-zinc-50 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Next step</p><p className="mt-1 text-xs leading-5 text-zinc-600">Choose Etsy or Amazon when a product is ready for a listing.</p></div>;
    }

    const isEtsy = workstation === "etsy";
    const active = isEtsy ? activeStore : activeAmazonStore;
    const connectedStores = isEtsy ? stores : amazonStores;
    const activeId = isEtsy ? activeStoreId : activeAmazonStoreId;
    const Icon = isEtsy ? ShoppingBag : ShoppingCart;

    if (!active) {
      return <div className="flex items-center gap-2 border border-dashed border-zinc-300 bg-zinc-50 px-2.5 py-2">
        <Icon size={15} className="shrink-0 text-zinc-500" />
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-4 text-zinc-700">{isEtsy ? "Etsy not connected" : "Amazon not connected"}</p>
        <button aria-label={`Connect ${isEtsy ? "Etsy" : "Amazon"} store`} onClick={() => isEtsy ? window.location.assign("/api/etsy/auth") : setShowSettingsModal(true)} className="shrink-0 bg-blue-600 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-blue-700">Connect</button>
      </div>;
    }

    return <div className="relative">
      <button onClick={() => setStoreDropdownOpen((open) => !open)} aria-expanded={storeDropdownOpen} className="flex w-full items-center gap-2 border border-zinc-200 bg-white px-3 py-2.5 text-left hover:border-blue-200 hover:bg-blue-50/50">
        <Icon size={15} className="shrink-0 text-blue-600" />
        <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase tracking-wide text-zinc-400">Connected store</span><span className="block truncate text-xs font-medium text-zinc-800">{active.name}</span></span>
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <ChevronUp size={13} className={`shrink-0 text-zinc-400 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`} />
      </button>
      {storeDropdownOpen && <>
        <button aria-label="Close store menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setStoreDropdownOpen(false)} />
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 border border-zinc-200 bg-white py-1 shadow-lg">
          {connectedStores.map((store) => <button key={store.id} onClick={() => { setStoreDropdownOpen(false); if (isEtsy) saveStores(stores, store.id); else saveAmazonStores(amazonStores, store.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50">
            <Check size={12} className={store.id === activeId ? "text-blue-600" : "text-transparent"} /><span className="truncate text-zinc-700">{store.name}</span>
          </button>)}
          <div className="mt-1 border-t border-zinc-100 pt-1"><button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-blue-700 hover:bg-blue-50" onClick={() => { setStoreDropdownOpen(false); setShowSettingsModal(true); }}><Settings size={12} /> Manage stores</button></div>
        </div>
      </>}
    </div>;
  };

  return <>
    <aside aria-label="Main navigation" className={`${isOpen ? "w-64" : "w-[68px]"} relative z-10 flex h-full shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200`}>
      <header className={`flex h-14 shrink-0 items-center border-b border-zinc-200 ${isOpen ? "justify-between px-4" : "justify-center px-2"}`}>
        <div className={`min-w-0 ${!isOpen ? "hidden" : ""}`}>
          <span className="block text-[15px] font-semibold tracking-tight text-zinc-900">Workstation</span>
        </div>
        <button type="button" onClick={() => handleSetIsOpen(!isOpen)} aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"} title={isOpen ? "Collapse sidebar" : "Expand sidebar"} className="grid h-8 w-8 shrink-0 place-items-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          {isOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
        </button>
      </header>

      <nav className={`${isOpen ? "flex-1 space-y-6 overflow-y-auto px-3 py-5" : "flex-1 space-y-2 overflow-y-auto px-2 py-4"}`}>
        <section aria-label="Product studio">
          {isOpen && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Product studio</p>}
          <div className="space-y-1">
            {viewItems.map(({ view, label, hint, icon: Icon, step }) => {
              const active = isWorkspace && activeView === view;
              return <button key={view} type="button" onClick={() => openWorkspaceView(view)} aria-current={active ? "page" : undefined} aria-label={label} title={!isOpen ? label : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${active ? selectedNav : idleNav}`}>
                <Icon size={17} className="shrink-0" />
                {isOpen && <><span className="min-w-0 flex-1"><span className="block">{label}</span><span className={`mt-0.5 block text-[10px] font-normal ${active ? "text-blue-600/70" : "text-zinc-400"}`}>{hint}</span></span><span className={`text-[10px] tabular-nums ${active ? "text-blue-500" : "text-zinc-300"}`}>{step}</span></>}
              </button>;
            })}
          </div>
        </section>

        <section aria-label="Listing channels">
          {isOpen && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Listing channels</p>}
          <div className="space-y-1">
            <button type="button" onClick={() => openChannel("etsy")} aria-current={workstation === "etsy" ? "page" : undefined} aria-label="Etsy worksheet" title={!isOpen ? "Etsy worksheet" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${workstation === "etsy" ? selectedNav : idleNav}`}>
              <ShoppingBag size={17} className="shrink-0" />{isOpen && <><span className="flex-1">Etsy</span><span className={`h-1.5 w-1.5 rounded-full ${stores.length ? "bg-emerald-500" : "bg-zinc-300"}`} /></>}
            </button>
            <button type="button" onClick={() => openChannel("amazon")} aria-current={workstation === "amazon" ? "page" : undefined} aria-label="Amazon worksheet" title={!isOpen ? "Amazon worksheet" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${workstation === "amazon" ? selectedNav : idleNav}`}>
              <ShoppingCart size={17} className="shrink-0" />{isOpen && <><span className="flex-1">Amazon</span><span className={`h-1.5 w-1.5 rounded-full ${amazonStores.length ? "bg-emerald-500" : "bg-zinc-300"}`} /></>}
            </button>
          </div>
        </section>

        <section aria-label="Tools">
          {isOpen && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Tools</p>}
          <button type="button" onClick={() => openWorkspaceView("pdf")} aria-current={isWorkspace && activeView === "pdf" ? "page" : undefined} aria-label="PDF Manager" title={!isOpen ? "PDF Manager" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${isWorkspace && activeView === "pdf" ? selectedNav : idleNav}`}>
            <FileText size={17} className="shrink-0" />{isOpen && <span className="flex-1">PDF Manager</span>}
          </button>
        </section>
      </nav>

      <footer className="shrink-0 border-t border-zinc-200 p-3">
        {isOpen && <div className="mb-3">{renderStoreCard()}</div>}
        <button type="button" onClick={() => setShowSettingsModal(true)} aria-label="Settings" title={!isOpen ? "Settings" : undefined} className={`${navButton} ${isOpen ? "px-2" : "justify-center px-0"} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900`}>
          <Settings size={16} className="shrink-0" />{isOpen && <span>Settings</span>}
        </button>
      </footer>
    </aside>

    <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} etsyStores={stores} activeEtsyStoreId={activeStoreId} onEtsyStoresChange={saveStores} amazonStores={amazonStores} activeAmazonStoreId={activeAmazonStoreId} onAmazonStoresChange={saveAmazonStores} />
  </>;
}
