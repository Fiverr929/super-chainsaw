import handler from 'vinext/server/app-router-entry';
import { createCloudWorkspaceFs, CloudStorageConflict, type CloudBucket, type CloudDatabase } from '../src/lib/cloudWorkspaceFs';
import { withWorkspaceStorage } from '../src/lib/workspaceFs';
import path from 'node:path';
import { authenticateSession } from '../src/lib/manualAuth';
import { manualAuthRoute } from '../src/lib/manualAuthRoutes';
import { loginResponse } from '../src/lib/loginPage';

interface Env {
  WORKSTATION_SETUP_TOKEN_HASH?: string;
  WORKSTATION_SETUP_EXPIRES_AT?: string;
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
    if(url.pathname==='/setup' || url.pathname.startsWith('/auth/')) {
      if(!env.DB)return Response.json({error:'Account storage is unavailable.'},{status:503});
      const authResponse=await manualAuthRoute(request,env.DB,{setupTokenHash:env.WORKSTATION_SETUP_TOKEN_HASH,setupExpiresAt:env.WORKSTATION_SETUP_EXPIRES_AT});
      return authResponse ?? new Response(null,{status:404});
    }
    const pageRoute = url.pathname === '/' || url.pathname === '/login';
    // Guard every request reaching the app router, including encoded paths and
    // framework server-rendering endpoints. Built static assets contain no data.
    if (!env.DB || !env.BUCKET) return Response.json({ error:'Cloud workspace storage is not configured.' }, { status:503 });
    const account=await authenticateSession(env.DB,request);
    if (!account) {
      if (pageRoute) return loginResponse();
      return Response.json({ error:'Sign in to access your workspace.' }, { status:401, headers:{ 'Cache-Control':'no-store' } });
    }
    const userId=account.ownerId;
    if (url.pathname === '/login') return Response.redirect(new URL('/',url),302);
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error:'Use this workspace to make changes.' },{status:403});
    }
    // Browser-provided or Sites identity headers never grant manual-account access.
    const authenticatedHeaders=new Headers(request.headers);
    authenticatedHeaders.set('oai-authenticated-user-id',userId);
    authenticatedHeaders.set('x-workstation-manual-account','true');
    authenticatedHeaders.delete('oai-authenticated-user-email');
    request=new Request(request,{headers:authenticatedHeaders});
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
