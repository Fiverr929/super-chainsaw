import { timingSafeEqual } from 'node:crypto';
import type { CloudDatabase } from './cloudWorkspaceFs.ts';

// Cloudflare Workers rejects PBKDF2 counts above 100,000 in production.
const ITERATIONS = 100_000;
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = '__Host-workstation_session';
const LOCAL_SESSION_COOKIE='workstation_local_session';
export function isLocalHttpRequest(request:Request) {
  const url=new URL(request.url);
  return url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
}
type Account = { username:string; salt:string; password_hash:string; iterations:number; owner_id:string };
export type AccountIdentity = { username:string; ownerId:string };
export class AuthError extends Error {
  status:number;
  constructor(message:string, status=400) { super(message); this.status=status; }
}
const encode = new TextEncoder();
const hex = (bytes:Uint8Array) => Buffer.from(bytes).toString('hex');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function tokenHash(token:string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(token))));
}
function equalHex(a:string,b:string) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
async function passwordHash(password:string,salt:string,iterations=ITERATIONS) {
  const key=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(Buffer.from(salt,'hex')),iterations},key,256)));
}
function query(db:CloudDatabase,sql:string,...args:unknown[]) { return db.prepare(sql).bind(...args); }
export async function hasAccount(db:CloudDatabase) {
  return !!await query(db,'SELECT id FROM workspace_account WHERE id=1').first();
}
export async function createSingleAccount(db:CloudDatabase, input:{username:string;password:string;confirmation:string;setupToken:string}, config:{setupTokenHash?:string;setupExpiresAt?:string}, now=Date.now()) {
  const expected=config.setupTokenHash;
  const expires=Date.parse(config.setupExpiresAt ?? '');
  if (!expected || !Number.isFinite(expires) || expires <= now || !equalHex(await tokenHash(input.setupToken),expected)) throw new AuthError('This setup link is invalid or has expired.',403);
  if (await hasAccount(db)) throw new AuthError('The account has already been created. Sign in instead.',409);
  const username=input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new AuthError('Use 3–64 letters, numbers, dots, underscores, or hyphens for your username.');
  if (input.password.length<12 || input.password.length>256) throw new AuthError('Choose a password between 12 and 256 characters.');
  if (input.password !== input.confirmation) throw new AuthError('The passwords don’t match.');
  const salt=randomToken(), hash=await passwordHash(input.password,salt), ownerId=crypto.randomUUID();
  const result=await query(db,`INSERT INTO workspace_account (id,username,salt,password_hash,iterations,owner_id,created_at)
    SELECT 1,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM workspace_account WHERE id=1)`,username,salt,hash,ITERATIONS,ownerId,now).run();
  if (!result.meta.changes) throw new AuthError('The account has already been created. Sign in instead.',409);
  return { username,ownerId };
}
async function reserveLoginAttempt(db:CloudDatabase,ip:string,now:number) {
  const window=15*60*1000;
  const keys=[{key:'account',limit:30},{key:'ip:'+await tokenHash(ip),limit:6}];
  for (const {key,limit} of keys) {
    const row=await query(db,`INSERT INTO workspace_login_attempts (key,window_start,attempts) VALUES (?,?,1)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END RETURNING attempts`,key,now,now-window,now-window).first<{attempts:number}>();
    if (!row || row.attempts>limit) throw new AuthError('Too many sign-in attempts. Please try again in 15 minutes.',429);
  }
}
export async function verifyLogin(db:CloudDatabase,username:string,password:string,ip:string,now=Date.now()):Promise<AccountIdentity> {
  await reserveLoginAttempt(db,ip,now);
  if (username.length>64 || password.length>256) throw new AuthError('Username or password is incorrect.',401);
  const account=await query(db,'SELECT * FROM workspace_account WHERE id=1').first<Account>();
  // Derive even for a missing account or wrong username to avoid a cheap timing oracle.
  const actual=await passwordHash(password,account?.salt ?? '00'.repeat(32),account?.iterations ?? ITERATIONS);
  if (!account || !equalHex(actual,account.password_hash) || username.trim().toLowerCase()!==account.username) throw new AuthError('Username or password is incorrect.',401);
  await query(db,'DELETE FROM workspace_login_attempts WHERE key=? OR window_start<?','ip:'+await tokenHash(ip),now-24*60*60*1000).run();
  return {username:account.username,ownerId:account.owner_id};
}
export async function issueSession(db:CloudDatabase,now=Date.now(),local=false) {
  const token=randomToken();
  await query(db,'DELETE FROM workspace_sessions WHERE expires_at<=?',now).run();
  await query(db,'INSERT INTO workspace_sessions (token_hash,expires_at,created_at) VALUES (?,?,?)',await tokenHash(token),now+SESSION_AGE,now).run();
  return `${local?LOCAL_SESSION_COOKIE:SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${local?'':'Secure; '}SameSite=Strict; Max-Age=${SESSION_AGE/1000}`;
}
function readToken(request:Request) {
  const name=isLocalHttpRequest(request)?LOCAL_SESSION_COOKIE:SESSION_COOKIE;
  const cookies=(request.headers.get('cookie') ?? '').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  if (cookies.length!==1) return null;
  const token=cookies[0].slice(name.length+1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function authenticateSession(db:CloudDatabase,request:Request,now=Date.now()):Promise<AccountIdentity|null> {
  const token=readToken(request); if(!token)return null;
  const account=await query(db,`SELECT a.username,a.owner_id FROM workspace_account a
    JOIN workspace_sessions s ON a.id=1 WHERE s.token_hash=? AND s.expires_at>?`,await tokenHash(token),now).first<Account>();
  return account ? {username:account.username,ownerId:account.owner_id} : null;
}
export async function revokeSession(db:CloudDatabase,request:Request) {
  const token=readToken(request);
  if(token)await query(db,'DELETE FROM workspace_sessions WHERE token_hash=?',await tokenHash(token)).run();
  const local=isLocalHttpRequest(request);
  return `${local?LOCAL_SESSION_COOKIE:SESSION_COOKIE}=; Path=/; HttpOnly; ${local?'':'Secure; '}SameSite=Strict; Max-Age=0`;
}
