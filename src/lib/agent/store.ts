import fs from '../workspaceFs.ts';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentAction, AgentSession, AgentStatus } from './contracts.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const queues = new Map<string, Promise<unknown>>();
export class AgentStoreError extends Error { public status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function sessionPath(id: string, cwd: string) { if (!UUID.test(id)) throw new AgentStoreError('Invalid agent session ID.'); return path.join(cwd, '.workspace-data', 'agent', `${id}.json`); }
function serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const before = queues.get(key) ?? Promise.resolve();
  const task = before.catch(() => undefined).then(operation); queues.set(key, task);
  return task.finally(() => { if (queues.get(key) === task) queues.delete(key); });
}
export async function readAgentSession(id: string, cwd = process.cwd()): Promise<AgentSession> {
  try { const value = JSON.parse(await fs.readFile(sessionPath(id, cwd), 'utf8')) as AgentSession; if (value.schemaVersion !== 1 || value.id !== id) throw new AgentStoreError('Saved agent session is invalid.', 500); return value; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AgentStoreError('Agent session not found.', 404); throw error; }
}
async function writeSession(value: AgentSession, cwd: string) {
  const file = sessionPath(value.id, cwd); await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value), 'utf8'); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
export async function createAgentSession(cwd = process.cwd()): Promise<AgentSession> {
  const now = new Date().toISOString();
  const value: AgentSession = { schemaVersion: 1, id: randomUUID(), revision: 0, createdAt: now, updatedAt: now, status: 'idle', brief: {}, messages: [], actions: [], commandResults: {}, ledger: [], turnUsage: { calls: 0, actions: 0 } };
  await writeSession(value, cwd); return value;
}
export async function updateAgentSession<T>(id: string, change: (current: AgentSession) => T | Promise<T>, cwd = process.cwd()): Promise<{ session: AgentSession; result: T }> {
  return serialize(`${cwd}:${id}`, async () => {
    const current = await readAgentSession(id, cwd); const draft = structuredClone(current);
    const result = await change(draft); draft.revision = current.revision + 1; draft.updatedAt = new Date().toISOString();
    draft.messages = draft.messages.slice(-100); draft.ledger = draft.ledger.slice(-250); draft.actions = draft.actions.slice(-100);
    if (JSON.stringify(draft).length > 5_000_000) throw new AgentStoreError('Agent session exceeded its storage limit.', 413);
    await writeSession(draft, cwd); return { session: draft, result };
  });
}
export async function claimBrowserAction(id: string, actionId: string, cwd = process.cwd(), now = Date.now()) {
  return updateAgentSession(id, session => {
    const action = session.actions.find(item => item.id === actionId);
    if (!action || action.location !== 'browser') throw new AgentStoreError('Browser action not found.', 404);
    if (action.status === 'completed') return null;
    if (action.status === 'running' && (action.claimUntil ?? 0) > now) return null;
    if (action.status === 'running' && /^design\./.test(action.name)) { action.status = 'reconciliation-required'; action.error = 'The image request lost its acknowledgement. Check saved artwork before starting another paid request.'; setAgentStatus(session, 'reconciliation-required', action.error); return null; }
    if (!['queued', 'running'].includes(action.status)) throw new AgentStoreError('Browser action is no longer available.', 409);
    action.status = 'running'; action.attempt += 1; action.claim = randomUUID(); action.claimUntil = now + 10 * 60_000; action.updatedAt = new Date(now).toISOString();
    return structuredClone(action);
  }, cwd);
}
export async function completeBrowserAction(id: string, actionId: string, claim: string, status: 'completed' | 'failed' | 'reconciliation-required', output: Record<string, unknown> = {}, error?: string, cwd = process.cwd()) {
  return updateAgentSession(id, session => {
    const action = session.actions.find(item => item.id === actionId);
    if (!action || action.location !== 'browser') throw new AgentStoreError('Browser action not found.', 404);
    if (action.status === 'completed') return structuredClone(action);
    if (action.status !== 'running' || action.claim !== claim) throw new AgentStoreError('Browser action claim expired or was replaced.', 409);
    action.status = status; action.output = status === 'completed' ? output : undefined; action.error = error?.slice(0, 1000); delete action.claim; delete action.claimUntil; action.updatedAt = new Date().toISOString();
    if (status === 'completed' && session.status !== 'cancelled') session.status = 'running';
    else session.status = status;
    if (status === 'completed' && !action.silent) session.messages.push({ id: randomUUID(), role: 'tool', text: JSON.stringify(output).slice(0, 4000), at: new Date().toISOString(), toolName: action.name, actionId: action.id, ...(action.modelCallId ? { callId: action.modelCallId } : {}) });
    return structuredClone(action);
  }, cwd);
}
export function setAgentStatus(session: AgentSession, status: AgentStatus, detail?: string) {
  session.status = status; session.ledger.push({ id: randomUUID(), status, at: new Date().toISOString(), ...(detail ? { detail: detail.slice(0, 240) } : {}) });
}
export function makeAction(commandId: string, name: string, inputs: Record<string, unknown>, location: AgentAction['location'], id: string = randomUUID(), modelCallId?: string): AgentAction {
  const signature = JSON.stringify([name, inputs]); const now = new Date().toISOString();
  return { id, commandId, name, inputs: structuredClone(inputs), signature, location, status: 'queued', attempt: 0, ...(modelCallId ? { modelCallId } : {}), createdAt: now, updatedAt: now };
}

