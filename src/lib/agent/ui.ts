import type { AgentStatus } from './contracts';

export function isAgentActive(status: AgentStatus | undefined): boolean {
  return status === 'running' || status === 'waiting-for-browser';
}

export function canSubmitAgentMessage(text: string, busy: boolean, status: AgentStatus | undefined): boolean {
  return !!text.trim() && !busy && !isAgentActive(status);
}

export function summarizeToolResult(toolName: string | undefined, raw: string): string {
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw.slice(0, 180);
    value = parsed as Record<string, unknown>;
  } catch {
    return raw.slice(0, 180);
  }

  if (toolName === 'workspace.inspect') {
    const products = typeof value.productCount === 'number' ? value.productCount : Array.isArray(value.products) ? value.products.length : 0;
    const assets = typeof value.inspirationAssetCount === 'number' ? value.inspirationAssetCount : Array.isArray(value.inspirationAssets) ? value.inspirationAssets.length : 0;
    const listings = typeof value.listingCount === 'number' ? value.listingCount : Array.isArray(value.listings) ? value.listings.length : 0;
    return `${products} saved product${products === 1 ? '' : 's'} · ${assets} imported reference${assets === 1 ? '' : 's'} · ${listings} local listing${listings === 1 ? '' : 's'}`;
  }
  if (toolName === 'etsy.inspiration.fetch') {
    const title = typeof value.title === 'string' ? value.title : 'Etsy reference';
    const images = Array.isArray(value.images) ? value.images.length : 0;
    return `${title} · ${images} saved images`;
  }
  if (toolName === 'presets.list') {
    const mockups = Array.isArray(value.mockupPresets) ? value.mockupPresets.length : 0;
    const listings = Array.isArray(value.listingPresets) ? value.listingPresets.length : 0;
    return `${mockups} mockup presets · ${listings} listing presets`;
  }
  if (typeof value.error === 'string') return value.error.slice(0, 180);
  if (typeof value.message === 'string') return value.message.slice(0, 180);
  if (typeof value.name === 'string') return value.name.slice(0, 180);
  if (typeof value.status === 'string') return `Step ${value.status}.`;
  return 'Step completed. Details are available below.';
}
