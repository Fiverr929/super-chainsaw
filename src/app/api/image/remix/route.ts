import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { callGeminiGenerateContent, missingApiKeyResponse, resolveGeminiApiKey } from '@/lib/geminiApi';
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_OPTIONS, finalGeneratedImage, imageQualityForModel } from '@/lib/designExtraction';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const key = resolveGeminiApiKey(request);
    if (!key) return missingApiKeyResponse();
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
      return NextResponse.json({ error: 'Provide an extracted design image.' }, { status: 400 });
    }
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'The design exceeds 25 MB.' }, { status: 413 });
    const requestedModel = String(form.get('model') || DEFAULT_IMAGE_MODEL);
    const model = IMAGE_MODEL_OPTIONS.find(option => option.id === requestedModel);
    if (!model) return NextResponse.json({ error: 'Choose a supported image model.' }, { status: 400 });
    const quality = imageQualityForModel(model.id, String(form.get('resolution') || ''));
    const direction = String(form.get('direction') || '').trim().slice(0, 1000);
    const source = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(source).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({ error: 'Could not read the design image.' }, { status: 400 });
    const response = await callGeminiGenerateContent({
      apiKey: key,
      model: model.id,
      contents: [{ role: 'user', parts: [
        { text: [
          'Create an entirely new, original print-ready graphic inspired by the attached extracted design.',
          'Keep the same recognizable subject and core theme, but change the composition substantially: new arrangement, pose or framing, graphic treatment, decorative elements, and typography layout where appropriate. Do not trace, lightly recolor, or reproduce the reference composition.',
          'Make a cohesive, polished design with deliberate hierarchy, expressive details, strong silhouettes, and an attractive outer shape suitable for a T-shirt print. Preserve internal figures, lettering, shadows, glows, and intentional backdrops as part of the new composition.',
          'If the reference has text, use it only when confidently readable. Do not invent tiny words or copy seller watermarks. Remove all watermarks and unrelated overlays.',
          'Output only the flat artwork, front-facing and centered, filling most of the canvas with a small margin. No shirt, mockup, room, captions, or checkerboard. Use one uniform opaque background outside the design so it can be removed in the next step.',
          direction ? `Creative direction from the user: ${direction}` : 'Creative direction: produce a fresh, dramatic interpretation with a visibly different layout.',
        ].join(' ') },
        { inlineData: { mimeType: image.type, data: source.toString('base64') } },
      ] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: quality } },
      timeoutMs: 120000,
    });
    const generated = finalGeneratedImage(response.candidates?.[0]?.content?.parts || []);
    if (!generated) return NextResponse.json({ error: 'The image model returned no new design. Try a different direction.' }, { status: 502 });
    return NextResponse.json({ image: `data:${generated.mimeType};base64,${generated.data}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create a new design.' }, { status: 500 });
  }
}
