import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { claimBrowserAction, completeBrowserAction, createAgentSession, makeAction, readAgentSession, updateAgentSession } from '../src/lib/agent/store.ts';

async function fixture(){const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'workstation-agent-'));const session=await createAgentSession(cwd);return{cwd,session,cleanup:()=>fs.rm(cwd,{recursive:true,force:true})};}

test('serializes competing browser claims and rejects stale acknowledgements',async()=>{
 const f=await fixture();try{
  await updateAgentSession(f.session.id,s=>s.actions.push(makeAction('command','mockups.render',{productId:'p'},'browser')) ,f.cwd);
  const stored=await readAgentSession(f.session.id,f.cwd);const actionId=stored.actions[0].id;
  const [left,right]=await Promise.all([claimBrowserAction(f.session.id,actionId,f.cwd),claimBrowserAction(f.session.id,actionId,f.cwd)]);
  const winners=[left.result,right.result].filter(Boolean);assert.equal(winners.length,1);
  const first=winners[0]!;
  const retry=await claimBrowserAction(f.session.id,actionId,f.cwd,Date.now()+11*60_000);assert.ok(retry.result?.claim);
  await assert.rejects(completeBrowserAction(f.session.id,actionId,first.claim!,'completed',{ready:true},undefined,f.cwd),/claim expired/);
  await completeBrowserAction(f.session.id,actionId,retry.result!.claim!,'completed',{ready:true},undefined,f.cwd);
  assert.equal((await readAgentSession(f.session.id,f.cwd)).actions[0].status,'completed');
 }finally{await f.cleanup();}
});

test('turns an expired paid design action into reconciliation instead of retrying',async()=>{
 const f=await fixture();try{
  await updateAgentSession(f.session.id,s=>s.actions.push(makeAction('command','design.revise',{sourceUrl:'/api/agent/media/00000000-0000-4000-8000-000000000000'},'browser')),f.cwd);
  const action=(await readAgentSession(f.session.id,f.cwd)).actions[0];const claim=await claimBrowserAction(f.session.id,action.id,f.cwd);assert.ok(claim.result?.claim);
  const reclaimed=await claimBrowserAction(f.session.id,action.id,f.cwd,Date.now()+11*60_000);assert.equal(reclaimed.result,null);
  const session=await readAgentSession(f.session.id,f.cwd);assert.equal(session.actions[0].status,'reconciliation-required');assert.equal(session.status,'reconciliation-required');
 }finally{await f.cleanup();}
});

test('persists only artifact references and reloads the same session projection',async()=>{
 const f=await fixture();try{
  await updateAgentSession(f.session.id,s=>{s.messages.push({id:'m',role:'user',text:'Use this image.',at:new Date().toISOString(),attachments:[{name:'art.png',url:'/api/agent/media/00000000-0000-4000-8000-000000000000',mimeType:'image/png'}]});},f.cwd);
  const saved=await fs.readFile(path.join(f.cwd,'.workspace-data','agent',`${f.session.id}.json`),'utf8');
  assert.ok(saved.includes('/api/agent/media/'));assert.ok(!saved.includes('data:image/'));assert.ok(!saved.includes('AIza'));
  assert.equal((await readAgentSession(f.session.id,f.cwd)).messages[0].text,'Use this image.');
 }finally{await f.cleanup();}
});
