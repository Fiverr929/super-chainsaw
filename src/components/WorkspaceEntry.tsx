"use client";
import dynamic from 'next/dynamic';
const ClientLayout = dynamic(() => import('./ClientLayout'), { ssr: false });
export default function WorkspaceEntry({ userId,manualAccount=false }: { userId: string | null;manualAccount?:boolean }) {
  if (typeof window !== 'undefined') {window.__workstationStorageScope = userId;window.__workstationManualAccount=manualAccount;}
  return <ClientLayout />;
}
