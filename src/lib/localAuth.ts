import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { CloudDatabase } from './cloudWorkspaceFs.ts';
import { tokenHash } from './manualAuth.ts';

/** Local auth uses SQLite only; local products and media remain on disk. */
export async function localAuth(cwd=process.cwd()) {
  const directory=path.join(cwd,'.workspace-data','auth');
  fs.mkdirSync(directory,{recursive:true});
  const sqlite=new DatabaseSync(path.join(directory,'account.sqlite'));
  sqlite.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_account'").get()) {
    sqlite.exec('BEGIN;'+fs.readFileSync(path.join(cwd,'drizzle','0001_perpetual_rogue.sql'),'utf8').replaceAll('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ')+'COMMIT;');
  }
  const db={prepare(sql:string){return{bind(...values:unknown[]){const args=values as (string|number|null)[];return{
    async first(){return sqlite.prepare(sql).get(...args)??null;},
    async all(){return{results:sqlite.prepare(sql).all(...args)};},
    async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},
  };}};}} as unknown as CloudDatabase;
  const setupFile=path.join(directory,'setup.json');
  let setup:{token:string;expires:string};
  try { setup=JSON.parse(fs.readFileSync(setupFile,'utf8')); }
  catch { setup={token:randomBytes(32).toString('hex'),expires:new Date(Date.now()+24*60*60*1000).toISOString()};fs.writeFileSync(setupFile,JSON.stringify(setup),{mode:0o600}); }
  if(Date.parse(setup.expires)<=Date.now() && !sqlite.prepare('SELECT id FROM workspace_account WHERE id=1').get()) {
    setup={token:randomBytes(32).toString('hex'),expires:new Date(Date.now()+24*60*60*1000).toISOString()};fs.writeFileSync(setupFile,JSON.stringify(setup),{mode:0o600});
  }
  return {db,config:{setupTokenHash:await tokenHash(setup.token),setupExpiresAt:setup.expires,localSetupToken:setup.token},close:()=>sqlite.close()};
}
