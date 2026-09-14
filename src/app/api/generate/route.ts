import { NextResponse } from 'next/server';
import fs from 'fs';
import sharp from 'sharp';
import { categorySupportsOccasion, categorySupportsCelebration, categorySupportsSubject, categorySupportsGraphic } from '@/lib/etsyConstants';
import { buildGeneratedMetadataResponse } from '@/lib/listingWorkflow';
import { resolvePublicAssetPath } from '@/lib/serverPaths';
import { resolveGeminiApiKey, missingApiKeyResponse, callGeminiGenerateContent } from '@/lib/geminiApi';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { context, imagePaths = [], existingData = {}, aiRules = {}, forceRegenerate = [] } = body;

    const apiKey = resolveGeminiApiKey(request, body.apiKey);

    if (!apiKey) {
      return missingApiKeyResponse();
    }

    // Resolve and read local images
    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    for (const fileUrl of imagePaths) {
       const absolutePath = resolvePublicAssetPath(fileUrl);
       if (absolutePath && fs.existsSync(absolutePath)) {
          const fileBuffer = fs.readFileSync(absolutePath);
          
          // Compress the image to speed up AI payload
          const compressedBuffer = await sharp(fileBuffer)
            .resize(512) // Resize to max width 512px
            .jpeg({ quality: 80 }) // Force JPEG to save space
            .toBuffer();
            
          const mimeType = 'image/jpeg'; // Since we forced JPEG
          
          imageParts.push({
             inlineData: {
                mimeType,
                data: compressedBuffer.toString("base64")
             }
          });
       }
    }

    const defaultTitleRule = "a highly optimized Etsy Title. CRITICAL: MUST be exactly 140 characters or less including spaces";
    const defaultDescRule = "CRITICAL: Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.";
    const defaultTagRule = "EXACTLY 13 Etsy Tags as a comma-separated string. CRITICAL: Each individual tag MUST be 20 characters or less. ONLY use letters, numbers, and spaces. NO special characters.";

    const missingFields: string[] = [];
    if (!existingData.title || forceRegenerate.includes('title')) missingFields.push(`"title" (${aiRules.title || defaultTitleRule})`);
    if (!existingData.description || forceRegenerate.includes('description')) missingFields.push(`"description" (${aiRules.description || defaultDescRule})`);
    if (!existingData.tags || forceRegenerate.includes('tags')) missingFields.push(`"tags" (${aiRules.tags || defaultTagRule})`);
    if (existingData.primary_color === "Auto" || forceRegenerate.includes('primary_color')) missingFields.push('"primary_color"');
    if (existingData.secondary_color === "Auto" || forceRegenerate.includes('secondary_color')) missingFields.push('"secondary_color"');
    if (existingData.materials === "Auto" || forceRegenerate.includes('materials')) missingFields.push('"materials"');
    if (existingData.sleeve_length === "Auto" || forceRegenerate.includes('sleeve_length')) missingFields.push('"sleeve_length"');
    if (existingData.neckline === "Auto" || forceRegenerate.includes('neckline')) missingFields.push('"neckline"');
    if (existingData.clothing_style === "Auto" || forceRegenerate.includes('clothing_style')) missingFields.push('"clothing_style"');
    if (existingData.capacity === "Auto" || forceRegenerate.includes('capacity')) missingFields.push('"capacity"');
    if (existingData.dishwasher_safe === "Auto" || forceRegenerate.includes('dishwasher_safe')) missingFields.push('"dishwasher_safe"');
    if (existingData.microwave_safe === "Auto" || forceRegenerate.includes('microwave_safe')) missingFields.push('"microwave_safe"');
    if (existingData.orientation === "Auto" || forceRegenerate.includes('orientation')) missingFields.push('"orientation"');
    if (existingData.framing === "Auto" || forceRegenerate.includes('framing')) missingFields.push('"framing"');
    if (existingData.aspect_ratio === "Auto" || forceRegenerate.includes('aspect_ratio')) missingFields.push('"aspect_ratio"');

    
    if ((existingData.occasion === "Auto" || forceRegenerate.includes('occasion')) && categorySupportsOccasion(existingData.category)) missingFields.push('"occasion"');
    if ((existingData.celebration === "Auto" || forceRegenerate.includes('celebration')) && categorySupportsCelebration(existingData.category)) missingFields.push('"celebration"');
    if ((existingData.subject === "Auto" || forceRegenerate.includes('subject')) && categorySupportsSubject(existingData.category)) missingFields.push('"subject"');
    if ((existingData.graphic === "Auto" || forceRegenerate.includes('graphic')) && categorySupportsGraphic(existingData.category)) missingFields.push('"graphic"');

    const systemPrompt = `You are a professional Etsy copywriter and SEO expert. 
You will receive a context or prompt about a product.

CRITICAL ETSY COMPLIANCE RULE: Etsy prohibits more than 3 acronyms or fully capitalized words in a title. You MUST limit fully capitalized acronyms (like SVG, PNG, DTG, TV, Y2K) to a maximum of 2 per title. Any additional acronyms must use Title Case (e.g., Svg, Png, Tv).

Your job is to generate ONLY the missing fields. Do not generate fields that already exist or were not requested.
The fields you need to generate are:
${missingFields.length > 0 ? missingFields.map(f => "- " + f).join("\n") : "None"}

If the list of fields to generate is "None", you should return an empty JSON object {}.

For taxonomy attributes, if none fit perfectly, leave the string empty (""):
- primary_color: Choose exactly one from: "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow".
- secondary_color: Choose exactly one from: "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Rose gold", "Silver", "White", "Yellow".
- materials: A comma-separated string of materials (e.g., "100% Cotton", "Ceramic").
- sleeve_length: Choose exactly one from: "Short sleeve", "Long sleeve", "Sleeveless", "3/4 sleeve", "Half sleeve".
- neckline: Choose exactly one from: "Crew neck", "V-neck", "Hooded", "Collared", "Off the shoulder", "Scoop neck".
- clothing_style: Choose exactly one from: "Athletic", "Casual", "Goth", "Minimalist", "Retro", "Streetwear".
- capacity: Choose exactly one from: "11 oz", "15 oz", "20 oz", "30 oz".
- dishwasher_safe: Choose exactly one from: "true", "false".
- microwave_safe: Choose exactly one from: "true", "false".
- orientation: Choose exactly one from: "Horizontal", "Vertical", "Square", "Round".
- framing: Choose exactly one from: "Framed", "Unframed".
- aspect_ratio: Choose exactly one from: "1:1", "1:2", "2:3", "3:4", "4:5", "5:7 (ISO ratio)", "11:14", "16:9".
- occasion: Choose exactly one from: "1st birthday", "Anniversary", "Baby shower", "Back to school", "Baptism", "Bar & Bat Mitzvah", "Birthday", "Bridal shower", "Confirmation", "Divorce & breakup", "Engagement", "First Communion", "Graduation", "Grief & mourning", "House warming", "LGBTQ pride", "Moving", "Pet loss", "Retirement", "Wedding".
- celebration: Choose exactly one from: "Christmas", "Cinco de Mayo", "Easter", "Eid", "Father's Day", "Halloween", "Hanukkah", "Holi", "Independence Day", "Kwanzaa", "Lunar New Year", "Mother's Day", "New Year's", "Passover", "Ramadan", "St Patrick's Day", "Thanksgiving", "Valentine's Day", "Veterans Day".
- subject: Choose exactly one from: "Abstract & geometric", "Animal", "Anime & cartoon", "Architecture & cityscape", "Beach & tropical", "Comics & manga", "Educational", "Fantasy & Sci Fi", "Fashion", "Flowers", "Food & drink", "Horror & gothic", "Humorous saying", "Inspirational saying", "Landscape & scenery", "Love & friendship", "Movie", "Music", "Nautical", "People & portrait", "Pet portrait", "Phrase & saying", "Plants & trees", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Travel & transportation", "TV", "Typography & symbols", "Video game", "Western & cowboy", "Zodiac".
- graphic: Choose exactly one from: "Abstract & geometric", "Animal", "Anime & cartoon", "Beach & tropical", "Bollywood", "Brand & logo", "Comics & manga", "Fantasy & Sci Fi", "Fitspiration", "Flowers", "Food & drink", "Geography & locale", "Horror & gothic", "Humorous saying", "Inspirational saying", "LGBTQ pride", "Literary", "Love & friendship", "Military & historical", "Movie", "Music", "Nautical", "Patriotic & flags", "Phrase & saying", "Plants & trees", "Politics & elections", "Protest", "Punk & tattoos", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Surf & skate", "Travel & transportation", "TV", "Video game", "Western & cowboy", "Zodiac".

Return ONLY valid JSON with no markdown formatting. The JSON MUST contain ALL of the exact keys listed in "The fields you need to generate are:", even if the value is an empty string. Do not omit any requested keys.
Format example: { "title": "...", "primary_color": "...", "secondary_color": "...", "materials": "...", "sleeve_length": "...", "occasion": "", "celebration": "", "subject": "", "graphic": "" }`;

    let finalPrompt = systemPrompt;
    if (imageParts.length > 0) {
       missingFields.push(`"alt_texts" (A JSON array of exactly ${imageParts.length} strings, where each string is the SEO-optimized Alt Text for the corresponding image in the exact order they were provided)`);
       finalPrompt = systemPrompt.replace(
           "Your job is to generate ONLY the missing fields.", 
           "You have been provided with images of the actual product. Your job is to examine the images and generate ONLY the missing fields based on what the product actually looks like."
       );
       finalPrompt = finalPrompt.replace(
           "The fields you need to generate are:",
           `The fields you need to generate are:\n- "alt_texts" (A JSON array of exactly ${imageParts.length} strings, where each string is the SEO-optimized Alt Text for the corresponding image in the exact order they were provided)`
       );
    }

    const data = await callGeminiGenerateContent({
      apiKey,
      model: 'gemini-2.5-flash',
      contents: [
        { 
          role: "user",
          parts: [{ text: `${finalPrompt}\n\nContext: ${context}` }, ...imageParts] 
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      return NextResponse.json({ error: "Google AI Studio returned an empty response." }, { status: 500 });
    }
    
    // Robust parsing to strip out markdown formatting if the LLM includes it
    const cleanedText = contentText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim();
    
    let content;
    try {
      content = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON:", cleanedText, parseError);
      return NextResponse.json({ error: "AI returned malformed JSON data. Please try again." }, { status: 500 });
    }

    // Backend Failsafe: Etsy rejects titles with >3 acronyms/ALL CAPS words.
    if (content.title && typeof content.title === 'string') {
      const acronymRegex = /\b[A-Z]{2,}\b/g;
      const matches = [...content.title.matchAll(acronymRegex)];
      if (matches.length > 3) {
        let newTitle = "";
        let lastIndex = 0;
        // Keep the first 2 fully capitalized, convert the rest to Title Case
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            newTitle += content.title.substring(lastIndex, match.index);
            if (i < 2) {
                newTitle += match[0];
            } else {
                newTitle += match[0].charAt(0) + match[0].slice(1).toLowerCase();
            }
            lastIndex = (match.index as number) + match[0].length;
        }
        newTitle += content.title.substring(lastIndex);
        content.title = newTitle;
      }
    }

    // Enforce Etsy's 140 character limit
    if (content.title && typeof content.title === 'string') {
      if (content.title.length > 140) {
        content.title = content.title.substring(0, 140).replace(/\s+\S*$/, '').trim();
      }
    }

    return NextResponse.json(buildGeneratedMetadataResponse(content));

  } catch (error) {
    console.error('Error generating AI metadata:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
