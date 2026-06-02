import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ETSY_TAXONOMY_MAP } from '@/lib/etsyConstants';

// --- PROPERTY MAPS ---

const SECTION_MAP: Record<string, number> = {
  "Comfort Colors 1717": 58682515,
  "Gilden 5000": 58682519,
  "Digital Prints": 58753559
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
          when_made: data.when_made || "2020_2024",
          taxonomy_id: ETSY_TAXONOMY_MAP[data.category as string] || 2078,
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
      const taxonomyId = ETSY_TAXONOMY_MAP[data.category as string] || 2078;
      
      // We must fetch the taxonomy properties from Etsy to resolve the value strings to value IDs
      const taxonomyRes = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, {
        headers: {
          'x-api-key': `${apiKey}:${sharedSecret}`,
          'Content-Type': 'application/json'
        }
      });
      const taxonomyProps = taxonomyRes.data.results || [];

      // Find dynamic properties in the payload
      for (const key of Object.keys(data)) {
        if (key.startsWith("prop_") && data[key]) {
          const propId = parseInt(key.replace("prop_", ""), 10);
          const valString = data[key] as string;
          
          const propDef = taxonomyProps.find((p: any) => p.property_id === propId);
          if (propDef && propDef.possible_values) {
            const valDef = propDef.possible_values.find((v: any) => v.name === valString);
            if (valDef) {
              propertyUpdates.push({ id: propId, value_ids: [valDef.value_id], values: [valString] });
            }
          }
        }
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
            let finalBuffer: any = fs.readFileSync(absolutePath);
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

            const blob = new Blob([finalBuffer], { type: mimeType });
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
            
            const blob = new Blob([fileBuffer], { type: mimeType });
            
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
      fs.writeFileSync('C:\\Users\\This PC\\Gravity\\SIDE APPS\\workstation-v2\\latest_error.json', JSON.stringify({
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
