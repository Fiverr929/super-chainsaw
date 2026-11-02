"use client";
import dynamic from 'next/dynamic';
const ClientLayout = dynamic(() => import('./ClientLayout'), { ssr: false });
export default function WorkspaceEntry({ userId }: { userId: string | null }) {
  if (typeof window !== 'undefined') window.__workstationStorageScope = userId;
  return <ClientLayout />;
}
