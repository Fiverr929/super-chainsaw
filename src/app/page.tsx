import { headers } from 'next/headers';
import WorkspaceEntry from '@/components/WorkspaceEntry';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const requestHeaders = await headers();
  return <WorkspaceEntry userId={requestHeaders.get('oai-authenticated-user-id')} />;
}
