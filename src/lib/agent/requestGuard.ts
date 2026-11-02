import { NextResponse } from 'next/server';
import { workspaceStorageContext } from '../workspaceFs.ts';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Restrict agent APIs to the local workstation origin. The server should also bind to loopback. */
export function rejectNonLocalAgentRequest(request: Request) {
  const host = request.headers.get('host');
  if (!host) return forbidden();

  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return forbidden();
  }
  if (!LOOPBACK_HOSTS.has(hostname) && !workspaceStorageContext()?.userId) return forbidden();

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.host.toLowerCase() !== host.toLowerCase()) return forbidden();
    } catch {
      return forbidden();
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return forbidden();

  return null;
}

function forbidden() {
  return NextResponse.json({ error: 'Agent access is limited to this workstation.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
}
