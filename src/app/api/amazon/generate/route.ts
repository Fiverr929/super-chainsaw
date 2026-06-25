import { NextResponse } from 'next/server';
import fs from 'fs';
import sharp from 'sharp';
import { AMAZON_AI_DROPDOWN_OPTIONS, type AmazonAiDropdownField } from '@/lib/amazonAiConstants';
import { resolvePublicAssetPath } from '@/lib/serverPaths';

export const dynamic = 'force-dynamic';

type RequestBody = { context?: string; imagePaths?: string[]; existingData?: Record<string, unknown>; requestedFields?: string[]; rules?: Record<string, string> };

function cleanString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.join('\n').trim();
  if (value === null || value === undefined) return undefined;
  return String(value).trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const existingData = body.existingData || {};
    const requestedFields = Array.isArray(body.requestedFields) ? body.requestedFields : [];
    const requestedSet = new Set(requestedFields);
    const rules = body.rules || {};
    if (requestedFields.length === 0) return NextResponse.json({});

    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    for (const fileUrl of body.imagePaths || []) {
      const absolutePath = resolvePublicAssetPath(fileUrl);
      if (!absolutePath || !fs.existsSync(absolutePath)) continue;
      const compressed = await sharp(fs.readFileSync(absolutePath)).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: compressed.toString('base64') } });
    }

    const instructions: string[] = [];
    if (requestedSet.has('title')) instructions.push('- title: ' + (rules.title || 'Write a concise Amazon India T-shirt title.'));
    if (requestedSet.has('description')) instructions.push('- description: ' + (rules.description || 'Write a factual product description.'));
    if (requestedSet.has('bullet_points')) instructions.push('- bullet_points: ' + (rules.bullet_points || 'Write five concise factual bullets separated by newlines.'));
    if (requestedSet.has('keywords')) instructions.push('- keywords: ' + (rules.keywords || 'Write relevant comma-separated search phrases.'));
    for (const field of ['sport_type', 'league_name', 'team_name', 'lifestyle']) {
      if (requestedSet.has(field)) instructions.push('- ' + field + ': infer only when clearly supported; otherwise return None.');
    }
    for (const [field, options] of Object.entries(AMAZON_AI_DROPDOWN_OPTIONS)) {
      if (requestedSet.has(field)) instructions.push('- ' + field + ': choose exactly one of ' + JSON.stringify([...options]) + ', or None when unsupported or uncertain.');
    }

    const fixedFacts = Object.fromEntries(Object.entries(existingData).filter(([key, value]) =>
      typeof value === 'string' && value !== '' && value !== 'Auto' && value !== 'None' && !requestedSet.has(key) && !key.endsWith('_rules') && !key.endsWith('_auto')
    ));
    const prompt = [
      'You create metadata for an Amazon India physical T-shirt listing.',
      'Return only a valid JSON object containing every requested key and no extra keys.',
      'Never invent garment construction, fabric, fit, measurements, brand ownership, licensing, or performance claims.',
      'Use fixed preset facts exactly. Analyze images only for the design and visibly supported attributes.',
      rules.attributes ? 'Additional attribute guidance: ' + rules.attributes : '',
      '', 'Requested fields:', instructions.join('\n'), '',
      'Fixed preset facts:', JSON.stringify(fixedFacts, null, 2), '',
      'Context:', body.context || ''
    ].join('\n');

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GOOGLE_API_KEY is missing from .env.local.' }, { status: 400 });

    const response = await fetch('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }], generationConfig: { temperature: 0.35, responseMimeType: 'application/json' } })
    });
    if (!response.ok) return NextResponse.json({ error: 'Amazon AI generation failed: ' + await response.text() }, { status: 500 });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== 'string') return NextResponse.json({ error: 'Amazon AI returned no content.' }, { status: 500 });
    const parsed = JSON.parse(rawText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim()) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const field of requestedFields) {
      const value = cleanString(parsed[field]);
      if (field in AMAZON_AI_DROPDOWN_OPTIONS) {
        const options = AMAZON_AI_DROPDOWN_OPTIONS[field as AmazonAiDropdownField] as readonly string[];
        result[field] = value && options.includes(value) ? value : 'None';
      } else {
        result[field] = value || '';
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Amazon AI generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
