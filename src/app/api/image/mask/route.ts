import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { callGeminiGenerateContent, missingApiKeyResponse, resolveGeminiApiKey } from '@/lib/geminiApi';
import { finalGeneratedImage } from '@/lib/designExtraction';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const key = resolveGeminiApiKey(request);
    if (!key) return missingApiKeyResponse();
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Provide a design image.' }, { status: 400 });
    }
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'The design exceeds 25 MB.' }, { status: 413 });
    const source = Buffer.from(await image.arrayBuffer());
    const dimensions = await sharp(source).metadata();
    const imageSize = Math.max(dimensions.width || 0, dimensions.height || 0) > 2048 ? '4K' : '2K';
    const data = source.toString('base64');
    const response = await callGeminiGenerateContent({
      apiKey: key,
      model: 'gemini-3.1-flash-image',
      contents: [{ role: 'user', parts: [
        { text: [
          'This is an image segmentation task. Return exactly one grayscale alpha matte for the attached flat design, at the same aspect ratio and with every edge in the same pixel position.',
          'Pure white (#ffffff) means keep the complete printed composition: figures, lettering, fine linework, intentional texture, shadows, highlights, and the interior color areas that make the design cohesive.',
          'Pure black (#000000) means remove the empty shirt-colored canvas outside the design. Follow an organic outer contour around the complete composition, including disconnected print elements.',
          'Protect faces, bodies, printed letter strokes, shadows, and intentional interior artwork. Make true negative-space counters inside letters and numbers black when they show the same empty shirt-colored background as the outer canvas (for example the holes in A, B, D, O, P, R, 0, 4, 6, 8, and 9).',
          'Use intermediate gray only in a narrow antialiased edge, never over broad regions. The output must contain no original colors, no rendered artwork, no checkerboard, and no text labels.',
          'Copy the source geometry exactly. Do not move, crop, rescale, simplify, redraw, or invent any element. Keep the full original canvas and alignment.',
        ].join(' ') },
        { inlineData: { mimeType: image.type, data } },
      ] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize } },
      timeoutMs: 120000,
    });
    const result = finalGeneratedImage(response.candidates?.[0]?.content?.parts || []);
    if (!result) return NextResponse.json({ error: 'The image model returned no mask.' }, { status: 502 });
    return NextResponse.json({ mask: `data:${result.mimeType};base64,${result.data}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate a mask.' }, { status: 500 });
  }
}
