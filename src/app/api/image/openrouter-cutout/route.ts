import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { OPENROUTER_IMAGE_ASPECT_RATIOS, OPENROUTER_IMAGE_MODELS, type OpenRouterImageAspectRatio, type OpenRouterImageModel } from '@/lib/openRouterImage';

export const dynamic = 'force-dynamic';

const PROMPT = [
  'Edit the supplied flat graphic into a print-ready transparent cutout.',
  'Remove only the uniform empty background outside the printed composition and genuine empty negative spaces inside lettering.',
  'Preserve the artwork composition, all readable text, letter shapes, colors, faces, fine lines, distressed texture, glows, shadows, and intentional interior backgrounds.',
  'Keep disconnected printed elements. Do not redraw, beautify, invent, or add anything.',
  'Center the entire design with a small even transparent margin. Return one artwork image with a true alpha channel, no garment, solid backdrop, checkerboard, or extra shadow.',
].join(' ');

type OpenRouterResponse = {
  data?: Array<{ b64_json?: string; media_type?: string }>;
  error?: { message?: string } | string;
};

export async function POST(request: Request) {
  try {
    const key = request.headers.get('x-openrouter-api-key')?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    if (!key) return NextResponse.json({ error: 'Add an OpenRouter API key in Settings or configure OPENROUTER_API_KEY.' }, { status: 400 });

    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Provide a PNG, JPG, or WebP extracted design.' }, { status: 400 });
    }
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'The design exceeds 25 MB.' }, { status: 413 });

    const model = String(form.get('model') || '');
    const option = OPENROUTER_IMAGE_MODELS.find(item => item.id === model);
    if (!option) return NextResponse.json({ error: 'Choose a supported GPT Image model.' }, { status: 400 });
    const quality = String(form.get('quality') || '');
    if (!option.qualities.some(value => value === quality)) return NextResponse.json({ error: `${option.label} does not support ${quality} quality.` }, { status: 400 });
    const aspectRatio = String(form.get('aspectRatio') || '');
    if (!OPENROUTER_IMAGE_ASPECT_RATIOS.some(value => value === aspectRatio)) {
      return NextResponse.json({ error: 'Choose a supported aspect ratio.' }, { status: 400 });
    }

    const source = Buffer.from(await image.arrayBuffer());
    const input = `data:${image.type};base64,${source.toString('base64')}`;
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model as OpenRouterImageModel,
        prompt: PROMPT,
        input_references: [{ type: 'image_url', image_url: { url: input } }],
        quality,
        aspect_ratio: aspectRatio as OpenRouterImageAspectRatio,
        background: 'transparent',
        output_format: 'png',
        n: 1,
      }),
      signal: AbortSignal.timeout(180000),
    });
    const result = await response.json().catch(() => null) as OpenRouterResponse | null;
    if (!response.ok) {
      const reason = typeof result?.error === 'string' ? result.error : result?.error?.message;
      if (response.status === 401) {
        return NextResponse.json({ error: 'OpenRouter rejected the image request (401). Use Test & Verify in Settings to check the saved key. If it passes there, retry; OpenRouter may be having a temporary authentication issue.' }, { status: 401 });
      }
      return NextResponse.json({ error: reason || `OpenRouter image request failed (${response.status}).` }, { status: response.status });
    }
    const encoded = result?.data?.[0]?.b64_json;
    if (!encoded) return NextResponse.json({ error: 'OpenRouter returned no image.' }, { status: 502 });
    const output = Buffer.from(encoded, 'base64');
    const metadata = await sharp(output).metadata();
    if (metadata.format !== 'png' || !metadata.hasAlpha || !metadata.width || !metadata.height) {
      return NextResponse.json({ error: 'The model did not return a transparent PNG. Try again or choose another removal method.' }, { status: 502 });
    }
    const alpha = await sharp(output).extractChannel(3).raw().toBuffer();
    let transparent = 0;
    let visible = 0;
    for (const value of alpha) {
      if (value < 240) transparent++;
      if (value > 15) visible++;
    }
    if (transparent < alpha.length * 0.01 || visible < alpha.length * 0.01) {
      return NextResponse.json({ error: 'The model did not clearly separate the artwork from its background. Try again or choose another removal method.' }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${encoded}`, width: metadata.width, height: metadata.height });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not remove the background with GPT Image.' }, { status: 500 });
  }
}
