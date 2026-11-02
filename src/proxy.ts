import { NextResponse, type NextRequest } from 'next/server';
import { authenticateSession, hasAccount } from './lib/manualAuth.ts';
import { manualAuthRoute } from './lib/manualAuthRoutes.ts';
import { loginResponse } from './lib/loginPage.ts';

export async function proxy(request:NextRequest) {
  // Sites has its own Worker guard. This branch and SQLite are local-only.
  if(process.env.WORKSTATION_HOSTED==='true')return NextResponse.next();
  const {localAuth}=await import('./lib/localAuth.ts');
  const auth=await localAuth();
  try {
    const url=new URL(request.url);
    try {const incoming=new URL(`http://${request.headers.get('host')}`);if(['localhost','127.0.0.1','[::1]'].includes(incoming.hostname))url.host=incoming.host;}catch{ /* Retain the request origin. */ }
    const authResponse=await manualAuthRoute(request,auth.db,auth.config);
    if(authResponse)return authResponse;
    if((url.pathname==='/' || url.pathname==='/login') && !await hasAccount(auth.db))return NextResponse.redirect(new URL('/setup',url));
    const account=await authenticateSession(auth.db,request);
    if(!account) {
      if(url.pathname==='/' || url.pathname==='/login')return loginResponse();
      return Response.json({error:'Sign in to access your workspace.'},{status:401,headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname==='/login')return NextResponse.redirect(new URL('/',url));
    const headers=new Headers(request.headers);
    // Keep existing local browser caches and disk records in their local scope.
    headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
    headers.set('x-workstation-manual-account','true');
    return NextResponse.next({request:{headers}});
  } finally {auth.close();}
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|mockups/).*)']};
