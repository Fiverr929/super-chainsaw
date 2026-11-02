import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeminiApiOptions } from '../src/lib/geminiApi.ts';
import { AGENT_TOOLS } from '../src/lib/agent/tools.ts';
import { makeGeminiAgentProvider } from '../src/lib/agent/provider.ts';

function containsAdditionalProperties(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAdditionalProperties);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === 'additionalProperties' || containsAdditionalProperties(child));
}

test('removes unsupported additionalProperties recursively at the Gemini function schema boundary', async () => {
  let request: GeminiApiOptions | undefined;
  const provider = makeGeminiAgentProvider(async options => {
    request = options;
    return { candidates: [{ content: { parts: [{ text: 'Ready.' }] } }] };
  });

  await provider.generate({ apiKey: 'test-key', system: 'test', contents: [], tools: AGENT_TOOLS });

  assert.ok(request?.tools);
  assert.equal(containsAdditionalProperties(request.tools), false);
  assert.ok(AGENT_TOOLS.some(tool => tool.parameters.additionalProperties === false), 'internal schemas retain strict unknown-key validation');
  assert.ok(AGENT_TOOLS.some(tool => containsAdditionalProperties(tool.parameters.properties)), 'nested internal object validation remains strict');
});
