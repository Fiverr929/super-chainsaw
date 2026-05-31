import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { context, imageCount = 5, existingData = {} } = await request.json();

    if (!context || context.trim() === '') {
      // Proceed even if context is empty
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      console.warn("GOOGLE_API_KEY is missing from .env! Using highly realistic mock fallback for testing.");
      // Artificial delay to simulate AI thinking
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return NextResponse.json({
        title: `Vintage Grunge ${context.substring(0, 15)} Graphic Tee | Aesthetic 90s Streetwear Shirt | Oversized Edgy Clothing Gift`,
        description: `Step up your streetwear game with this ultra-premium vintage graphic tee.\n\nInspired by classic 90s grunge aesthetics, this shirt is designed to look perfectly worn-in while maintaining an incredibly soft and heavy-weight feel.\n\nContext provided: ${context}\n\nFeatures:\n- 100% Ring-Spun Cotton\n- Relaxed, Oversized Fit\n- Distressed Graphic Print\n- Wash inside out on cold to preserve the vintage fade.\n\nPlease note this is a handmade item and slight variations in the wash may occur.`,
        tags: "grunge shirt, vintage tee, 90s aesthetic, streetwear, oversized shirt, graphic tee, edgy clothing, alternative fashion, skater shirt, unisex tee, gift for him, punk shirt, retro clothing",
        alt_text: "Front view of vintage grunge graphic tee | Back view showing oversized streetwear fit | Close up of distressed graphic print | Lifestyle shot of skater wearing the aesthetic shirt | Size chart for unisex oversized fit"
      });
    }

    const missingFields = [];
    if (!existingData.title) missingFields.push('"title" (a highly optimized Etsy Title)');
    if (!existingData.description) missingFields.push('"description" (a detailed Etsy Description)');
    if (!existingData.tags) missingFields.push('"tags" (EXACTLY 13 Etsy Tags as a comma-separated string)');
    if (!existingData.alt_text) missingFields.push(`"alt_text" (SEO-optimized Alt Text for exactly ${imageCount} images, separated by |)`);
    if (!existingData.primary_color) missingFields.push('"primary_color"');
    if (!existingData.occasion) missingFields.push('"occasion"');
    if (!existingData.celebration) missingFields.push('"celebration"');
    if (!existingData.subject) missingFields.push('"subject"');

    const systemPrompt = `You are a professional Etsy copywriter and SEO expert. 
You will receive a context or prompt about a product.

Your job is to generate ONLY the missing fields. Do not generate fields that already exist or were not requested.
The fields you need to generate are:
${missingFields.length > 0 ? missingFields.map(f => "- " + f).join("\n") : "None"}

If the list of fields to generate is "None", you should return an empty JSON object {}.

For taxonomy attributes, if none fit perfectly, leave the string empty (""):
- primary_color: Choose exactly one from: "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Grey", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow".
- occasion: Choose exactly one from: "1st birthday", "Anniversary", "Baby shower", "Bachelor party", "Bachelorette party", "Back to school", "Baptism", "Bar & Bat Mitzvah", "Birthday", "Bridal shower", "Confirmation", "Divorce & breakup", "Engagement", "First Communion", "Graduation", "Grief & mourning", "Housewarming", "LGBTQ pride", "Moving", "Pet loss", "Retirement", "Wedding".
- celebration: Choose exactly one from: "Christmas", "Cinco de Mayo", "Dia de los Muertos", "Diwali", "Easter", "Eid", "Father's Day", "Halloween", "Hanukkah", "Holi", "Independence Day", "Kwanzaa", "Lunar New Year", "Mardi Gras", "Mother's Day", "New Year's", "Passover", "Ramadan", "St Patrick's Day", "Thanksgiving", "Valentine's Day", "Veterans Day".
- subject: Choose exactly one from: "Abstract & geometric", "Animal", "Anime & cartoon", "Architecture & cityscape", "Beach & tropical", "Comics & manga", "Educational", "Fantasy & Sci Fi", "Fashion", "Flowers", "Food & drink", "Horror & gothic", "Humorous saying", "Inspirational saying", "Landscape & scenery", "Love & friendship", "Movie", "Music", "Nautical", "People & portrait", "Pet portrait", "Phrase & saying", "Plants & trees", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Travel & transportation", "TV", "Typography & symbols", "Video game", "Western & cowboy", "Zodiac".

Return ONLY valid JSON with no markdown formatting. The JSON keys MUST exactly match the names of the fields you were asked to generate (e.g., "title", "description", "tags", "primary_color").
Format example if generating title and primary_color: { "title": "...", "primary_color": "..." }`;

    const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          { 
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nContext: ${context}` }] 
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: `Failed to generate from Gemini: ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const contentText = data.candidates[0].content.parts[0].text;
    const content = JSON.parse(contentText);

    return NextResponse.json({
      title: content.title,
      description: content.description,
      tags: content.tags,
      alt_text: content.alt_text,
      primary_color: content.primary_color,
      occasion: content.occasion,
      celebration: content.celebration,
      subject: content.subject
    });

  } catch (error) {
    console.error('Error generating AI metadata:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
