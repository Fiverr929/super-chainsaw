import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { resolveGeminiApiKey, missingApiKeyResponse, AI_STUDIO_BASE_URL } from '@/lib/geminiApi';
import { DEFAULT_EXTRACTION_PROMPT, DEFAULT_IMAGE_MODEL, DETAIL_ANALYSIS_PROMPT, IMAGE_MODEL_OPTIONS, WATERMARK_REMOVAL_PROMPT, finalGeneratedImage, imageQualityForModel, type ImageResponsePart, type ImageModelId, type ImageQuality } from '@/lib/designExtraction';

export const dynamic = 'force-dynamic';

type GeminiImageResponse = {
  candidates?: Array<{ content?: { parts?: ImageResponsePart[] }; finishReason?: string }>;
  predictions?: Array<{ bytesBase64Encoded?: string }>;
};

type PrintBounds = { x: number; y: number; width: number; height: number };

function parseAnalysis(raw: string): { details: string; bounds?: PrintBounds } {
  try {
    const result = JSON.parse(raw) as { details?: unknown; bounds?: Partial<PrintBounds> };
    const bounds = result.bounds;
    if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(value => typeof value === 'number' && Number.isFinite(value))) {
      return { details: String(result.details || '').slice(0, 3000), bounds: bounds as PrintBounds };
    }
    return { details: String(result.details || '').slice(0, 3000) };
  } catch {
    return { details: raw.slice(0, 3000) };
  }
}

