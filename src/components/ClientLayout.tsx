"use client";
import { browserStorage } from '../lib/browserStorage.ts';


import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import DesignExtractor from "@/components/DesignExtractor";
import DesignWorkspace from "@/components/DesignWorkspace";
import MockupStudio from "@/components/MockupStudio";
import WorkspaceProducts from "@/components/WorkspaceProducts";
import WorkspaceAssets from "@/components/WorkspaceAssets";
import type { PreparedArtwork } from '@/lib/workspaceArtwork';
import WorkstationAgent from '@/components/WorkstationAgent';
import AgentBrowserBridge from '@/components/AgentBrowserBridge';

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
});

const PdfEditor = dynamic(() => import("@/components/PdfEditor"), {
  ssr: false,
});

export default function ClientLayout() {
  const [workstation, setWorkstation] = useState<"etsy" | "amazon" | "workspace">(() => {
    if (typeof window !== "undefined") {
      const saved = browserStorage.getItem("active_workstation");
      if (saved === "etsy" || saved === "amazon" || saved === "workspace") return saved as "etsy" | "amazon" | "workspace";
    }
    return "workspace";
  });

  const [incomingArtwork, setIncomingArtwork] = useState<PreparedArtwork[] | null>(null);
  const [incomingAsset, setIncomingAsset] = useState<{ url: string; name: string; requestId: string } | null>(null);
  const [mockupSubview, setMockupSubview] = useState<'choose' | 'custom'>('choose');
  const [sourcePresetId, setSourcePresetId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"assets" | "spreadsheet" | "image" | "design-tools" | "pdf" | "products" | "creator" | "agent">(() => {
    if (typeof window !== "undefined") {
      const saved = browserStorage.getItem("workstation_active_view");
      if (saved === "assets" || saved === "image" || saved === "design-tools" || saved === "spreadsheet" || saved === "pdf" || saved === "products" || saved === "creator" || saved === "agent") return saved;
    }
    return "image";
  });

  const handleSetActiveView = (view: "assets" | "spreadsheet" | "image" | "design-tools" | "pdf" | "products" | "creator" | "agent", presetId?: string) => {
    if (view === 'creator') { setMockupSubview('choose'); setSourcePresetId(presetId || null); }
    setActiveView(view);
    if (typeof window !== "undefined") {
      browserStorage.setItem("workstation_active_view", view);
    }
  };

  const handleSetWorkstation = (ws: "etsy" | "amazon" | "workspace") => {
    setWorkstation(ws);
    if (ws === "workspace" && activeView === "spreadsheet") handleSetActiveView("image");
    if (typeof window !== "undefined") {
      browserStorage.setItem("active_workstation", ws);
    }
  };

  return (
    <div className={`flex w-full h-dvh flex-col bg-zinc-50 font-sans overflow-hidden sm:flex-row ${workstation === 'workspace' ? 'workspace-mode' : ''}`}>
      <Sidebar 
        activeView={activeView} 
        setActiveView={handleSetActiveView}
        workstation={workstation}
        setWorkstation={handleSetWorkstation}
      />
      <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:h-full ${workstation === 'workspace' ? 'workspace-shell' : ''}`}>
        <AgentBrowserBridge enabled={workstation === 'workspace'} />
        <div className="min-h-0 flex-1 overflow-hidden">
        <div className={workstation === 'workspace' && activeView === 'image' ? 'h-full' : 'hidden'} aria-hidden={workstation !== 'workspace' || activeView !== 'image'}>
          <DesignWorkspace incomingAsset={incomingAsset} onOpenAssets={() => handleSetActiveView('assets')} onContinue={artwork => { setIncomingArtwork(artwork); handleSetActiveView('creator'); }} />
        </div>
        <div className={workstation === 'workspace' && activeView === 'design-tools' ? 'h-full' : 'hidden'} aria-hidden={workstation !== 'workspace' || activeView !== 'design-tools'}>
          <DesignExtractor onCreateProduct={artwork => { setIncomingArtwork(artwork); handleSetActiveView('creator'); }} />
        </div>
        {workstation === "workspace" ? (
          activeView === "agent" ? <WorkstationAgent /> : activeView === "creator" ? (mockupSubview === 'custom' ? <MockupStudio templateOnly initialArtwork={incomingArtwork?.[0]?.design} onContinue={() => setMockupSubview('choose')} /> : <WorkspaceProducts key="mockup" mode="mockup" initialTemplateId={sourcePresetId || undefined} onOpenCreator={() => setMockupSubview('custom')} onProductCreated={() => handleSetActiveView('products')} incomingArtwork={incomingArtwork} onArtworkConsumed={() => setIncomingArtwork(null)} onOpenListings={handleSetWorkstation} />) : activeView === "assets" ? <WorkspaceAssets onUseInDesign={asset => { setIncomingAsset({ ...asset, requestId: crypto.randomUUID() }); handleSetActiveView('image'); }} /> : activeView === "image" || activeView === "design-tools" ? null : activeView === 'pdf' ? <PdfEditor /> : <WorkspaceProducts key="listing" mode="listing" onOpenCreator={presetId => handleSetActiveView('creator', presetId)} onOpenListings={handleSetWorkstation} />
        ) : (
          <SpreadsheetGrid key={workstation} workstation={workstation as "etsy" | "amazon"} />
        )}
        </div>
      </main>
    </div>
  );
}
