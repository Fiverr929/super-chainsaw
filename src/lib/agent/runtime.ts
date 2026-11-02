import { randomUUID } from 'node:crypto';
import { resolveGeminiApiKey } from '../geminiApi.ts';
import type { AgentCommand, AgentMessage, AgentProvider, AgentSession } from './contracts.ts';
import { describeModelError, geminiContents, makeGeminiAgentProvider } from './provider.ts';
import { dispatchAgentTool, enqueueBrowserTool, AGENT_SYSTEM_PROMPT, AGENT_TOOLS, validateToolArgs } from './tools.ts';
import { makeAction, readAgentSession, setAgentStatus, updateAgentSession } from './store.ts';
import { readProduct, saveProduct } from '../workspaceProductStore.ts';
import { readListingSheetSnapshot } from '../workspaceListingStore.ts';
import { updatePhysicalEtsyDraft } from '../workspaceListingOperations.ts';
import { generateListingMetadata } from '../generateListingMetadata.ts';
import { createWorkspaceProduct, type MockupPreset } from '../workspaceProducts.ts';

const MAX_CALLS = 8;
const MAX_ACTIONS = 12;
const MAX_TEXT = 12000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_LIST = ['title','description','tags','alt_text','primary_color','secondary_color','materials','sleeve_length','neckline','clothing_style','occasion','celebration','subject','graphic'];

