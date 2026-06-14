"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import DesignExtractor from "@/components/DesignExtractor";

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
});

export default function ClientLayout() {
  const [activeView, setActiveView] = useState<"spreadsheet" | "image">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_active_view");
      if (saved === "image" || saved === "spreadsheet") return saved;
    }
    return "spreadsheet";
  });

  const handleSetActiveView = (view: "spreadsheet" | "image") => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      localStorage.setItem("workstation_active_view", view);
    }
  };

  return (
    <div className="flex w-full h-screen bg-zinc-50 font-sans overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={handleSetActiveView} />
      <main className="flex-1 w-full h-full overflow-hidden">
        {activeView === "spreadsheet" ? (
          <SpreadsheetGrid />
        ) : (
          <DesignExtractor />
        )}
      </main>
    </div>
  );
}
