import { callGeminiGenerateContent, DEFAULT_GEMINI_MODEL } from '../geminiApi.ts';
import type { AgentProvider, AgentModelPart } from './contracts.ts';
import { readAgentImagePreview } from './mediaStore.ts';

export const GEMINI_AGENT_MODEL = DEFAULT_GEMINI_MODEL;
function sanitizeGeminiFunctionSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeGeminiFunctionSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'additionalProperties').map(([key, child]) => [key, sanitizeGeminiFunctionSchema(child)]));
}

export function makeGeminiAgentProvider(call = callGeminiGenerateContent): AgentProvider {
  return { async generate({ apiKey, model = GEMINI_AGENT_MODEL, system, contents, tools }) {
    const response = await call({ apiKey, model, systemInstruction: system, contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 2500 },
      tools: [{ functionDeclarations: tools.map(tool => ({ name: tool.name.replaceAll('.', '__'), description: tool.description, parameters: sanitizeGeminiFunctionSchema(tool.parameters) })) }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    });
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error('The agent model returned an empty response.');
    return { parts: candidate.content.parts.filter(part => part.text || (part as AgentModelPart).functionCall).map(part => {
      const item = structuredClone(part) as AgentModelPart;
      if (item.functionCall) item.functionCall.name = item.functionCall.name.replaceAll('__', '.');
      return item;
    }), finishReason: candidate.finishReason };
  } };
}
export async function geminiContents(messages: Array<{ role: 'user' | 'assistant' | 'tool'; text: string; toolName?: string; callId?: string; parts?: AgentModelPart[]; attachments?: Array<{ name: string; url: string; mimeType: string }> }>, cwd = process.cwd()): Promise<Array<Record<string, unknown>>> {
  const contents: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      contents.push({ role: 'user', parts: [{ functionResponse: { name: message.toolName?.replaceAll('.', '__'), response: { result: message.text }, ...(message.callId ? { id: message.callId } : {}) } }] });
      continue;
    }
    const parts: Array<Record<string, unknown>> = (message.parts || [{ text: message.text }]).map(part => part.functionCall ? { ...part, functionCall: { ...part.functionCall, name: part.functionCall.name.replaceAll('.', '__') } } : part);
    for (const attachment of (message.attachments || []).slice(0, 2)) parts.push({ inlineData: { mimeType: attachment.mimeType, data: await readAgentImagePreview(attachment.url, cwd) } });
    contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts });
  }
  return contents;
}
export function describeModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

