import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { CloudDatabase } from '../src/lib/cloudWorkspaceFs.ts';
import { authenticateSession, createSingleAccount, hasAccount, issueSession, revokeSession, tokenHash, verifyLogin } from '../src/lib/manualAuth.ts';
import { manualAuthRoute } from '../src/lib/manualAuthRoutes.ts';

function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(path.join(process.cwd(),'drizzle','0001_perpetual_rogue.sql'),'utf8'));
  const db={prepare(sql:string){return{bind(...args:unknown[]){const values=args as (string|number|null)[];return{
    async first(){return sqlite.prepare(sql).get(...values)??null;},
    async all(){return{results:sqlite.prepare(sql).all(...values)};},
    async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};},
  };}};}} as unknown as CloudDatabase;
  return {db,sqlite};
}
const input={username:'Owner',password:'test-only-strong-password',confirmation:'test-only-strong-password',setupToken:'ab'.repeat(32)};
const configuration=async()=>({setupTokenHash:await tokenHash(input.setupToken),setupExpiresAt:new Date(Date.now()+60_000).toISOString()});

test('one-time setup requires its valid key, expires, and permits exactly one account even under a race',async()=>{
  const f=fixture(),config=await configuration();
  await assert.rejects(createSingleAccount(f.db,{...input,setupToken:'wrong'},config),/invalid/);
  await assert.rejects(createSingleAccount(f.db,input,{...config,setupExpiresAt:'2000-01-01T00:00:00Z'}),/expired/);
  assert.equal(await hasAccount(f.db),false);
  const result=await Promise.allSettled([createSingleAccount(f.db,input,config),createSingleAccount(f.db,{...input,username:'Second'},config)]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) AS total FROM workspace_account').get() as {total:number}).total,1);
  await assert.rejects(createSingleAccount(f.db,input,config),/already been created/);
  assert.throws(()=>f.sqlite.exec("INSERT INTO workspace_account SELECT 2,username,salt,password_hash,iterations,owner_id,created_at FROM workspace_account"),/CHECK constraint/);
  const account=f.sqlite.prepare('SELECT * FROM workspace_account').get()!;
  assert.equal(account.iterations,600_000); assert.notEqual(account.password_hash,input.password);
  f.sqlite.close();
});

test('manual sign-in verifies credentials and sessions expire and revoke without trusting identity headers',async()=>{
  const f=fixture();await createSingleAccount(f.db,input,await configuration());
  await assert.rejects(verifyLogin(f.db,'other',input.password,'test-ip'),/incorrect/);
  await assert.rejects(verifyLogin(f.db,'owner','wrong-password','test-ip'),/incorrect/);
  const owner=await verifyLogin(f.db,'OWNER',input.password,'test-ip');
  assert.equal(owner.username,'owner');
  const cookie=await issueSession(f.db),raw=cookie.split(';')[0];
  assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
  const request=new Request('https://workspace.example/',{headers:{cookie:raw}});
  assert.deepEqual(await authenticateSession(f.db,request),owner);
  assert.equal(await authenticateSession(f.db,request,Date.now()+8*24*60*60*1000),null);
  assert.equal(await authenticateSession(f.db,new Request('https://workspace.example/',{headers:{'oai-authenticated-user-id':owner.ownerId,'oai-authenticated-user-email':'owner@example.com'}})),null);
  const saved=f.sqlite.prepare('SELECT token_hash FROM workspace_sessions').get()!;
  assert.notEqual(saved.token_hash,raw.split('=')[1]);
  await revokeSession(f.db,request); assert.equal(await authenticateSession(f.db,request),null);
  f.sqlite.close();
});

test('sign-in attempts are bounded and cross-site forms cannot create accounts or sessions',async()=>{
  const f=fixture();await createSingleAccount(f.db,input,await configuration());
  for(let i=0;i<6;i++)await assert.rejects(verifyLogin(f.db,'owner','wrong','one-ip'),/incorrect/);
  await assert.rejects(verifyLogin(f.db,'owner',input.password,'one-ip'),/Too many/);
  const response=await manualAuthRoute(new Request('https://workspace.example/auth/login',{method:'POST',headers:{origin:'https://other.example','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'owner',password:input.password})}),f.db,{});
  assert.equal(response?.status,403);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) AS total FROM workspace_sessions').get() as {total:number}).total,0);
  const setup=await manualAuthRoute(new Request('https://workspace.example/setup'),f.db,{});
  assert.equal(setup?.status,303); assert.equal(setup?.headers.get('location'),'/login');
  f.sqlite.close();
});
