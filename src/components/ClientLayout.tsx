"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import DesignExtractor from "@/components/DesignExtractor";

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

  const [activeView, setActiveView] = useState<"spreadsheet" | "image" | "pdf">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_active_view");
      if (saved === "image" || saved === "spreadsheet" || saved === "pdf") return saved as "spreadsheet" | "image" | "pdf";
    }
    return "spreadsheet";
  });

  const handleSetActiveView = (view: "spreadsheet" | "image" | "pdf") => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      localStorage.setItem("workstation_active_view", view);
    }
  };

  const handleSetWorkstation = (ws: "etsy" | "amazon" | "workspace") => {
    setWorkstation(ws);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_workstation", ws);
    }
  };

  return (
    <div className="flex w-full h-screen bg-zinc-50 font-sans overflow-hidden">
      <Sidebar 
        activeView={activeView} 
        setActiveView={handleSetActiveView}
        workstation={workstation}
        setWorkstation={handleSetWorkstation}
      />
      <main className="flex-1 w-full h-full overflow-hidden">
        {workstation === "workspace" ? (
          activeView === "image" ? <DesignExtractor /> : <PdfEditor />
        ) : (
          <SpreadsheetGrid key={workstation} workstation={workstation as "etsy" | "amazon"} />
        )}
      </main>
    </div>
  );
}
