"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import DesignExtractor from "@/components/DesignExtractor";
import MockupStudio from "@/components/MockupStudio";
import WorkspaceProducts from "@/components/WorkspaceProducts";
import WorkspaceAssets from "@/components/WorkspaceAssets";
import type { PreparedArtwork } from '@/lib/workspaceArtwork';

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
});

const PdfEditor = dynamic(() => import("@/components/PdfEditor"), {
  ssr: false,
});

export default function ClientLayout() {
  const [workstation, setWorkstation] = useState<"etsy" | "amazon" | "workspace">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("active_workstation");
      if (saved === "etsy" || saved === "amazon" || saved === "workspace") return saved as "etsy" | "amazon" | "workspace";
    }
    return "etsy";
  });

  const [incomingArtwork, setIncomingArtwork] = useState<PreparedArtwork[] | null>(null);
  const [incomingAsset, setIncomingAsset] = useState<{ url: string; name: string; requestId: string } | null>(null);
  const [mockupSubview, setMockupSubview] = useState<'choose' | 'custom'>('choose');
  const [sourcePresetId, setSourcePresetId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"assets" | "spreadsheet" | "image" | "pdf" | "products" | "creator">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_active_view");
      if (saved === "assets" || saved === "image" || saved === "spreadsheet" || saved === "pdf" || saved === "products" || saved === "creator") return saved;
    }
    return "spreadsheet";
  });

  const handleSetActiveView = (view: "assets" | "spreadsheet" | "image" | "pdf" | "products" | "creator", presetId?: string) => {
    if (view === 'creator') { setMockupSubview('choose'); setSourcePresetId(presetId || null); }
    setActiveView(view);
    if (typeof window !== "undefined") {
      localStorage.setItem("workstation_active_view", view);
    }
  };

  const handleSetWorkstation = (ws: "etsy" | "amazon" | "workspace") => {
    setWorkstation(ws);
    if (ws === "workspace" && activeView === "spreadsheet") handleSetActiveView("assets");
    if (typeof window !== "undefined") {
      localStorage.setItem("active_workstation", ws);
    }
  };

  return (
    <div className={`flex w-full h-screen bg-zinc-50 font-sans overflow-hidden ${workstation === 'workspace' ? 'workspace-mode' : ''}`}>
      <Sidebar 
        activeView={activeView} 
        setActiveView={handleSetActiveView}
        workstation={workstation}
        setWorkstation={handleSetWorkstation}
      />
      <main className={`flex min-w-0 flex-1 flex-col h-full overflow-hidden ${workstation === 'workspace' ? 'workspace-shell' : ''}`}>
        <div className="min-h-0 flex-1 overflow-hidden">
        <div className={workstation === 'workspace' && activeView === 'image' ? 'h-full' : 'hidden'} aria-hidden={workstation !== 'workspace' || activeView !== 'image'}>
          <DesignExtractor incomingAsset={incomingAsset} onCreateProduct={artwork => { setIncomingArtwork(artwork); handleSetActiveView('creator'); }} />
        </div>
        {workstation === "workspace" ? (
          activeView === "creator" ? (mockupSubview === 'custom' ? <MockupStudio templateOnly initialArtwork={incomingArtwork?.[0]?.design} onContinue={() => setMockupSubview('choose')} /> : <WorkspaceProducts key="mockup" mode="mockup" initialTemplateId={sourcePresetId || undefined} onOpenCreator={() => setMockupSubview('custom')} onProductCreated={() => handleSetActiveView('products')} incomingArtwork={incomingArtwork} onArtworkConsumed={() => setIncomingArtwork(null)} onOpenListings={handleSetWorkstation} />) : activeView === "assets" ? <WorkspaceAssets onUseInDesign={asset => { setIncomingAsset({ ...asset, requestId: crypto.randomUUID() }); handleSetActiveView('image'); }} /> : activeView === "image" ? null : activeView === 'pdf' ? <PdfEditor /> : <WorkspaceProducts key="listing" mode="listing" onOpenCreator={presetId => handleSetActiveView('creator', presetId)} onOpenListings={handleSetWorkstation} />
        ) : (
          <SpreadsheetGrid key={workstation} workstation={workstation as "etsy" | "amazon"} />
        )}
        </div>
      </main>
    </div>
  );
}
