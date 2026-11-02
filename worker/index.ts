import handler from 'vinext/server/app-router-entry';
import { createCloudWorkspaceFs, CloudStorageConflict, type CloudBucket, type CloudDatabase } from '../src/lib/cloudWorkspaceFs';
import { withWorkspaceStorage } from '../src/lib/workspaceFs';
import path from 'node:path';

interface Env {
  DB: CloudDatabase;
  BUCKET: CloudBucket;
  IMAGES: unknown;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
const MEDIA = /^\/(?:workspace-products|workspace-assets|listings(?:-physical|-amazon)?)\//;
const MIME: Record<string,string> = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', mp4:'video/mp4', webm:'video/webm', json:'application/json', pdf:'application/pdf', svg:'image/svg+xml' };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const protectedRoute = url.pathname === '/' || url.pathname.startsWith('/api/') || MEDIA.test(url.pathname);
    const userId = request.headers.get('oai-authenticated-user-id');
    if (protectedRoute && !userId) {
      if (url.pathname === '/') return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workstation</title><body style="margin:0;background:#fafafa;color:#18181b;font:16px system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:420px;padding:40px"><h1>Workstation</h1><p>Sign in to open your workspace and save designs, products, and listings.</p><a href="/signin-with-chatgpt?return_to=%2F" target="_top" style="display:inline-block;padding:12px 18px;background:#18181b;color:white;text-decoration:none;border-radius:8px">Sign in with ChatGPT</a></main></body></html>', { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' } });
      return Response.json({ error:'Sign in to access your workspace.' }, { status:401, headers:{ 'Cache-Control':'no-store' } });
    }
    if (!protectedRoute) return handler.fetch(request, env, ctx);
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error:'Use this workspace to make changes.' },{status:403});
    }
    if (!env.DB || !env.BUCKET) return Response.json({ error:'Cloud workspace storage is not configured.' }, { status:503 });
    const storage = createCloudWorkspaceFs(env.DB, env.BUCKET, userId!);
    return withWorkspaceStorage({ fs:storage, userId:userId!, images:env.IMAGES }, async () => {
      try {
        if (MEDIA.test(url.pathname)) {
          if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
          const decoded = decodeURIComponent(url.pathname);
          if (decoded.split('/').some(part => part === '..' || part.includes('\\') || part.includes('\0'))) return new Response(null,{status:400});
          const bytes = await storage.readFile(path.join(process.cwd(),'public',decoded.replace(/^\//,'')));
          const ext = decoded.split('.').pop() ?? '';
          return new Response(request.method === 'HEAD' ? null : new Uint8Array(bytes), { headers:{ 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Content-Length':String(bytes.length), 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } });
        }
        const response = await handler.fetch(request,env,ctx);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control','private, no-store');
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      } catch (error) {
        if (error instanceof CloudStorageConflict) return Response.json({error:error.message},{status:409});
        if ((error as {code?:string}).code === 'ENOENT') return new Response(null,{status:404});
        console.error('Hosted workspace request failed', error instanceof Error ? error.message : 'Unknown error');
        return Response.json({error:'The workspace request failed. Please retry.'},{status:500});
      }
    });
  },
};
