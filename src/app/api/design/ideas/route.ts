import { NextResponse } from 'next/server';
import { callGeminiGenerateContent, missingApiKeyResponse, resolveGeminiApiKey } from '@/lib/geminiApi';
import { parseDesignIdeas } from '@/lib/designIdeation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const apiKey = resolveGeminiApiKey(request);
    if (!apiKey) return missingApiKeyResponse();
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Provide an extracted design image.' }, { status: 400 });
    }
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'The design exceeds 25 MB.' }, { status: 413 });
    const source = Buffer.from(await image.arrayBuffer());
    const response = await callGeminiGenerateContent({
      apiKey,
      contents: [{ role: 'user', parts: [
        { text: `Study this product artwork as market inspiration, not as artwork to copy. Return JSON with sourceBrief and exactly 6 commercially distinct concepts.

sourceBrief keys: subject, appeal, audience, visualStructure, avoidCopying (array). Each concept needs: name, buyer, hook, composition, style, palette, garmentColors (array), originality, generationPrompt, riskNote.

The six concepts must differ in buyer motivation and visual structure, not merely colors. Include a mix of illustration-led, typography-led, badge/emblem, humorous or emotional, niche-audience, and personalization/occasion opportunities when relevant. Keep the recognizable broad topic but do not reuse exact slogans, distinctive character likenesses, logos, branded names, watermarks, or the source composition. If the source appears to reference copyrighted entertainment or a celebrity, generalize it into an original genre-level idea. generationPrompt must describe flat print-ready artwork and be concrete enough for an image model. Return JSON only.` },
        { inlineData: { mimeType: image.type, data: source.toString('base64') } },
      ] }],
      generationConfig: { temperature: 0.9, responseMimeType: 'application/json', maxOutputTokens: 6000 },
      timeoutMs: 120000,
    });
    const output = response.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
    if (!output) return NextResponse.json({ error: 'The idea model returned no concepts.' }, { status: 502 });
    const parsed = JSON.parse(output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
    return NextResponse.json(parseDesignIdeas(parsed));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not develop design ideas.' }, { status: 500 });
  }
}
