'use client';
import { browserStorage } from '../lib/browserStorage.ts';


import { useEffect } from 'react';
import { executeBrowserAction } from '@/lib/agent/browserExecutor';
import type { AgentAction, AgentSession } from '@/lib/agent/contracts';
import { getStoredGeminiApiKey } from '@/lib/clientApiKey';

export const AGENT_WAKE_EVENT = 'workstation-agent-wake';
export const AGENT_UPDATED_EVENT = 'workstation-agent-updated';

async function body<T>(response:Response):Promise<T>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status}).`);return data as T;}
function resumeId(actionId:string){return actionId.replace(/^[0-9a-f]/i,first=>((parseInt(first,16)+1)%16).toString(16));}
function workflowSettings(){try{const value=JSON.parse(browserStorage.getItem('workstation_agent_workflow_settings')||'{}');return value&&typeof value==='object'?value as Record<string,unknown>:{};}catch{return{};}}

/** One browser executor is mounted above workspace views, so navigation does not lose an in-flight action. */
export default function AgentBrowserBridge({ enabled }: { enabled:boolean }) {
 useEffect(()=>{
  if(!enabled)return;
  let stopped=false;
  let active=false;
  let pendingWake=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const headers=()=>({'Content-Type':'application/json','x-gemini-api-key':getStoredGeminiApiKey(),'x-agent-max-corrective-attempts':String(Math.max(0,Math.min(1,Number(workflowSettings().maxCorrectiveAttempts??1))))});
  const schedule=(delay:number)=>{if(stopped)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=undefined;void step();},delay);};
  const wake=()=>{if(stopped)return;if(active){pendingWake=true;return;}schedule(0);};
  const step=async()=>{
   if(stopped||active)return;
   const sessionId=browserStorage.getItem('workstation_agent_session_id');
   if(!sessionId)return;
   active=true;
   let keepPolling=false;
   try{
    const {session}=await body<{session:AgentSession}>(await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`,{cache:'no-store'}));
    const queued=session.actions.find(action=>action.location==='browser'&&(action.status==='queued'||(action.status==='running'&&(action.claimUntil||0)<Date.now())));
    keepPolling=session.status==='running'||session.status==='waiting-for-browser'||!!queued;
    if(queued){
     const claimResult=await body<{action:AgentAction|null}>(await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/actions/${encodeURIComponent(queued.id)}`,{method:'POST'}));
     const claimed=claimResult.action as (AgentAction&{claim?:string})|null;
     if(claimed?.claim){
      let status:'completed'|'failed'|'reconciliation-required'='completed';let output:Record<string,unknown>={};let error='';
      try{output=await executeBrowserAction(claimed as AgentAction&{claim:string},sessionId);}
      catch(caught){error=caught instanceof Error?caught.message:'Browser action failed.';status=caught instanceof TypeError&&/^design\./.test(claimed.name)?'reconciliation-required':'failed';}
      const configured=workflowSettings();
      const ack=await body<{resumeCommandId?:string}>(await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/actions/${encodeURIComponent(queued.id)}`,{method:'PUT',headers:headers(),body:JSON.stringify({claim:claimed.claim,status,output,error,pauseAfter:configured.autoContinueToLocalDraft===false})}));
      window.dispatchEvent(new Event(AGENT_UPDATED_EVENT));
      if(status==='completed'){
       const latest=await body<{session:AgentSession}>(await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`,{cache:'no-store'}));
       const workflow=workflowSettings();
       if(workflow.autoContinueToLocalDraft!==false&&latest.session.status!=='cancelled') await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/commands`,{method:'POST',headers:headers(),body:JSON.stringify({id:ack.resumeCommandId||resumeId(queued.id),kind:'run.continue'})});
      }
     }
    }else if(session.status==='running'&&session.messages.at(-1)?.role==='tool'){
     const last=[...session.actions].reverse().find(action=>action.location==='browser'&&action.status==='completed');
     if(last){const settings=workflowSettings();if(settings.autoContinueToLocalDraft!==false)await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/commands`,{method:'POST',headers:headers(),body:JSON.stringify({id:resumeId(last.id),kind:'run.continue'})});}
    }
   }catch{keepPolling=true;/* Retry if the local server briefly disconnects. */}
   finally{
    active=false;
    if(pendingWake){pendingWake=false;schedule(0);}
    else if(keepPolling)schedule(1500);
   }
  };
  window.addEventListener(AGENT_WAKE_EVENT,wake);
  window.addEventListener('focus',wake);
  window.addEventListener('storage',wake);
  void step();
  return()=>{stopped=true;if(timer)clearTimeout(timer);window.removeEventListener(AGENT_WAKE_EVENT,wake);window.removeEventListener('focus',wake);window.removeEventListener('storage',wake);};
 },[enabled]);
 return null;
}
