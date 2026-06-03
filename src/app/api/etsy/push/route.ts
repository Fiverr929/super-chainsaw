import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// --- PROPERTY MAPS ---
const TAXONOMY_MAP: Record<string, number> = {
  "Store Graphics": 769,
  "Digital Prints": 2078,
  "Digital Planners": 354,
  "Templates": 1874,
  "Clip Art": 7663,
  "Wall Art": 2078,
  "Digital Patterns": 7192,
  "Fonts": 10620,
  "Logos & Branding": 1877,
  "Social Media Templates": 12486,
  "Website Templates": 2818,
  "Digital Paper": 1251,
  "SVG Files": 7663,
  "Lightroom Presets": 12107
};

const SECTION_MAP: Record<string, number> = {
  "Comfort Colors 1717": 58682515,
  "Gilden 5000": 58682519,
  "Digital Prints": 58753559
};

const PROP_PRIMARY_COLOR: Record<string, number> = {
  "Beige": 1213, "Black": 1, "Blue": 2, "Bronze": 1216, "Brown": 3, "Clear": 1219, "Copper": 1218, "Gold": 1214, "Gray": 5, "Green": 4, "Orange": 6, "Pink": 7, "Purple": 8, "Rainbow": 1220, "Red": 9, "Rose gold": 1217, "Silver": 1215, "White": 10, "Yellow": 11,
};

const PROP_OCCASION: Record<string, number> = {
  "1st birthday": 2773, "Anniversary": 12, "Baby shower": 13, "Bachelor party": 14, "Bachelorette party": 15, "Back to school": 16, "Baptism": 17, "Bar & Bat Mitzvah": 18, "Birthday": 19, "Bridal shower": 20, "Confirmation": 21, "Divorce & breakup": 26, "Engagement": 22, "First Communion": 23, "Graduation": 24, "Grief & mourning": 25, "House warming": 27, "LGBTQ pride": 2774, "Moving": 50, "Pet loss": 28, "Retirement": 31, "Wedding": 32,
};

const PROP_HOLIDAY: Record<string, number> = {
  "Christmas": 35, "Cinco de Mayo": 36, "Easter": 37, "Eid": 4564, "Father's Day": 38, "Halloween": 39, "Hanukkah": 40, "Holi": 4563, "Independence Day": 41, "Kwanzaa": 42, "Lunar New Year": 34, "Mother's Day": 43, "New Year's": 44, "Passover": 47, "Ramadan": 5128, "St Patrick's Day": 45, "Thanksgiving": 46, "Valentine's Day": 48, "Veterans Day": 49,
};

const PROP_ART_SUBJECT: Record<string, number> = {
  "Abstract & geometric": 2817, "Animal": 2558, "Anime & cartoon": 2559, "Architecture & cityscape": 3641, "Beach & tropical": 406, "Bollywood": 4566, "Comics & manga": 2562, "Educational": 5182, "Fantasy & Sci Fi": 421, "Fashion": 3691, "Flowers": 2952, "Food & drink": 425, "Geography & locale": 2957, "Horror & gothic": 2953, "Humorous saying": 2954, "Inspirational saying": 2955, "Landscape & scenery": 3644, "LGBTQ pride": 2774, "Love & friendship": 439, "Military": 2549, "Movie": 3692, "Music": 442, "Nautical": 443, "Nudes": 3695, "Patriotic & flags": 447, "People & portrait": 3694, "Pet portrait": 2340, "Phrase & saying": 2962, "Plants & trees": 2530, "Religious": 456, "Science & tech": 458, "Sports & fitness": 461, "Stars & celestial": 2532, "Steampunk": 2533, "Superhero": 2571, "Travel & transportation": 470, "TV": 3693, "Typography & symbols": 5181, "Video game": 2575, "Western & cowboy": 474, "Zodiac": 2534,
};