export class AgentRuntimeError extends Error { public status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function message(role: AgentMessage['role'], text: string, extra: Partial<AgentMessage> = {}): AgentMessage { return { id: randomUUID(), role, text: text.slice(0, MAX_TEXT), at: new Date().toISOString(), ...extra }; }
function clientStatus(session: AgentSession) { return { id: session.id, sessionId: session.id, revision: session.revision, status: session.status, brief: session.brief, messages: session.messages, actions: session.actions, ledger: session.ledger, turnUsage: session.turnUsage }; }
function assertCommand(command: AgentCommand) {
  if (!command || !ID.test(command.id) || !['message.send','selection.set','run.continue','run.cancel','action.retry'].includes(command.kind)) throw new AgentRuntimeError('Invalid agent command.');
  if (command.kind === 'message.send' && (typeof command.text !== 'string' || !command.text.trim() || command.text.length > 4000)) throw new AgentRuntimeError('Enter a message between 1 and 4000 characters.');
}

export async function runAgentCommand(input: { sessionId: string; command: AgentCommand; request: Request; provider?: AgentProvider; cwd?: string }) {
  const { sessionId, command, request, cwd } = input; assertCommand(command);
  const before = await readAgentSession(sessionId, cwd);
  if (before.commandResults[command.id]) return { ...clientStatus(before), replay: true, commandResult: before.commandResults[command.id] };
  if (command.kind === 'selection.set') {
    const mockupPresetId=command.selection?.mockupPresetId;const listingPresetId=command.selection?.listingPresetId;
    const args=validateToolArgs('preset.select',{mockupPresetId,listingPresetId});
    const admitted=await updateAgentSession(sessionId,session=>{
      if(session.commandResults[command.id])return false;
      const action=makeAction(command.id,'preset.select',args,'browser',command.id);action.silent=true;session.actions.push(action);setAgentStatus(session,'waiting-for-browser','Saving selected presets.');session.commandResults[command.id]={status:'waiting-for-browser'};return true;
    },cwd);
    return {...clientStatus(admitted.session),...(admitted.result?{}:{replay:true})};
  }
  if (command.kind === 'message.send') {
    const admitted = await updateAgentSession(sessionId, session => {
      if (session.commandResults[command.id]) return false;
      const attachments = Array.isArray(command.attachments) ? command.attachments.slice(0, 2).filter(item => typeof item.url === 'string' && /^\/api\/agent\/media\/[0-9a-f-]{36}$/i.test(item.url) && typeof item.name === 'string' && ['image/jpeg','image/png','image/webp'].includes(item.mimeType)).map(item => ({ name: item.name.slice(0,160), url: item.url, mimeType: item.mimeType })) : [];
      session.messages.push(message('user', command.text!.trim(), { ...(attachments.length ? { attachments } : {}) })); session.turnUsage = { calls: 0, actions: 0 };
      session.commandResults[command.id] = { status: 'running' }; setAgentStatus(session, 'running', 'Message received.'); return true;
    }, cwd);
    if (!admitted.result) return { ...clientStatus(admitted.session), replay: true, commandResult: admitted.session.commandResults[command.id] };
  } else if (command.kind === 'run.cancel') {
    const result = await updateAgentSession(sessionId, session => {
      for (const action of session.actions) if (action.status === 'queued') action.status = 'cancelled';
      setAgentStatus(session, 'cancelled', 'Stopped before the next action.');
      session.commandResults[command.id] = { status: 'cancelled' };
    }, cwd);
    return clientStatus(result.session);
  } else if (command.kind === 'action.retry') {
    const result = await updateAgentSession(sessionId, session => {
      const action = session.actions.find(item => item.id === command.actionId);
      if (!action || !['failed','cancelled'].includes(action.status) || action.location !== 'browser') throw new AgentRuntimeError('Only a known failed browser action can be retried.');
      const requestedLimit=Number(request.headers.get('x-agent-max-corrective-attempts')||'1');const retryLimit=Number.isFinite(requestedLimit)?Math.max(0,Math.min(1,requestedLimit)):1;
      if(action.attempt>=1+retryLimit)throw new AgentRuntimeError('The configured retry limit for this action has been reached.');
      action.status = 'queued'; action.error = undefined; action.claim = undefined; action.claimUntil = undefined; action.updatedAt = new Date().toISOString();
      session.status = 'waiting-for-browser'; session.commandResults[command.id] = { status: 'waiting-for-browser' };
    }, cwd);
    return clientStatus(result.session);
  } else {
    const result = await updateAgentSession(sessionId, session => {
      if (session.commandResults[command.id]) return false;
      for (const action of session.actions) if (action.status === 'completed' && !action.silent) {
        const responseText = JSON.stringify(action.output ?? { completed: true }).slice(0, 4000);
        if (!session.messages.some(item => item.role === 'tool' && item.actionId === action.id)) session.messages.push(message('tool', responseText, { toolName: action.name, actionId: action.id, ...(action.modelCallId ? { callId: action.modelCallId } : {}) }));
      }
      session.status = 'running';
      session.commandResults[command.id] = { status: 'running' };
      return true;
    }, cwd);
    if (!result.result) return { ...clientStatus(result.session), replay: true, commandResult: result.session.commandResults[command.id] };
    if (result.session.status === 'waiting-for-browser') return clientStatus(result.session);
  }

  const apiKey = resolveGeminiApiKey(request);
  if (!apiKey) {
    const { session } = await updateAgentSession(sessionId, current => {
      current.messages.push(message('assistant', 'Add a Google AI Studio API key in Settings before using the Agent.'));
      setAgentStatus(current, 'failed', 'Missing model key.'); current.commandResults[command.id] = { status: 'failed', message: 'Missing model key.' };
    }, cwd);
    return clientStatus(session);
  }
  const provider = input.provider ?? makeGeminiAgentProvider();
  let finalText = '';
  for (let turn = 0; turn < MAX_CALLS; turn++) {
    const session = await readAgentSession(sessionId, cwd);
    if (session.status === 'cancelled') break;
    if (session.turnUsage.calls >= MAX_CALLS || session.turnUsage.actions >= MAX_ACTIONS) {
      finalText = 'I reached the safe action limit for this turn. Your saved work is ready; send “continue” to resume.'; break;
    }
    let output;
    try {
      output = await provider.generate({ apiKey, system: `${AGENT_SYSTEM_PROMPT}\n\nConfirmed session state (source of truth): ${JSON.stringify(compactBrief(session))}`, contents: await geminiContents(session.messages.slice(-40), cwd), tools: AGENT_TOOLS });
    } catch (error) {
      const detail = describeModelError(error);
      const { session: failed } = await updateAgentSession(sessionId, current => {
        current.messages.push(message('assistant', `I couldn’t continue because the model request failed: ${detail}`));
        setAgentStatus(current, 'failed', detail); current.commandResults[command.id] = { status: 'failed', message: detail };
      }, cwd);
      return clientStatus(failed);
    }
    if ((await readAgentSession(sessionId, cwd)).status === 'cancelled') return clientStatus(await readAgentSession(sessionId, cwd));
    await updateAgentSession(sessionId, current => { current.turnUsage.calls += 1; }, cwd);
    const allCalls = output.parts.filter(part => part.functionCall);
    const calls = allCalls.slice(0, 1);
    const visibleText = output.parts.map(part => part.text).filter((value): value is string => Boolean(value)).join('\n').slice(0, MAX_TEXT);
    const assistantParts = (allCalls.length > 1 ? output.parts.filter(part => part.text || part === calls[0]) : output.parts).map(part => part.functionCall ? { ...part, functionCall: { ...part.functionCall, args: part.functionCall.args || {} } } : part);
    if (!calls.length) { finalText = visibleText || 'I’m ready to help with the selected listing.'; break; }
    await updateAgentSession(sessionId, current => {
      current.messages.push(message('assistant', '', { parts: assistantParts }));
    }, cwd);
    for (const call of calls) {
      if ((await readAgentSession(sessionId, cwd)).status === 'cancelled') return clientStatus(await readAgentSession(sessionId, cwd));
      const name = call.functionCall!.name;
      let args: Record<string, unknown>;
      try { args = validateToolArgs(name, call.functionCall!.args || {}); }
      catch (error) {
        const detail = describeModelError(error);
        await updateAgentSession(sessionId, current => current.messages.push(message('tool', JSON.stringify({ error: detail }), { toolName: name, ...(call.functionCall!.id ? { callId: call.functionCall!.id } : {}) })), cwd);
        continue;
      }
      const fresh = await readAgentSession(sessionId, cwd);
      if (fresh.turnUsage.actions >= MAX_ACTIONS) { finalText = 'I reached the safe action limit. Send “continue” to resume.'; break; }
      await updateAgentSession(sessionId, current => { current.turnUsage.actions += 1; }, cwd);
      const commandId = command.id;
      const action = makeAction(commandId, name, args, AGENT_TOOLS.find(item => item.name === name)!.location, randomUUID(), call.functionCall!.id);
      if (action.location === 'browser') {
        const pending = await enqueueBrowserTool(sessionId, commandId, name, args, action.id, action.modelCallId, cwd);
        await updateAgentSession(sessionId, current => { current.commandResults[command.id] = { status: 'waiting-for-browser' }; }, cwd);
        return clientStatus(pending.session);
      }
      await updateAgentSession(sessionId, current => { current.actions.push(action); setAgentStatus(current, 'running', `${name} is running.`); }, cwd);
      try {
        const context = {
          session: await readAgentSession(sessionId, cwd), request, apiKey, cwd,
          dispatch: async () => { throw new AgentRuntimeError('This tool cannot dispatch another tool directly.'); },
        };
        let result: Record<string, unknown>;
        if (name === 'listing.generate') result = await runMetadataGeneration(args, context);
        else if (name === 'brief.update') result = await updateBrief(args, sessionId, cwd);
        else if (name === 'etsy.inspiration.fetch' || name === 'listing.prepare' || name === 'workspace.inspect' || name === 'product.inspect' || name === 'worksheet.inspect' || name === 'listing.validate' || name === 'listing.revise') result = await dispatchAgentTool(context, action);
        else if (name === 'product.create') result = await createAgentProduct(args, context);
        else throw new AgentRuntimeError(`Tool ${name} is not executable.`);
        await updateAgentSession(sessionId, current => {
          const stored = current.actions.find(item => item.id === action.id); if (stored) { stored.status = 'completed'; stored.output = safeToolResult(result); stored.updatedAt = new Date().toISOString(); }
          current.messages.push(message('tool', JSON.stringify(safeToolResult(result)), { toolName: name, actionId: action.id, ...(action.modelCallId ? { callId: action.modelCallId } : {}) }));
        }, cwd);
      } catch (error) {
        const detail = describeModelError(error);
        await updateAgentSession(sessionId, current => {
          const stored = current.actions.find(item => item.id === action.id); if (stored) { stored.status = 'failed'; stored.error = detail; }
          current.messages.push(message('tool', JSON.stringify({ error: detail }), { toolName: name, actionId: action.id, ...(action.modelCallId ? { callId: action.modelCallId } : {}) }));
        }, cwd);
      }
    }
    if (finalText) break;
  }
  if (!finalText && !outputHasAnswer(await readAgentSession(sessionId, cwd))) finalText = 'I paused at the safe step limit. Your saved progress is ready; send “continue” to resume.';
  const { session: done } = await updateAgentSession(sessionId, current => {
    if (finalText) current.messages.push(message('assistant', finalText));
    setAgentStatus(current, finalText?.includes('?') ? 'waiting-for-user' : 'idle'); current.commandResults[command.id] = { status: current.status };
  }, cwd);
  return clientStatus(done);
}

function outputHasAnswer(session: AgentSession) { return session.messages.at(-1)?.role === 'assistant' && Boolean(session.messages.at(-1)?.text); }
function compactBrief(session: AgentSession) {
  const preset = session.brief.selectedMockupPreset as {id?:string;name?:string;productType?:string;color?:string;frames?:Array<{id?:string;role?:string;applyDesign?:boolean}>}|undefined;
  const listing = session.brief.selectedListingPreset;
  return { ...session.brief, selectedMockupPreset: preset ? { id:preset.id,name:preset.name,productType:preset.productType,color:preset.color,frames:preset.frames?.map(frame=>({id:frame.id,role:frame.role,applyDesign:frame.applyDesign})) } : undefined, selectedListingPreset: listing ? {id:listing.id,name:listing.name,category:listing.category} : undefined };
}
function safeToolResult(value: Record<string, unknown>): Record<string, unknown> { return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'string' && item.length > 8000 ? `${item.slice(0, 100)}…(truncated)` : item)); }