async function cropPrint(image: Buffer, bounds?: PrintBounds): Promise<Buffer | undefined> {
  if (!bounds || bounds.width < 80 || bounds.height < 80 || bounds.width > 1000 || bounds.height > 1000) return;
  const metadata = await sharp(image).metadata();
  if (!metadata.width || !metadata.height) return;
  const marginX = Math.max(12, bounds.width * 0.06);
  const marginY = Math.max(12, bounds.height * 0.06);
  const left = Math.max(0, Math.floor((bounds.x - marginX) * metadata.width / 1000));
  const top = Math.max(0, Math.floor((bounds.y - marginY) * metadata.height / 1000));
  const right = Math.min(metadata.width, Math.ceil((bounds.x + bounds.width + marginX) * metadata.width / 1000));
  const bottom = Math.min(metadata.height, Math.ceil((bounds.y + bounds.height + marginY) * metadata.height / 1000));
  if (right - left < 64 || bottom - top < 64) return;
  return sharp(image).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const requestedResolution = formData.get('resolution') as ImageQuality | null;
    const aspectRatio = formData.get('aspectRatio') as string || 'Auto';
    const prompt = (formData.get('prompt') as string || '').trim() || DEFAULT_EXTRACTION_PROMPT;
    const requestedDetails = (formData.get('details') as string || '').trim().slice(0, 3000);
    const requestedModel = (formData.get('model') as string) || DEFAULT_IMAGE_MODEL;
    const formApiKey = formData.get('apiKey') as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const modelOption = IMAGE_MODEL_OPTIONS.find(option => option.id === requestedModel);
    if (!modelOption) {
      return NextResponse.json({ error: 'Choose a supported Nano Banana image model.' }, { status: 400 });
    }
    const resolution = requestedResolution || imageQualityForModel(modelOption.id);
    if (!modelOption.qualities.some(quality => quality === resolution)) {
      return NextResponse.json({ error: `${modelOption.label} does not support ${resolution} output.` }, { status: 400 });
    }
    const model: ImageModelId = modelOption.id;

    const apiKey = resolveGeminiApiKey(request, formApiKey || undefined);
    if (!apiKey) {
      return missingApiKeyResponse();
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    let details = requestedDetails;
    let bounds: PrintBounds | undefined;
    let analysisWarning: string | undefined;
    if (!details) {
      try {
        const analysisResponse = await axios.post<GeminiImageResponse>(
          `${AI_STUDIO_BASE_URL}/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            contents: [{ role: 'user', parts: [
              { text: DETAIL_ANALYSIS_PROMPT },
              { inlineData: { mimeType, data: base64Image } },
            ] }],
            generationConfig: {
              responseModalities: ['TEXT'],
              thinkingConfig: { thinkingLevel: 'MINIMAL' },
              maxOutputTokens: 900,
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
        );
        const raw = (analysisResponse.data.candidates?.[0]?.content?.parts || [])
          .filter(part => !part.thought)
          .map(part => part.text || '').join(' ').trim();
        const analyzed = parseAnalysis(raw);
        details = analyzed.details;
        bounds = analyzed.bounds;
        if (!details) analysisWarning = 'The detail pass returned no description; generation used the photo alone.';
      } catch {
        analysisWarning = 'The detail pass was unavailable; generation used the photo alone.';
      }
    }
    const cropped = await cropPrint(buffer, bounds);
    const referenceImage = cropped || buffer;
    const referenceMimeType = cropped ? 'image/png' : mimeType;
    const reference = cropped ? `data:image/png;base64,${cropped.toString('base64')}` : undefined;
    const designPrompt = details
      ? `${prompt}\n\nFirst-pass description of the visible print: ${details}\nUse the attached image as ground truth wherever this description is uncertain. Do not invent missing detail.`
      : prompt;
    const systemPrompt = `${designPrompt}\n\n${WATERMARK_REMOVAL_PROMPT}`;
    let thinkingLevel = formData.get('thinkingLevel') as string || 'High';
    if (thinkingLevel === 'Medium' || thinkingLevel === 'Low') {
      // Map legacy saved preset values to Minimal to prevent silent UI desync bugs
      thinkingLevel = 'Minimal';
    }

    let data: GeminiImageResponse | undefined;
    try {
      const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: referenceMimeType,
                    data: referenceImage.toString('base64')
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
            ...(thinkingLevel !== 'Minimal' && thinkingLevel.toLowerCase() !== 'minimal' && {
              thinkingConfig: {
                thinkingLevel: thinkingLevel.toUpperCase() // Must be LOW, MEDIUM, or HIGH
              }
            }),
            imageConfig: {
              imageSize: resolution,
              ...(aspectRatio !== 'Auto' ? { aspectRatio } : {}),
            }
          }
        };
        
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await axios.post<GeminiImageResponse>(
            `${AI_STUDIO_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            payload,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 120000
            }
          );
          data = response.data;
          const hasImage = Boolean(finalGeneratedImage(data.candidates?.[0]?.content?.parts || []))
            || Boolean(data.predictions?.[0]?.bytesBase64Encoded);
          const finishReason = data.candidates?.[0]?.finishReason;
          if (hasImage || !['IMAGE_OTHER', 'NO_IMAGE'].includes(finishReason || '') || attempt === 1) break;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error: unknown) {
      const apiError = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      const errorText = typeof apiError?.message === 'string'
        ? apiError.message
        : error instanceof Error ? error.message : String(error);
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: `Failed to analyze image: ${errorText}` }, { status: axios.isAxiosError(error) ? error.response?.status || 502 : 500 });
    }
    
    // Attempt to extract base64 from various possible response structures
    let extractedBase64 = null;
    let extractedMimeType = "image/png";

    const parts = data?.candidates?.[0]?.content?.parts || [];
    
    // Find the part that contains inlineData (the image)
    const imageData = finalGeneratedImage(parts);

    if (imageData?.data) {
        extractedBase64 = imageData.data;
        extractedMimeType = imageData.mimeType || "image/png";
    } else if (data?.predictions?.[0]?.bytesBase64Encoded) {
        extractedBase64 = data.predictions[0].bytesBase64Encoded;
    }

    if (!extractedBase64) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      return NextResponse.json({
        error: ['IMAGE_OTHER', 'NO_IMAGE'].includes(finishReason || '')
          ? 'The image model could not generate a design after retrying. If this is already artwork, use “Use source as design”; otherwise try a clearer product photo or adjust the preset.'
          : `The image model returned no design${finishReason ? ` (${finishReason})` : ''}. Try another photo or adjust the extraction preset.`,
        finishReason,
      }, { status: 502 });
    }

    return NextResponse.json({ image: `data:${extractedMimeType};base64,${extractedBase64}`, details, reference, analysisWarning });
  } catch (error) {
    console.error('Error extracting graphic:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
