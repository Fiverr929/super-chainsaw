import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

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

    const systemPrompt = "Extract the main graphic/design from this t-shirt and place it on a solid white background. Return only the image.";

    const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: `Failed to analyze image: ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    
    // Attempt to extract base64 from various possible response structures
    let extractedBase64 = null;
    let extractedMimeType = "image/png";

    if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        extractedBase64 = data.candidates[0].content.parts[0].inlineData.data;
        extractedMimeType = data.candidates[0].content.parts[0].inlineData.mimeType || "image/png";
    } else if (data.predictions?.[0]?.bytesBase64Encoded) {
        extractedBase64 = data.predictions[0].bytesBase64Encoded;
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        // Fallback if it returned text representing base64
        const text = data.candidates[0].content.parts[0].text;
        if (text.startsWith("iVBOR") || text.length > 1000) { 
            extractedBase64 = text;
        }
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

