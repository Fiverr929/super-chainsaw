import type { CloudDatabase } from './cloudWorkspaceFs.ts';
import { AuthError, createSingleAccount, hasAccount, issueSession, revokeSession, verifyLogin } from './manualAuth.ts';
import { loginResponse } from './loginPage.ts';

export type SetupConfig={setupTokenHash?:string;setupExpiresAt?:string};
async function readForm(request:Request) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new AuthError('Submit the sign-in form to continue.',415);
  const reader=request.body?.getReader(); if(!reader)throw new AuthError('Complete the form to continue.');
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new AuthError('The form is too large.',413);}chunks.push(value);}
  const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  return {username:form.get('username')??'',password:form.get('password')??'',confirmation:form.get('confirmation')??'',setupToken:form.get('setupToken')??''};
}
function redirect(cookie?:string,to='/') {
  const headers=new Headers({'Location':to,'Cache-Control':'private, no-store'});
  if(cookie)headers.set('Set-Cookie',cookie);
  return new Response(null,{status:303,headers});
}
export async function manualAuthRoute(request:Request,db:CloudDatabase,config:SetupConfig):Promise<Response|null> {
  const url=new URL(request.url);
  if(url.pathname==='/setup' && request.method==='GET') {
    if(await hasAccount(db))return redirect(undefined,'/login');
    const expiry=Date.parse(config.setupExpiresAt??'');
    if(!config.setupTokenHash || !Number.isFinite(expiry) || expiry<=Date.now()) return loginResponse({error:'Account setup is unavailable. Open your current setup link.'},403);
    return loginResponse({setup:true});
  }
  if(!['/auth/login','/auth/setup','/auth/logout'].includes(url.pathname))return null;
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  if(request.headers.get('origin')!==url.origin || request.headers.get('sec-fetch-site')==='cross-site')return new Response('Use the form on this site.',{status:403});
  let input:Awaited<ReturnType<typeof readForm>>|undefined;
  try {
    if(url.pathname==='/auth/logout')return redirect(await revokeSession(db,request),'/login');
    input=await readForm(request);
    if(url.pathname==='/auth/setup')await createSingleAccount(db,input,config);
    else await verifyLogin(db,input.username,input.password,request.headers.get('cf-connecting-ip')??'unknown');
    return redirect(await issueSession(db));
  } catch(error) {
    const message=error instanceof AuthError?error.message:'Could not sign in. Please try again.';
    const status=error instanceof AuthError?error.status:500;
    // Never return or log a submitted password.
    if(!(error instanceof AuthError))console.error('Account request failed.',error instanceof Error?error.name:'Unknown error');
    const response=loginResponse({setup:url.pathname==='/auth/setup',error:message,username:input?.username,setupToken:input?.setupToken},status);
    if(status===429)response.headers.set('Retry-After','900');
    return response;
  }
}
