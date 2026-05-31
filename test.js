const fs = require('fs');

async function test() {
  const context = "vintage skull tee";
  const imageCount = 5;
  const systemPrompt = `You are a professional Etsy copywriter and SEO expert. 
You will receive a short context or prompt about a product.
Your job is to generate a highly optimized Etsy Title, Description, EXACTLY 13 Tags, and Alt Text for exactly ${imageCount} images.
The title must be keyword-rich but readable, max 140 characters.
The description must be engaging, informative, and formatted with bullet points for features.
The tags must be exactly 13 comma-separated phrases, max 20 characters each.
The alt_text must be exactly ${imageCount} different highly-descriptive alt texts separated by the '|' character (e.g. "Front view of item | Back view | Close up | Lifestyle").
Return ONLY valid JSON with no markdown formatting.
Format: { "title": "...", "description": "...", "tags": "tag1, tag2, tag3, ...", "alt_text": "alt1 | alt2 | alt3 | ..." }`;

  require('dotenv').config({ path: '.env.local' });
  const apiKey = process.env.GOOGLE_API_KEY;

  const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
      'Referer': 'http://localhost:3000/'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { parts: [{ text: context }] }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Gemini Error:", err);
    return;
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
