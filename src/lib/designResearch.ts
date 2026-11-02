export type ResearchObservation = {
  id: string;
  assetId?: string;
  observedAt: string;
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  price?: string;
  imageUrl?: string;
  originalCreatedAt?: string;
  lastModifiedAt?: string;
  soldPageUrl: string;
  seenOnSoldPage: boolean;
  listedDate: string;
  favorites: string;
  visualNotes: string;
};

export type DesignResearchCase = {
  keyword: string;
  audience: string;
  notes: string;
  observations: ResearchObservation[];
};

export type ResearchOpportunity = {
  id: string;
  name: string;
  sourceConnection: string;
  specificChange: string;
  buyerReason: string;
  evidenceIds: string[];
  uncertainty: string;
  designDirection: string;
};

export type ResearchResult = {
  sourceAnalysis: { subject: string; visibleArtwork: string; composition: string; palette: string; buyerAppeal: string; uncertainDetails: string };
  opportunities: ResearchOpportunity[];
};

const string = (value: unknown, max = 600) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function etsyUrl(value: unknown): string {
  const raw = string(value, 500);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'etsy.com' || url.hostname.endsWith('.etsy.com')) ? url.toString() : '';
  } catch { return ''; }
}

export function parseResearchCase(value: unknown): DesignResearchCase {
  if (!value || typeof value !== 'object') throw new Error('Enter a research brief.');
  const raw = value as Record<string, unknown>;
  const entries = Array.isArray(raw.observations) ? raw.observations.slice(0, 8) : [];
  const observations = entries.map((entry, index) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      id: `source-${index + 1}`,
      assetId: /^\d{8,15}$/.test(string(item.assetId, 20)) ? string(item.assetId, 20) : undefined,
      observedAt: string(item.observedAt, 30),
      url: etsyUrl(item.url),
      title: string(item.title, 200),
      description: string(item.description, 3000),
      tags: Array.isArray(item.tags) ? item.tags.map(tag => string(tag, 100)).filter(Boolean).slice(0, 13) : [],
      price: string(item.price, 40),
      imageUrl: string(item.imageUrl, 300),
      originalCreatedAt: string(item.originalCreatedAt, 30),
      lastModifiedAt: string(item.lastModifiedAt, 30),
      soldPageUrl: etsyUrl(item.soldPageUrl),
      seenOnSoldPage: item.seenOnSoldPage === true,
      listedDate: string(item.listedDate, 60),
      favorites: string(item.favorites, 30),
      visualNotes: string(item.visualNotes, 600),
    };
  }).filter(item => item.url || item.title || item.visualNotes || item.soldPageUrl);
  if (!observations.length) throw new Error('Add at least one listing observation.');
  const keyword = string(raw.keyword, 120) || observations[0].title.slice(0, 120);
  if (!keyword) throw new Error('Import a listing or enter a niche keyword.');
  if (!observations.some(item => item.title || item.description || item.visualNotes || item.seenOnSoldPage || item.listedDate || item.favorites)) {
    throw new Error('Add what you observed on the listing; a URL alone is only a source link.');
  }
  return { keyword, audience: string(raw.audience, 200), notes: string(raw.notes, 1000), observations };
}

export function parseResearchResult(value: unknown, sourceIds: string[]): ResearchResult {
  if (!value || typeof value !== 'object') throw new Error('The research model returned an invalid response.');
  const raw = value as Record<string, unknown>;
  const analysisRaw = raw.sourceAnalysis && typeof raw.sourceAnalysis === 'object' ? raw.sourceAnalysis as Record<string, unknown> : {};
  const sourceAnalysis = {
    subject: string(analysisRaw.subject, 150), visibleArtwork: string(analysisRaw.visibleArtwork, 600),
    composition: string(analysisRaw.composition, 600), palette: string(analysisRaw.palette, 300),
    buyerAppeal: string(analysisRaw.buyerAppeal, 500), uncertainDetails: string(analysisRaw.uncertainDetails, 300),
  };
  if (!sourceAnalysis.subject || !sourceAnalysis.visibleArtwork || !sourceAnalysis.composition) {
    throw new Error('The model did not describe the source artwork. Refresh the analysis.');
  }
  const entries = Array.isArray(value) ? value : Array.isArray(raw.opportunities) ? raw.opportunities : Array.isArray(raw.concepts) ? raw.concepts : [];
  const allowed = new Set(sourceIds);
  const opportunities = entries.slice(0, 3).map((entry, index) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const cited = Array.isArray(item.evidenceIds) ? item.evidenceIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)).slice(0, 8) : [];
    return {
      id: `opportunity-${index + 1}`,
      name: string(item.name || item.title, 100),
      sourceConnection: string(item.sourceConnection, 500),
      specificChange: string(item.specificChange, 500),
      buyerReason: string(item.buyerReason, 500),
      evidenceIds: cited.length ? cited : sourceIds.length === 1 ? [sourceIds[0]] : [],
      uncertainty: string(item.uncertainty || item.limitations, 500),
      designDirection: string(item.designDirection || item.generationPrompt || item.prompt, 600),
    };
  }).filter(item => item.name && item.sourceConnection && item.specificChange && item.designDirection && item.evidenceIds.length);
  if (opportunities.length !== 3) throw new Error(`The research model returned ${opportunities.length} usable opportunities out of ${entries.length} (${Array.isArray(value) ? 'array' : Object.keys(raw).slice(0, 6).join(', ') || 'no fields'}). Try again.`);
  return { sourceAnalysis, opportunities };
}
