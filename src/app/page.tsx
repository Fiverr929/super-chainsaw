"use client";

import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="flex w-full h-screen bg-zinc-50 dark:bg-zinc-950 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 w-full h-full overflow-hidden">
        <SpreadsheetGrid />
      </main>
    </div>
  );
}
