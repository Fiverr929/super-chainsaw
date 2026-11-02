import { workspaceStorageContext } from '@/lib/workspaceFs';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { OPENROUTER_IMAGE_ASPECT_RATIOS, OPENROUTER_IMAGE_MODELS } from '@/lib/openRouterImage';

export const dynamic = 'force-dynamic';

const FAITHFUL_PROMPT = [
  'Use the attached product photo as a reference to recreate only the printed artwork as one flat, print-ready graphic.',
  'Remove the garment or product, folds, fabric texture, perspective distortion, lighting, scene, and all background.',
  'Make the artwork face forward and preserve its composition, colors, lettering, illustrations, fine details, intentional texture, and disconnected printed elements as faithfully as possible.',
  'Do not include a mockup, product silhouette, seller watermark, new lettering, or invented decorations.',
  'Center the complete artwork with a small even transparent margin. Return a PNG with real transparency around the artwork; no solid backdrop or checkerboard.',
].join(' ');

const EXTRACT_PROMPT = [
  'Use the attached product photo to extract only the printed artwork as a flat, front-facing graphic.',
  'Remove the garment or product, folds, fabric texture, perspective distortion, lighting, and surrounding scene.',
  'Preserve the print composition, readable lettering, colors, faces, fine details, and intentional distressed texture as faithfully as possible.',
  'Place the complete extracted graphic on a uniform pure white background with a small even margin.',
  'Do not remove the white background yet. Do not add a mockup, product silhouette, watermark, new lettering, or invented decoration.',
].join(' ');

const INSPIRED_PROMPT = [
  'Create a fresh, print-ready graphic inspired by the artwork on the reference garment.',
  'Use the broad theme and visual genre where helpful. Develop a distinct composition rather than extracting or closely recreating the print. Do not reproduce source logos, slogans, protected names, lyrics, artist likenesses, or tour branding.',
  'Make the artwork clear and high contrast, with readable lettering, solid visible ink, clean edges, and intentional texture. Avoid faint, ghosted, or washed-out marks.',
  'Output only the flat, front-facing design, centered with a small margin. No garment, mockup, fabric texture, or surrounding scene.',
].join(' ');

type OpenRouterResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string } | string;
};

export async function POST(request: Request) {
  try {
    const key = request.headers.get('x-openrouter-api-key')?.trim() || (workspaceStorageContext() ? undefined : process.env.OPENROUTER_API_KEY?.trim());
    if (!key) return NextResponse.json({ error: 'Add an OpenRouter API key in Settings or configure OPENROUTER_API_KEY.' }, { status: 400 });

    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Provide a PNG, JPG, or WebP product photo.' }, { status: 400 });
    }
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'The product photo exceeds 25 MB.' }, { status: 413 });

    const model = String(form.get('model') || '');
    const option = OPENROUTER_IMAGE_MODELS.find(item => item.id === model);
    if (!option) return NextResponse.json({ error: 'Choose a supported GPT Image model.' }, { status: 400 });
    const quality = String(form.get('quality') || '');
    if (!option.qualities.some(value => value === quality)) return NextResponse.json({ error: `${option.label} does not support ${quality} quality.` }, { status: 400 });
    const aspectRatio = String(form.get('aspectRatio') || '');
    if (!OPENROUTER_IMAGE_ASPECT_RATIOS.some(value => value === aspectRatio)) {
      return NextResponse.json({ error: 'Choose a supported aspect ratio.' }, { status: 400 });
    }
    const intent = String(form.get('intent') || 'faithful');
    if (intent !== 'faithful' && intent !== 'original' && intent !== 'extract') return NextResponse.json({ error: 'Choose a supported design mode.' }, { status: 400 });
    const creativeDirection = String(form.get('creativeDirection') || '').trim().slice(0, 600);
    const prompt = intent === 'original'
      ? `${INSPIRED_PROMPT}${creativeDirection ? ` Creative direction from the user: ${creativeDirection}` : ''}`
      : intent === 'extract' ? EXTRACT_PROMPT : FAITHFUL_PROMPT;

    const input = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString('base64')}`;
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        input_references: [{ type: 'image_url', image_url: { url: input } }],
        quality,
        aspect_ratio: aspectRatio,
        background: intent === 'extract' ? 'opaque' : 'transparent',
        output_format: 'png',
        n: 1,
      }),
      signal: AbortSignal.timeout(180000),
    });
    const result = await response.json().catch(() => null) as OpenRouterResponse | null;
    if (!response.ok) {
      const reason = typeof result?.error === 'string' ? result.error : result?.error?.message;
      if (response.status === 401) return NextResponse.json({ error: 'OpenRouter rejected the image request (401). Use Test & Verify in Settings to check the saved key.' }, { status: 401 });
      return NextResponse.json({ error: reason || `OpenRouter image request failed (${response.status}).` }, { status: response.status });
    }
    const encoded = result?.data?.[0]?.b64_json;
    if (!encoded) return NextResponse.json({ error: 'OpenRouter returned no image.' }, { status: 502 });
    const output = Buffer.from(encoded, 'base64');
    const metadata = await sharp(output).metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
      return NextResponse.json({ error: 'The model did not return a PNG. Try again.' }, { status: 502 });
    }
    if (intent === 'extract') {
      const opaque = await sharp(output).flatten({ background: '#ffffff' }).png().toBuffer();
      return NextResponse.json({ image: `data:image/png;base64,${opaque.toString('base64')}`, width: metadata.width, height: metadata.height });
    }
    if (!metadata.hasAlpha) {
      return NextResponse.json({ error: 'The model did not return a transparent PNG. Try again or use the existing extraction flow.' }, { status: 502 });
    }
    const alpha = await sharp(output).extractChannel(3).raw().toBuffer();
    let transparent = 0;
    let visible = 0;
    for (const value of alpha) {
      if (value < 240) transparent++;
      if (value > 15) visible++;
    }
    if (transparent < alpha.length * 0.01 || visible < alpha.length * 0.01) {
      return NextResponse.json({ error: 'The model did not clearly isolate the artwork. Try again or use the existing extraction flow.' }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${encoded}`, width: metadata.width, height: metadata.height });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create the transparent design with GPT Image.' }, { status: 500 });
  }
}