async function updateBrief(args: Record<string, unknown>, sessionId: string, cwd?: string) {
  const { session } = await updateAgentSession(sessionId, current => {
    for (const [key, value] of Object.entries(args)) if (typeof value === 'string' && value.trim()) current.brief[key === 'purpose' ? 'productPurpose' : key as keyof typeof current.brief] = value.trim().slice(0, 1000) as never;
  }, cwd);
  return { brief: session.brief, saved: true };
}

async function createAgentProduct(args: Record<string, unknown>, context: { session: AgentSession; cwd?: string }) {
  const id = randomUUID();
  const design = typeof args.designDataUrl === 'string' ? args.designDataUrl : '';
  const preset = structuredClone(context.session.brief.selectedMockupPreset || {}) as Record<string, unknown>;
  if (!preset || typeof preset !== 'object' || typeof args.name !== 'string') throw new AgentRuntimeError('Product configuration is incomplete.');
  if (!ID.test(id)) throw new AgentRuntimeError('Invalid product ID.');
  if (!['/api/agent/media/','/workspace-products/','/workspace-assets/etsy/'].some(prefix => design.startsWith(prefix))) throw new AgentRuntimeError('Choose artwork saved inside this workstation.');
  const { readAgentMediaDataUrl } = await import('./mediaStore.ts');
  const designDataUrl = await readAgentMediaDataUrl(design, context.cwd);
  const frames = Array.isArray(preset.frames) ? await Promise.all(preset.frames.map(async (value: unknown) => {
    const frame = structuredClone(value) as Record<string, unknown>; const image = frame.imageDataUrl;
    if (typeof image === 'string' && ['/api/agent/media/','/workspace-products/','/workspace-assets/etsy/'].some(prefix => image.startsWith(prefix))) frame.imageDataUrl = await readAgentMediaDataUrl(image, context.cwd);
    return frame;
  })) : [];
  const created = await saveProduct(createWorkspaceProduct({id,name:args.name.slice(0,200),designDataUrl,preset:{...preset,frames} as MockupPreset,designKind:'upload'}), context.cwd);
  await updateAgentSession(context.session.id, current => { current.brief.productId = created.id; current.brief.productRevision = created.revision; }, context.cwd);
  return { id: created.id, revision: created.revision, name: created.name, renderState: created.renderState, designUrl: created.designDataUrl, nextStep: 'Call mockups.render with this productId.' };
}

