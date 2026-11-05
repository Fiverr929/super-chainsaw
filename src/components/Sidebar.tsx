"use client";
import { browserStorage } from '../lib/browserStorage.ts';


import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Bot,
  FileText,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Menu,
  LogOut,
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

type View = "assets" | "spreadsheet" | "image" | "design-tools" | "pdf" | "products" | "creator" | "agent";
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
    if (typeof window !== "undefined") return window.innerWidth >= 640 && browserStorage.getItem("workstation_sidebar_open") === "true";
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
    browserStorage.setItem("workstation_sidebar_open", String(open));
  };

  useEffect(() => {
    const savedStores = browserStorage.getItem("workstation_etsy_stores");
    const savedActiveId = browserStorage.getItem("workstation_etsy_active_store_id");
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
          browserStorage.setItem("workstation_etsy_stores", JSON.stringify([store]));
          browserStorage.setItem("workstation_etsy_active_store_id", store.id);
          window.dispatchEvent(new Event("etsy-store-changed"));
        })
        .catch(() => {});
    }

    const savedAmazonStores = browserStorage.getItem("workstation_amazon_stores");
    const savedActiveAmazonId = browserStorage.getItem("workstation_amazon_active_store_id");
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
              browserStorage.setItem("workstation_etsy_stores", JSON.stringify(updated));
              browserStorage.setItem("workstation_etsy_active_store_id", store.id);
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
    browserStorage.setItem("workstation_etsy_stores", JSON.stringify(nextStores));
    if (nextActiveId) browserStorage.setItem("workstation_etsy_active_store_id", nextActiveId);
    else browserStorage.removeItem("workstation_etsy_active_store_id");
    window.dispatchEvent(new Event("etsy-store-changed"));
  };

  const saveAmazonStores = (nextStores: Store[], nextActiveId: string | null) => {
    setAmazonStores(nextStores);
    setActiveAmazonStoreId(nextActiveId);
    browserStorage.setItem("workstation_amazon_stores", JSON.stringify(nextStores));
    if (nextActiveId) browserStorage.setItem("workstation_amazon_active_store_id", nextActiveId);
    else browserStorage.removeItem("workstation_amazon_active_store_id");
    window.dispatchEvent(new Event("amazon-store-changed"));
  };

  const activeStore = stores.find((store) => store.id === activeStoreId);
  const activeAmazonStore = amazonStores.find((store) => store.id === activeAmazonStoreId);
  const isWorkspace = workstation === "workspace";

  const openWorkspaceView = (view: View) => {
    if (workstation !== "workspace") setWorkstation?.("workspace");
    setActiveView?.(view);
    if (window.innerWidth < 640) setIsOpen(false);
  };

  const openChannel = (channel: "etsy" | "amazon") => {
    setWorkstation?.(channel);
    setActiveView?.("spreadsheet");
    if (window.innerWidth < 640) setIsOpen(false);
  };

  const navigationGroups = [
    { label: 'Create', items: [
      { view: 'image' as const, label: 'Design', icon: ImageIcon },
      { view: 'creator' as const, label: 'Mockups', icon: LayoutGrid },
    ] },
    { label: 'Library', items: [
      { view: 'assets' as const, label: 'Assets', icon: Images },
      { view: 'products' as const, label: 'Products', icon: Package },
    ] },
  ];

  const renderStoreCard = () => {
    if (workstation === "workspace") {
      return null;
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
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 sm:hidden">
      <button type="button" aria-label="Open navigation" aria-expanded={isOpen} onClick={() => handleSetIsOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center text-zinc-700"><Menu size={21} /></button>
      <div className="min-w-0"><span className="block truncate text-sm font-semibold text-zinc-900">Workstation</span><span className="block truncate text-[11px] text-zinc-500">{workstation === 'workspace' ? ({image:'Design',creator:'Mockups',assets:'Assets',products:'Products','design-tools':'Design Lab',agent:'Agent',pdf:'PDF Manager',spreadsheet:'Worksheet'} as Record<View,string>)[activeView] : `${workstation === 'etsy' ? 'Etsy' : 'Amazon'} worksheet`}</span></div>
    </div>
    {isOpen && <button type="button" aria-label="Close navigation" onClick={() => handleSetIsOpen(false)} className="fixed inset-0 z-20 bg-black/40 sm:hidden" />}
    <aside aria-label="Main navigation" className={`${isOpen ? "fixed inset-y-0 left-0 z-30 w-[min(280px,85vw)] sm:relative sm:z-10 sm:w-64" : "hidden sm:relative sm:z-10 sm:flex sm:w-[68px]"} h-full shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200`}>
      <header className={`flex h-14 shrink-0 items-center border-b border-zinc-200 ${isOpen ? "justify-between px-4" : "justify-center px-2"}`}>
        <div className={`min-w-0 ${!isOpen ? "hidden" : ""}`}>
          <span className="block text-[15px] font-semibold tracking-tight text-zinc-900">Workstation</span>
        </div>
        <button type="button" onClick={() => handleSetIsOpen(!isOpen)} aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"} title={isOpen ? "Collapse sidebar" : "Expand sidebar"} className="grid h-8 w-8 shrink-0 place-items-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          {isOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
        </button>
      </header>

      <nav className={`${isOpen ? "flex-1 space-y-6 overflow-y-auto px-3 py-5" : "flex-1 space-y-2 overflow-y-auto px-2 py-4"}`}>
        {navigationGroups.map(group => <section key={group.label} aria-label={group.label}>
          {isOpen && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{group.label}</p>}
          <div className="space-y-1">{group.items.map(({ view, label, icon: Icon }) => {
            const active = isWorkspace && activeView === view;
            return <button key={view} type="button" onClick={() => openWorkspaceView(view)} aria-current={active ? 'page' : undefined} aria-label={label} title={!isOpen ? label : undefined} className={`${navButton} ${isOpen ? '' : 'justify-center px-0'} ${active ? selectedNav : idleNav}`}>
              <Icon size={17} className="shrink-0" />{isOpen && <span>{label}</span>}
            </button>;
          })}</div>
        </section>)}


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

        <details aria-label="Tools" open={!isOpen || (isWorkspace && (activeView === "agent" || activeView === "pdf" || activeView === "design-tools"))}>
          <summary className={isOpen ? "mb-2 cursor-pointer px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400" : "hidden"}>Tools</summary>
          <button type="button" onClick={() => openWorkspaceView("design-tools")} aria-current={isWorkspace && activeView === "design-tools" ? "page" : undefined} aria-label="Design Lab" title={!isOpen ? "Design Lab" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${isWorkspace && activeView === "design-tools" ? selectedNav : idleNav}`}><ImageIcon size={17} className="shrink-0" />{isOpen && <span>Design Lab</span>}</button>
          <button type="button" onClick={() => openWorkspaceView("agent")} aria-current={isWorkspace && activeView === "agent" ? "page" : undefined} aria-label="Agent" title={!isOpen ? "Agent" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${isWorkspace && activeView === "agent" ? selectedNav : idleNav}`}><Bot size={17} className="shrink-0" />{isOpen && <span>Agent</span>}</button>

          <button type="button" onClick={() => openWorkspaceView("pdf")} aria-current={isWorkspace && activeView === "pdf" ? "page" : undefined} aria-label="PDF Manager" title={!isOpen ? "PDF Manager" : undefined} className={`${navButton} ${isOpen ? "" : "justify-center px-0"} ${isWorkspace && activeView === "pdf" ? selectedNav : idleNav}`}>
            <FileText size={17} className="shrink-0" />{isOpen && <span className="flex-1">PDF Manager</span>}
          </button>
        </details>
      </nav>

      <footer className="shrink-0 border-t border-zinc-200 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {isOpen && !isWorkspace && <div className="mb-3">{renderStoreCard()}</div>}
        <button type="button" onClick={() => setShowSettingsModal(true)} aria-label="Settings" title={!isOpen ? "Settings" : undefined} className={`${navButton} ${isOpen ? "px-2" : "justify-center px-0"} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900`}>
          <Settings size={16} className="shrink-0" />{isOpen && <span>Settings</span>}
        </button>
        {typeof window !== 'undefined' && window.__workstationManualAccount && <form action="/auth/logout" method="post" target="_top">
          <button type="submit" aria-label="Sign out" title={!isOpen ? 'Sign out' : undefined} className={`${navButton} ${isOpen ? 'px-2' : 'justify-center px-0'} text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900`}><LogOut size={16} className="shrink-0"/>{isOpen && <span>Sign out</span>}</button>
        </form>}
      </footer>
    </aside>

    <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} etsyStores={stores} activeEtsyStoreId={activeStoreId} onEtsyStoresChange={saveStores} amazonStores={amazonStores} activeAmazonStoreId={activeAmazonStoreId} onAmazonStoresChange={saveAmazonStores} />
  </>;
}
