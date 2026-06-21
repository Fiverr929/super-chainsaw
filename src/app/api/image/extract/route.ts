import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const resolution = formData.get('resolution') as string || '1K';
    const aspectRatio = formData.get('aspectRatio') as string || '1:1';
    const prompt = formData.get('prompt') as string || '';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    const systemPrompt = prompt;
    let thinkingLevel = formData.get('thinkingLevel') as string || 'High';
    if (thinkingLevel === 'Medium' || thinkingLevel === 'Low') {
      // Map legacy saved preset values to Minimal to prevent silent UI desync bugs
      thinkingLevel = 'Minimal';
    }

    let data;
    try {
      const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            ...(thinkingLevel !== 'Minimal' && thinkingLevel.toLowerCase() !== 'minimal' && {
              thinkingConfig: {
                thinkingLevel: thinkingLevel.toUpperCase() // Must be LOW, MEDIUM, or HIGH
              }
            }),
            imageConfig: {
              imageSize: resolution,
              aspectRatio: aspectRatio
            }
          }
        };
        
        console.log("SENDING GEMINI PAYLOAD:", JSON.stringify({
          ...payload, 
          contents: [{ parts: [{ text: systemPrompt }, { inlineData: "[BASE64_IMAGE_TRUNCATED]" }]}]
        }, null, 2));

        const response = await axios.post(
          `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
          timeout: 120000 // 2 minute timeout
        }
      );
      data = response.data;
    } catch (axiosError: any) {
      const errorText = axiosError.response?.data ? JSON.stringify(axiosError.response.data) : axiosError.message;
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: `Failed to analyze image: ${errorText}` }, { status: 500 });
    }
    
    // Attempt to extract base64 from various possible response structures
    let extractedBase64 = null;
    let extractedMimeType = "image/png";

    const parts = data.candidates?.[0]?.content?.parts || [];
    
    // Find the part that contains inlineData (the image)
    const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.data);
    const textPart = parts.find((p: any) => p.text);

    if (imagePart) {
        extractedBase64 = imagePart.inlineData.data;
        extractedMimeType = imagePart.inlineData.mimeType || "image/png";
    } else if (data.predictions?.[0]?.bytesBase64Encoded) {
        extractedBase64 = data.predictions[0].bytesBase64Encoded;
    } else if (textPart && (textPart.text.startsWith("iVBOR") || textPart.text.length > 1000)) {
        // Fallback if it returned text representing base64
        extractedBase64 = textPart.text;
    }

    if (!extractedBase64) {
      console.error("Unexpected API response structure:", JSON.stringify(data));
      return NextResponse.json({ error: 'AI failed to return an image', details: data }, { status: 500 });
    }

    return NextResponse.json({ image: `data:${extractedMimeType};base64,${extractedBase64}` });
  } catch (error) {
    console.error('Error extracting graphic:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