async function runMetadataGeneration(args: Record<string, unknown>, context: { session: AgentSession; apiKey?: string; model?: string; request: Request; cwd?: string }) {
  const listingId = typeof args.listingId === 'string' ? args.listingId : context.session.brief.listingId;
  if (typeof listingId !== 'string') throw new AgentRuntimeError('Prepare a product listing first.');
  const sheet = await readListingSheetSnapshot('etsy-physical', context.cwd);
  if (!sheet) throw new AgentRuntimeError('The Etsy physical worksheet has no saved listings.');
  const row = sheet.rows.find(value => value.local_listing_id === listingId);
  if (!row) throw new AgentRuntimeError('The selected listing was removed. Inspect the worksheet again.');
  if (row.status === 'Published' || row.listing_id) throw new AgentRuntimeError('This listing already has a remote Etsy ID. Use its revision controls in the Etsy worksheet.');
  if (typeof row.workspace_product_id !== 'string') throw new AgentRuntimeError('The local draft has no linked saved product.');
  const product = await readProduct(row.workspace_product_id, context.cwd);
  const requestedFields = Array.isArray(args.fields) ? args.fields.filter((field): field is string => typeof field === 'string' && FIELD_LIST.includes(field)) : ['title','description','tags','primary_color','secondary_color','materials'];
  if (!requestedFields.length || requestedFields.length > 12) throw new AgentRuntimeError('Select valid fields to generate.');
  const data = await generateListingMetadata(new Request('http://workstation.local/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': context.apiKey || '' }, body: JSON.stringify({ context: [row.context, context.session.brief.productPurpose, context.session.brief.audience, context.session.brief.copyDirection, `Product: ${product.name}; type: ${product.preset.productType}; color: ${product.preset.color}.`].filter(Boolean).join('\n'), imagePaths: typeof row.images === 'string' ? row.images.split(',').map(value => value.trim()).filter(Boolean).slice(0,10) : [], existingData: row, aiRules: { description: context.session.brief.copyDirection || '' }, forceRegenerate: requestedFields, model: context.model }) }));
  const output = await data.json();
  if (!data.ok || output.error) throw new AgentRuntimeError(typeof output.error === 'string' ? output.error : 'Metadata generation failed.', data.status);
  const changes: Record<string, unknown> = {};
  for (const field of requestedFields) if (output[field] !== undefined) changes[field] = output[field] === '' && ['primary_color','secondary_color','materials'].includes(field) ? 'None' : output[field];
  if (Array.isArray(output.alt_texts)) changes.alt_text = output.alt_texts.join(' | ');
  if (!Object.keys(changes).length) throw new AgentRuntimeError('The model did not return any listing fields.');
  return await updatePhysicalEtsyDraft(listingId, sheet.revision, changes, context.cwd);
}
