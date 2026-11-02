import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgentSession, readAgentSession, setAgentStatus, updateAgentSession } from '../src/lib/agent/store.ts';
import { runAgentCommand } from '../src/lib/agent/runtime.ts';
import type { AgentProvider } from '../src/lib/agent/contracts.ts';

async function fixture(){const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'agent-runtime-'));const session=await createAgentSession(cwd);return{cwd,session,cleanup:()=>fs.rm(cwd,{recursive:true,force:true})};}
const request=()=>new Request('http://workstation.local/api/agent',{headers:{'x-gemini-api-key':'AIza-test-secret'}});

test('duplicate stable command IDs replay the saved result without another model dispatch',async()=>{
 const f=await fixture();try{let calls=0;const provider:AgentProvider={async generate(){calls++;return{parts:[{text:'I can help with that listing.'}]};}};const command={id:'10000000-0000-4000-8000-000000000001',kind:'message.send' as const,text:'Help me prepare a listing.'};const first=await runAgentCommand({sessionId:f.session.id,command,request:request(),provider,cwd:f.cwd});const second=await runAgentCommand({sessionId:f.session.id,command,request:request(),provider,cwd:f.cwd});assert.equal(calls,1);assert.ok('replay' in second&&second.replay);assert.equal(first.status,'idle');assert.equal((await readAgentSession(f.session.id,f.cwd)).messages.filter(item=>item.role==='user').length,1);}finally{await f.cleanup();}
});

test('does not show a tool-call preamble and its repeated final answer twice',async()=>{
 const f=await fixture();try{let calls=0;const provider:AgentProvider={async generate(){calls++;return calls===1?{parts:[{text:'I’ll check the saved inspiration first.'},{functionCall:{name:'workspace.inspect',id:'inspect-reference',args:{query:'4525717891'}}}]}:{parts:[{text:'That Etsy listing is not imported yet. Use Flat Earth to import it, then I can inspect it.'}]};}};const result=await runAgentCommand({sessionId:f.session.id,command:{id:'10000000-0000-4000-8000-000000000007',kind:'message.send',text:'Copy this listing https://www.etsy.com/listing/4525717891/example'},request:request(),provider,cwd:f.cwd});const visibleAnswers=result.messages.filter(message=>message.role==='assistant'&&message.text).map(message=>message.text);assert.equal(calls,2);assert.equal(visibleAnswers.length,1);assert.match(visibleAnswers[0],/not imported yet/);}finally{await f.cleanup();}
});

test('rejects invalid model tools without dispatching and keeps credentials and image bytes out of the session',async()=>{
 const f=await fixture();try{let calls=0;const provider:AgentProvider={async generate(){calls++;return calls===1?{parts:[{functionCall:{name:'product.create',id:'call-one',args:{preset:{}}}}]}:{parts:[{text:'Please choose an artwork and preset first.'}]};}};await runAgentCommand({sessionId:f.session.id,command:{id:'10000000-0000-4000-8000-000000000002',kind:'message.send',text:'Use this attached image.',attachments:[{name:'shirt.png',url:'/api/agent/media/00000000-0000-4000-8000-000000000000',mimeType:'image/png'}]},request:request(),provider,cwd:f.cwd});const raw=await fs.readFile(path.join(f.cwd,'.workspace-data','agent',`${f.session.id}.json`),'utf8');const saved=JSON.parse(raw);assert.equal(saved.actions.length,0);assert.equal(saved.messages.find((item:{role:string})=>item.role==='user').attachments[0].mimeType,'image/png');assert.ok(!raw.includes('AIza-test-secret'));assert.ok(!raw.includes('data:image/'));assert.ok(calls<=2);}finally{await f.cleanup();}
});

test('cancellation observed during a model request prevents the proposed next action',async()=>{
 const f=await fixture();try{const provider:AgentProvider={async generate(){await updateAgentSession(f.session.id,session=>setAgentStatus(session,'cancelled','User stopped the run.'),f.cwd);return{parts:[{functionCall:{name:'workspace.inspect',id:'call-cancel',args:{}}}]};}};const result=await runAgentCommand({sessionId:f.session.id,command:{id:'10000000-0000-4000-8000-000000000003',kind:'message.send',text:'Inspect my listings.'},request:request(),provider,cwd:f.cwd});assert.equal(result.status,'cancelled');assert.equal((await readAgentSession(f.session.id,f.cwd)).actions.length,0);}finally{await f.cleanup();}
});

test('bounds a model that keeps proposing valid actions',async()=>{
 const f=await fixture();try{let calls=0;const provider:AgentProvider={async generate(){calls++;return{parts:[{functionCall:{name:'brief.update',id:`call-${calls}`,args:{purpose:'A simple shirt listing.'}}}]};}};const result=await runAgentCommand({sessionId:f.session.id,command:{id:'10000000-0000-4000-8000-000000000004',kind:'message.send',text:'Prepare my listing.'},request:request(),provider,cwd:f.cwd});const saved=await readAgentSession(f.session.id,f.cwd);assert.equal(calls,8);assert.equal(saved.turnUsage.calls,8);assert.ok(saved.turnUsage.actions<=12);const last=result.messages.at(-1);assert.ok(last);assert.match(last.text,/safe step limit|safe action limit/i);}finally{await f.cleanup();}
});

test('reports missing credentials and provider failures without losing the user message',async()=>{
 const f=await fixture();try{
  let calls=0;const command={id:'10000000-0000-4000-8000-000000000005',kind:'message.send' as const,text:'Prepare my listing.'};const missing=await runAgentCommand({sessionId:f.session.id,command,request:new Request('http://workstation.local/api/agent'),provider:{async generate(){calls++;return{parts:[{text:'unexpected'}]};}},cwd:f.cwd});assert.equal(calls,0);assert.equal(missing.status,'failed');const missingNotice=missing.messages.at(-1);assert.ok(missingNotice);assert.match(missingNotice.text,/API key/i);
  const other=await createAgentSession(f.cwd);const failed=await runAgentCommand({sessionId:other.id,command:{...command,id:'10000000-0000-4000-8000-000000000006'},request:request(),provider:{async generate(){throw new Error('temporary provider outage');}},cwd:f.cwd});assert.equal(failed.status,'failed');const failureNotice=failed.messages.at(-1);assert.ok(failureNotice);assert.match(failureNotice.text,/temporary provider outage/);assert.equal((await readAgentSession(other.id,f.cwd)).messages.find(item=>item.role==='user')?.text,command.text);
 }finally{await f.cleanup();}
});
