import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCloudWorkspaceFs, type CloudDatabase, CloudStorageConflict } from '../src/lib/cloudWorkspaceFs.ts';
import { withWorkspaceStorage } from '../src/lib/workspaceFs.ts';
import { createAgentSession, readAgentSession, updateAgentSession } from '../src/lib/agent/store.ts';
import { readListingSheetSnapshot, writeListingSheet } from '../src/lib/workspaceListingStore.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(path.join(process.cwd(),'drizzle','0000_busy_night_thrasher.sql'),'utf8'));
  const db = {
    prepare(sql: string) {
      return { bind(...values: unknown[]) {
        const parameters = values as (string | number | null)[];
        return {
          async first() { return sqlite.prepare(sql).get(...parameters) ?? null; },
          async all() { return { results: sqlite.prepare(sql).all(...parameters) }; },
          async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...parameters).changes) } }; },
        };
      } };
    },
    async batch(statements: { run(): Promise<{meta:{changes:number}}> }[]) {
      sqlite.exec('BEGIN');
      try { const results=[]; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch(error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as CloudDatabase;
  const objects = new Map<string, Uint8Array>();
  const bucket = {
    async put(key: string, bytes: Uint8Array) { objects.set(key,Uint8Array.from(bytes)); },
    async get(key: string) { const bytes=objects.get(key); return bytes ? { async arrayBuffer() { return Uint8Array.from(bytes).buffer; } } : null; },
    async delete(keys: string | string[]) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
  };
  return { db,bucket,objects,sqlite, storage:(user='alice') => createCloudWorkspaceFs(db,bucket,user) };
}
const file = (name: string) => path.join(process.cwd(),name);

test('cloud records survive new request contexts and never leak across users',async () => {
  const f=fixture(), alice=f.storage(), bob=f.storage('bob');
  const name=file('.workspace-data/products/example.json');
  await alice.mkdir(path.dirname(name),{recursive:true});
  await alice.writeFile(name,JSON.stringify({name:'Private draft'}));
  assert.equal(f.objects.size,0,'JSON belongs in D1');
  assert.deepEqual(JSON.parse(await f.storage().readFile(name,'utf8')),{name:'Private draft'});
  await assert.rejects(bob.readFile(name),{code:'ENOENT'});
  await assert.rejects(alice.readFile(path.join(process.cwd(),'..','tokens.json')),{code:'EACCES'});
  f.sqlite.close();
});

test('cloud atomic record replacement rejects competing writes without deleting the winner',async () => {
  const f=fixture(), name=file('.workspace-data/products/conflict.json');
  await f.storage().writeFile(name,'original');
  const a=f.storage(), b=f.storage();
  await a.readFile(name); await b.readFile(name);
  await a.writeFile(name+'.a.tmp','winner'); await b.writeFile(name+'.b.tmp','stale');
  await a.rename(name+'.a.tmp',name);
  await assert.rejects(b.rename(name+'.b.tmp',name),CloudStorageConflict);
  assert.equal(await f.storage().readFile(name,'utf8'),'winner');
  assert.equal(await b.readFile(name+'.b.tmp','utf8'),'stale');
  f.sqlite.close();
});

test('cloud media uses R2 and folder exports, backups, and deletions preserve bytes',async () => {
  const f=fixture(), storage=f.storage();
  const source=file('public/workspace-products/one'), stage=file('public/listings-physical/.stage');
  const target=file('public/listings-physical/product-one');
  await storage.mkdir(source,{recursive:true});
  await storage.writeFile(path.join(source,'art.png'),Buffer.from([1,2,3]),{flag:'wx'});
  await assert.rejects(storage.writeFile(path.join(source,'art.png'),'replace',{flag:'wx'}),{code:'EEXIST'});
  await storage.cp(source,stage,{recursive:true});
  await storage.writeFile(path.join(stage,'manifest.json'),'{}');
  await storage.rename(stage,target);
  assert.deepEqual(await storage.readFile(path.join(target,'art.png')),Buffer.from([1,2,3]));
  assert.equal(await storage.readFile(path.join(target,'manifest.json'),'utf8'),'{}');
  assert.equal(f.objects.size,2);
  await storage.rm(target,{recursive:true});
  assert.equal(f.objects.size,1);
  assert.deepEqual(await storage.readFile(path.join(source,'art.png')),Buffer.from([1,2,3]));
  await assert.rejects(storage.readFile(path.join(stage,'manifest.json')),{code:'ENOENT'});
  f.sqlite.close();
});

test('stale cloud writes cannot resurrect deleted records or delete a newer revision',async () => {
  const f=fixture(), name=file('.workspace-data/products/deleted.json');
  await f.storage().writeFile(name,'original');
  const stale=f.storage(); await stale.readFile(name);
  await f.storage().writeFile(name,'newer');
  await assert.rejects(stale.unlink(name),CloudStorageConflict);
  assert.equal(await f.storage().readFile(name,'utf8'),'newer');
  const beforeDelete=f.storage(); await beforeDelete.readFile(name);
  await f.storage().unlink(name);
  await beforeDelete.writeFile(name+'.tmp','resurrected');
  await assert.rejects(beforeDelete.rename(name+'.tmp',name),CloudStorageConflict);
  await assert.rejects(f.storage().readFile(name),{code:'ENOENT'});
  f.sqlite.close();
});

test('existing agent and worksheet stores persist and retain revision checks in cloud storage',async () => {
  const f=fixture();
  const run=<T>(operation:()=>T) => withWorkspaceStorage({fs:f.storage(),userId:'alice'},operation);
  const session=await run(()=>createAgentSession());
  await run(()=>updateAgentSession(session.id,draft=>{draft.brief={productId:randomUUID()};}));
  assert.equal((await run(()=>readAgentSession(session.id))).revision,1);
  const revision=await run(()=>writeListingSheet('etsy-physical',[{title:'Saved cloud listing'}],undefined,'0'));
  assert.equal((await run(()=>readListingSheetSnapshot('etsy-physical')))?.revision,revision);
  await assert.rejects(run(()=>writeListingSheet('etsy-physical',[],undefined,'0')),/another window/);
  f.sqlite.close();
});
