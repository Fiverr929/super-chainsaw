export type AgentStatus = 'idle' | 'running' | 'waiting-for-user' | 'waiting-for-browser' | 'completed' | 'failed' | 'cancelled' | 'reconciliation-required';
export type ActionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'reconciliation-required';
export type AgentMessage = { id: string; role: 'user' | 'assistant' | 'tool'; text: string; at: string; toolName?: string; callId?: string; actionId?: string; parts?: AgentModelPart[]; attachments?: AgentAttachment[] };
export type AgentAttachment = { name: string; url: string; mimeType: string };
export type AgentUserMessage = AgentMessage & { attachments?: AgentAttachment[] };
export type AgentAction = {
  id: string; commandId: string; name: string; inputs: Record<string, unknown>; signature: string;
  location: 'server' | 'browser'; status: ActionStatus; attempt: number; claim?: string; claimUntil?: number;
  output?: Record<string, unknown>; error?: string; silent?: boolean; modelCallId?: string; createdAt: string; updatedAt: string;
};
export type AgentBrief = {
  productPurpose?: string; audience?: string; productType?: string; color?: string; placement?: string;
  sourceAssetId?: string; productId?: string; productRevision?: number; worksheet?: 'etsy-physical'; listingPresetId?: string;
  listingId?: string; copyDirection?: string;
  selectedMockupPreset?: Record<string, unknown>; selectedListingPreset?: Record<string, unknown>;
};
export type AgentCommand = { id: string; kind: 'message.send' | 'selection.set' | 'run.continue' | 'run.cancel' | 'action.retry'; text?: string; actionId?: string; selection?: { mockupPresetId?: string; listingPresetId?: string }; attachments?: AgentAttachment[] };
export type AgentSession = {
  schemaVersion: 1; id: string; revision: number; createdAt: string; updatedAt: string;
  status: AgentStatus; brief: AgentBrief; messages: AgentMessage[]; actions: AgentAction[];
  commandResults: Record<string, { status: AgentStatus; message?: string }>;
  ledger: Array<{ id: string; status: AgentStatus; at: string; detail?: string }>;
  turnUsage: { calls: number; actions: number };
};

export type AgentToolSpec = { name: string; description: string; parameters: Record<string, unknown>; location: 'server' | 'browser' };
export type AgentModelPart = { text?: string; functionCall?: { name: string; id?: string; args?: Record<string, unknown> }; functionResponse?: { name: string; id?: string; response: Record<string, unknown> } };
export type AgentModelTurn = { parts: AgentModelPart[]; finishReason?: string };
export type AgentProvider = {
  generate(input: { apiKey: string; model?: string; system: string; contents: Array<Record<string, unknown>>; tools: AgentToolSpec[] }): Promise<AgentModelTurn>;
};

