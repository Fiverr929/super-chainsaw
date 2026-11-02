export type DesignConcept = {
  id: string;
  name: string;
  buyer: string;
  hook: string;
  composition: string;
  style: string;
  palette: string;
  garmentColors: string[];
  originality: string;
  generationPrompt: string;
  riskNote: string;
};

export type DesignIdeaResponse = {
  sourceBrief: {
    subject: string;
    appeal: string;
    audience: string;
    visualStructure: string;
    avoidCopying: string[];
  };
  concepts: DesignConcept[];
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, 1200) : fallback;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => text(item)).filter(Boolean).slice(0, 8) : [];
}

export function parseDesignIdeas(value: unknown): DesignIdeaResponse {
  if (!value || typeof value !== 'object') throw new Error('The idea model returned an invalid response.');
  const raw = value as Record<string, unknown>;
  const briefRaw = raw.sourceBrief && typeof raw.sourceBrief === 'object' ? raw.sourceBrief as Record<string, unknown> : {};
  const rawConcepts = Array.isArray(raw.concepts) ? raw.concepts : [];
  const concepts = rawConcepts.slice(0, 6).map((entry, index) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      id: `concept-${index + 1}`,
      name: text(item.name, `Concept ${index + 1}`),
      buyer: text(item.buyer, 'Broad gift buyer'),
      hook: text(item.hook),
      composition: text(item.composition),
      style: text(item.style),
      palette: text(item.palette),
      garmentColors: list(item.garmentColors),
      originality: text(item.originality),
      generationPrompt: text(item.generationPrompt),
      riskNote: text(item.riskNote, 'Avoid protected names, logos, characters, and exact source wording.'),
    };
  }).filter(item => item.name && item.composition && item.generationPrompt);
  if (concepts.length < 3) throw new Error('The idea model did not return enough usable concepts. Try again.');
  return {
    sourceBrief: {
      subject: text(briefRaw.subject), appeal: text(briefRaw.appeal), audience: text(briefRaw.audience),
      visualStructure: text(briefRaw.visualStructure), avoidCopying: list(briefRaw.avoidCopying),
    },
    concepts,
  };
}

export function conceptDirection(concept: DesignConcept, userDirection = ''): string {
  return [
    `Selected concept: ${concept.name}.`, `Target buyer: ${concept.buyer}.`, `Commercial hook: ${concept.hook}.`,
    `Composition: ${concept.composition}.`, `Visual style: ${concept.style}.`, `Palette: ${concept.palette}.`,
    `Originality requirement: ${concept.originality}.`, `Artwork instructions: ${concept.generationPrompt}.`,
    `Safety constraint: ${concept.riskNote}.`, userDirection.trim() ? `Additional user direction: ${userDirection.trim()}` : '',
  ].filter(Boolean).join(' ');
}