export async function POST(req: Request) {
  let data: Record<string, string> = {};
  try {
    data = await req.json();
    
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = process.env.ETSY_REFRESH_TOKEN;
    const shopId = process.env.ETSY_SHOP_ID;

    if (!apiKey || !sharedSecret || !refreshToken || !shopId) {
      return NextResponse.json({ error: 'Missing Etsy API credentials in .env.local' }, { status: 400 });
    }

    // 1. Get Access Token
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: apiKey,
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;
    const headers = {
      'x-api-key': `${apiKey}:${sharedSecret}`,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    let listingId = data.listing_id;

    if (data.updateType === "all" || data.updateType === "text") {
      // 2. Create or Update Draft Listing
        const payload: Record<string, unknown> = {
          quantity: parseInt(data.quantity) || 999,
          title: data.title ? data.title.substring(0, 140) : undefined,
          description: data.description,
          price: parseFloat(data.price) || 0.0,
          who_made: data.who_made || "i_did",
          when_made: data.when_made || "2020_2026",
          taxonomy_id: TAXONOMY_MAP[data.category as string] || 2078,
          is_supply: data.is_supply === "true",
          type: "download"
        };

      if (data.section && SECTION_MAP[data.section as string]) {
        payload.shop_section_id = SECTION_MAP[data.section as string];
      }

      if (data.tags) {
        payload.tags = data.tags.split(",")
          .map((s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().substring(0, 20))
          .filter((s: string) => s.length > 0)
          .slice(0, 13);
      }

      if (payload.tags && (payload.tags as string[]).length > 0) {
        if (!payload.title || !payload.description) {
          return NextResponse.json({
            error: 'Failed to push to Etsy',
            details: 'Etsy requires both a Title and a Description to be set when tags are present. Please generate or enter these fields before pushing.'
          }, { status: 400 });
        }
      }

      if (listingId) {
         // Update
         await axios.patch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, payload, { headers });
      } else {
         // Create
         const listingRes = await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings`, payload, { headers });
         listingId = listingRes.data.listing_id;
      }

      // 3. Update Properties
      const propertyUpdates = [];
      if (data.primary_color && PROP_PRIMARY_COLOR[data.primary_color as string]) {
        propertyUpdates.push({ id: 200, value_ids: [PROP_PRIMARY_COLOR[data.primary_color as string]], values: [data.primary_color as string] });
      }
      if (data.occasion && PROP_OCCASION[data.occasion as string]) {
        propertyUpdates.push({ id: 46803063641, value_ids: [PROP_OCCASION[data.occasion as string]], values: [data.occasion as string] });
      }
      if (data.celebration && PROP_HOLIDAY[data.celebration as string]) {
        propertyUpdates.push({ id: 46803063659, value_ids: [PROP_HOLIDAY[data.celebration as string]], values: [data.celebration as string] });
      }
      if (data.subject && PROP_ART_SUBJECT[data.subject as string]) {
        propertyUpdates.push({ id: 400394338806, value_ids: [PROP_ART_SUBJECT[data.subject as string]], values: [data.subject as string] });
      }

      for (const prop of propertyUpdates) {
        try {
          await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/${prop.id}`, 
            { value_ids: prop.value_ids, values: prop.values }, 
            { headers }
          );
        } catch (err: unknown) {
          const error = err as { response?: { data?: unknown }, message?: string };
          console.warn(`Failed to update property ${prop.id}. Ignoring.`, error.response?.data || error.message);
        }
      }
    } else {
      if (!listingId) throw new Error("Cannot update media without a valid listing ID");
    }

    // Helper to resolve paths dynamically
    const resolveFilePath = (fileUrl: string) => {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:')) {
         return null; // We only support local files for now
      }
      if (fileUrl.match(/^[A-Za-z]:/)) {
         return fileUrl; // Already absolute Windows path
      }
      // If it starts with a slash, it's relative to the public folder
      if (fileUrl.startsWith('/')) {
         return path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', fileUrl);
      }
      // Otherwise assume it's relative to project root
      return path.join(/*turbopackIgnore: true*/ process.cwd(), fileUrl);
    };

    // Helper for smart text truncation
    const truncateText = (text: string, maxLen: number) => {
       if (!text || text.length <= maxLen) return text;
       const truncated = text.substring(0, maxLen);
       const lastSpace = truncated.lastIndexOf(' ');
       if (lastSpace > 0) return truncated.substring(0, lastSpace);
       return truncated;
    };

    if (data.updateType === "all" || data.updateType === "images") {
      // 4. Upload Preview Images
      // We use axios exclusively so unknown network or 4xx/5xx failure correctly throws an error instead of silently passing
      if (data.images) {
        let existingImages: { listing_image_id: number }[] = [];
        if (listingId) {
          try {
            const existingImagesRes = await axios.get(`https://api.etsy.com/v3/application/listings/${listingId}/images`, { headers });
            existingImages = existingImagesRes.data.results || [];
            
            // Delete all EXCEPT the first one (Etsy requires at least 1 image at all times)
            for (let i = 1; i < existingImages.length; i++) {
              try {
                await axios.delete(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images/${existingImages[i].listing_image_id}`, { headers });
              } catch (delErr: unknown) {
                if ((delErr as {response?: {status?: number}}).response?.status !== 404) throw delErr;
              }
            }
          } catch (err: unknown) {
             const error = err as { response?: { data?: unknown }, message?: string };
             console.warn("Failed to fetch/delete existing images:", error.response?.data || error.message);
          }
        }

        const imageUrls = data.images.split(",").map((s: string) => s.trim()).filter(Boolean);
        let rank = 1;
        for (const imgUrl of imageUrls) {
          const absolutePath = resolveFilePath(imgUrl);
          if (absolutePath && fs.existsSync(absolutePath)) {
            let finalBuffer: Buffer = fs.readFileSync(absolutePath);
            let ext = path.extname(absolutePath).toLowerCase();
            let mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            let fileName = path.basename(absolutePath);

            // Compress massive images (>5MB) into high-quality JPEG
            if (finalBuffer.length > 5 * 1024 * 1024) {
               finalBuffer = await sharp(finalBuffer).jpeg({ quality: 85 }).toBuffer();
               mimeType = 'image/jpeg';
               ext = '.jpg';
               fileName = fileName.substring(0, fileName.lastIndexOf('.')) + ext;
            }

            if (finalBuffer.length > 20 * 1024 * 1024) {
               throw new Error(`Image ${fileName} exceeds the 20MB limit even after compression.`);
            }

            const blob = new Blob([new Uint8Array(finalBuffer)], { type: mimeType });
            const formData = new FormData();
            formData.append("image", blob, fileName);
            formData.append("rank", rank.toString());
            const altTexts = data.alt_text ? data.alt_text.split('|').map((s: string) => s.trim()) : [];
            const currentAltText = altTexts[rank - 1] || "";
            
            if (currentAltText) {
               formData.append("alt_text", truncateText(currentAltText, 250));
            }

            const uploadHeaders: Record<string, string> = { ...headers };
            delete uploadHeaders['Content-Type'];

            // Use axios so it properly throws on 4xx/5xx failures
            await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`, formData, {
              headers: uploadHeaders
            });
            
            // Once the first new image is successfully uploaded, we can safely delete the lingering old image
            if (rank === 1 && existingImages.length > 0) {
                try {
                   await axios.delete(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images/${existingImages[0].listing_image_id}`, { headers });
                } catch (delErr: unknown) {
                   if ((delErr as {response?: {status?: number}}).response?.status !== 404) throw delErr;
                }
            }
            
            rank++;
          }
        }
      }

    }

    if (data.updateType === "all" || data.updateType === "files") {
      // 5. Upload Digital File
      if (data.digital_file) {
        if (listingId) {
          // If updating, first delete existing files
          try {
            const existingFilesRes = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`, { headers });
            const existingFiles = existingFilesRes.data;
            for (const f of existingFiles.results || []) {
              try {
                await axios.delete(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files/${f.listing_file_id}`, { headers });
              } catch (delErr: unknown) {
                if ((delErr as {response?: {status?: number}}).response?.status !== 404) throw delErr;
              }
            }
          } catch (err: unknown) {
            const error = err as { response?: { data?: unknown }, message?: string };
            console.warn("Failed to fetch/delete existing files:", error.response?.data || error.message);
          }
        }

        // Etsy strictly limits digital files to 5 max per listing
        const files = data.digital_file.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 5);
        for (const fileUrl of files) {
          const absolutePath = resolveFilePath(fileUrl);
          if (absolutePath && fs.existsSync(absolutePath)) {
            const fileBuffer = fs.readFileSync(absolutePath);
            const ext = path.extname(absolutePath).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (ext === '.zip') mimeType = 'application/zip';
            else if (ext === '.pdf') mimeType = 'application/pdf';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.rar') mimeType = 'application/x-rar-compressed';
            else if (ext === '.svg') mimeType = 'image/svg+xml';
            
            const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
            
            const formData = new FormData();
            formData.append("file", blob, path.basename(absolutePath));
            formData.append("name", path.basename(absolutePath));

            const uploadHeaders: Record<string, string> = { ...headers };
            delete uploadHeaders['Content-Type'];

            // Use axios so it properly throws on 4xx/5xx failures
            await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`, formData, {
              headers: uploadHeaders
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, listing_id: listingId });
  } catch (err: unknown) {
    const errorDetails = (err as { response?: { data?: unknown } }).response?.data || (err as Error).message;
    console.error("Etsy Push Error:", JSON.stringify(errorDetails, null, 2));
    
    // Save to file for debugging
    try {
      fs.writeFileSync(path.join(process.cwd(), 'latest_error.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        requestBody: data,
        error: errorDetails
      }, null, 2));
    } catch (e) {
      console.error("Failed to write error log", e);
    }

    return NextResponse.json({ error: 'Failed to push to Etsy', details: errorDetails }, { status: 500 });
  }
}
