/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getEtsyRefreshToken, saveEtsyRefreshToken } from '@/lib/etsyTokenStore';

// --- AXIOS RETRY HELPER FOR RATE LIMITS ---
async function axiosWithRetry(config: any, retries = 3, delay = 2000): Promise<any> {
  try {
    return await axios(config);
  } catch (err: any) {
    if (err.response?.status === 429 && retries > 0) {
      console.warn(`Rate limit hit (429) on ${config.url || 'request'}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return axiosWithRetry(config, retries - 1, delay * 2);
    }
    throw err;
  }
}

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
  "Lightroom Presets": 12107,
  "T-Shirts": 559,
  "Sweatshirts & Hoodies": 2198,
  "Mugs & Drinkware": 1062,
  "Stickers & Decals": 1326,
  "Posters & Prints": 119,
  "Tote Bags": 190,
  "Hats & Caps": 1646
};

const VALUE_IDS_MAP: Record<number, Record<string, number>> = {
  200: {
    "Beige": 1213, "Black": 1, "Blue": 2, "Bronze": 1216, "Brown": 3, "Clear": 1219, "Copper": 1218, "Gold": 1214, "Gray": 5, "Green": 4, "Orange": 6, "Pink": 7, "Purple": 8, "Rainbow": 1220, "Red": 9, "Rose gold": 1217, "Silver": 1215, "White": 10, "Yellow": 11
  },
  52047899002: {
    "Beige": 1213, "Black": 1, "Blue": 2, "Bronze": 1216, "Brown": 3, "Clear": 1219, "Copper": 1218, "Gold": 1214, "Gray": 5, "Green": 4, "Orange": 6, "Pink": 7, "Purple": 8, "Rainbow": 1220, "Red": 9, "Rose gold": 1217, "Silver": 1215, "White": 10, "Yellow": 11
  },
  46803063641: {
    "1st birthday": 2773, "Anniversary": 12, "Baby shower": 13, "Bachelor party": 14, "Bachelorette party": 15, "Back to school": 16, "Baptism": 17, "Bar & Bat Mitzvah": 18, "Birthday": 19, "Bridal shower": 20, "Confirmation": 21, "Divorce & breakup": 26, "Engagement": 22, "First Communion": 23, "Graduation": 24, "Grief & mourning": 25, "House warming": 27, "LGBTQ pride": 2774, "Moving": 50, "Pet loss": 28, "Retirement": 31, "Wedding": 32
  },
  46803063659: {
    "Christmas": 35, "Cinco de Mayo": 36, "Easter": 37, "Eid": 4564, "Father's Day": 38, "Halloween": 39, "Hanukkah": 40, "Holi": 4563, "Independence Day": 41, "Kwanzaa": 42, "Lunar New Year": 34, "Mother's Day": 43, "New Year's": 44, "Passover": 47, "Ramadan": 5128, "St Patrick's Day": 45, "Thanksgiving": 46, "Valentine's Day": 48, "Veterans Day": 49
  },
  400394338806: {
    "Abstract & geometric": 2817, "Animal": 2558, "Anime & cartoon": 2559, "Architecture & cityscape": 3641, "Beach & tropical": 406, "Bollywood": 4566, "Comics & manga": 2562, "Educational": 5182, "Fantasy & Sci Fi": 421, "Fashion": 3691, "Flowers": 2952, "Food & drink": 425, "Geography & locale": 2957, "Horror & gothic": 2953, "Humorous saying": 2954, "Inspirational saying": 2955, "Landscape & scenery": 3644, "LGBTQ pride": 2774, "Love & friendship": 439, "Military": 2549, "Movie": 3692, "Music": 442, "Nautical": 443, "Nudes": 3695, "Patriotic & flags": 447, "People & portrait": 3694, "Pet portrait": 2340, "Phrase & saying": 2962, "Plants & trees": 2530, "Religious": 456, "Science & tech": 458, "Sports & fitness": 461, "Stars & celestial": 2532, "Steampunk": 2533, "Superhero": 2571, "Travel & transportation": 470, "TV": 3693, "Typography & symbols": 5181, "Video game": 2575, "Western & cowboy": 474, "Zodiac": 2534
  },
  406291158455: {
    "Horizontal": 3461, "Round": 364, "Square": 371, "Vertical": 3460
  },
  145330288558: {
    "Framed": 2341, "Unframed": 2342
  },
  570246213622: {
    "1:1": 5178, "1:2": 5170, "2:3": 5179, "3:4": 5171, "4:5": 5174, "5:7 (ISO ratio)": 5183, "11:14": 5172, "16:9": 5180
  },
  145330288592: {
    "Bathroom": 2356, "Bedroom": 2354, "Dorm": 3946, "Entryway": 2353, "Game room": 3947, "Kids": 2357, "Kitchen & dining": 2350, "Laundry": 2359, "Living room": 2351, "Nursery": 2358, "Office": 2352
  },
  145330288652: {
    "Art deco": 2382, "Art nouveau": 2383, "Bohemian & eclectic": 2384, "Coastal & tropical": 2385, "Contemporary": 2387, "Country & farmhouse": 2388, "Gothic": 2409, "Industrial & utility": 2390, "Lodge": 2391, "Mid-century": 2392, "Minimalist": 2393, "Rustic & primitive": 2395, "Southwestern": 2398, "Victorian": 2399
  },
  148789511775: {
    "Yes": 2315, "No": 2316
  },
  325502675244: {
    "Sleeveless": 2672, "Short sleeve": 2668, "Half sleeve": 2669, "3/4 sleeve": 2670, "Long sleeve": 2671
  },
  325502675262: {
    "Crew neck": 2678, "Crew": 2678, "V-neck": 2691, "Hooded": 2682, "Mockneck": 2682, "Off the shoulder": 2683, "Scoop neck": 2686, "Scoop": 2686
  },
  325502673988: {
    "Athletic": 2544, "Casual": 2556, "Goth": 2409, "Minimalist": 2393, "Retro": 2556, "Streetwear": 2556
  },
  47626760110: {
    "Yes": 1094, "No": 1095
  },
  47626760308: {
    "Yes": 1144, "No": 1145
  },
  332797777099: {
    "Abstract & geometric": 2817, "Animal": 2558, "Anime & cartoon": 2559, "Bollywood": 4566, "Brand & logo": 2963, "Comics & manga": 2562, "Fantasy & Sci Fi": 421, "Fitspiration": 2951, "Flowers": 2952, "Food & drink": 425, "Geography & locale": 2957, "Horror & gothic": 2953, "Humorous saying": 2954, "Inspirational saying": 2955, "LGBTQ pride": 2774, "Literary": 2956, "Military & historical": 2958, "Movie": 3692, "Music": 442, "Nautical": 443, "Patriotic & flags": 447, "Phrase & saying": 2962, "Plants & trees": 2530, "Politics & elections": 2961, "Protest": 2959, "Religious": 456, "Science & tech": 458, "Sports & fitness": 461, "Stars & celestial": 2532, "Superhero": 2571, "Surf & skate": 2960, "Travel & transportation": 470, "TV": 3693, "Video game": 2575
  },
  396998957792: {
    "Abstract & geometric": 2817, "Animal": 2558, "Anime & cartoon": 2559, "Beach & tropical": 406, "Bollywood": 4566, "Comics & manga": 2562, "Fantasy & Sci Fi": 421, "Fitspiration": 2951, "Flowers": 2952, "Food & drink": 425, "Geography & locale": 2957, "Horror & gothic": 2953, "Humorous saying": 2954, "Inspirational saying": 2955, "LGBTQ pride": 2774, "Literary": 2956, "Love & friendship": 439, "Military & historical": 2958, "Movie": 3692, "Music": 442, "Nautical": 443, "Patriotic & flags": 447, "Phrase & saying": 2962, "Plants & trees": 2530, "Politics & elections": 2961, "Protest": 2959, "Punk & tattoos": 454, "Religious": 456, "Science & tech": 458, "Sports & fitness": 461, "Stars & celestial": 2532, "Steampunk": 2533, "Superhero": 2571, "Travel & transportation": 470, "TV": 3693, "Video game": 2575, "Western & cowboy": 474, "Zodiac": 2534
  },
  47626760084: {
    "Animals": 397, "Animal": 397, "Beach & tropical": 406, "Bugs & insects": 4944, "Evil eye": 2524, "Fall": 1065, "Fantasy & Sci Fi": 421, "Floral": 2525, "Flowers": 2525, "Food & drink": 425, "Geometric": 2526, "Infinity": 2527, "Keys & locks": 2528, "Letters & words": 438, "Love & friendship": 439, "Luck": 2529, "Music": 442, "Nautical": 443, "Patriotic & flags": 447, "People": 448, "Plants & trees": 2530, "Punk & tattoos": 454, "Religious": 456, "Science & tech": 458, "Southwestern": 2398, "Sports & fitness": 461, "Spring": 462, "Stars & celestial": 2532, "Steampunk": 2533, "Summer": 466, "Travel & transportation": 470, "Western & cowboy": 474, "Winter": 475, "Zodiac": 2534
  }
};

const resolveMaterialId = (matName: string): number | null => {
  const name = matName.toLowerCase().trim();
  if (name.includes("cotton")) return 102;
  if (name.includes("polyester")) return 210;
  if (name.includes("ceramic")) return 83;
  if (name.includes("canvas")) return 74;
  if (name.includes("wood")) return 286;
  if (name.includes("metal")) return 174;
  if (name.includes("glass")) return 138;
  if (name.includes("enamel")) return 116;
  if (name.includes("plastic")) return 206;
  if (name.includes("vinyl")) return 280;
  if (name.includes("paper")) return 196;
  if (name.includes("leather")) return 161;
  return null;
};

export async function POST(req: Request) {
  let data: Record<string, string> = {};
  let listingId: string | undefined = undefined;
  let isNewListing = false;
  let headers: Record<string, string> = {};
  let shopId = '';
  let readinessStateId: number | undefined = undefined;

  try {
    data = await req.json();
    
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = getEtsyRefreshToken();
    shopId = process.env.ETSY_SHOP_ID || '';

    if (!apiKey || !sharedSecret || !refreshToken || !shopId) {
      return NextResponse.json({ error: 'Missing Etsy API credentials in .env.local' }, { status: 400 });
    }

    // 1. Get Access Token
    const tokenRes = await axiosWithRetry({
      url: 'https://api.etsy.com/v3/public/oauth/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: apiKey,
        refresh_token: refreshToken
      })
    });
    
    const accessToken = tokenRes.data.access_token;
    const newRefreshToken = tokenRes.data.refresh_token;
    if (newRefreshToken) {
      saveEtsyRefreshToken(newRefreshToken);
    }

    headers = {
      'x-api-key': `${apiKey}:${sharedSecret}`,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    listingId = data.listing_id;
    isNewListing = !listingId;

    if (data.updateType === "all" || data.updateType === "text") {
      // 2. Resolve listing sections dynamically from Etsy
      let shopSectionId: number | undefined = undefined;
      if (data.section) {
        try {
          const sectionsRes = await axiosWithRetry({
            url: `https://api.etsy.com/v3/application/shops/${shopId}/sections`,
            method: 'GET',
            headers
          });
          const matchingSection = (sectionsRes.data.results || []).find(
            (s: { title: string }) => s.title.toLowerCase() === data.section.toLowerCase()
          );
          if (matchingSection) {
            shopSectionId = matchingSection.shop_section_id;
          }
        } catch (err) {
          console.warn("Failed to fetch shop sections dynamically:", err);
        }
      }

      // Resolve shipping profile dynamically from Etsy if physical listing
      const isPhysical = data.listingType === 'physical';
      let shippingProfileId: number | undefined = undefined;
      if (isPhysical && data.shipping_profile) {
        if (/^\d+$/.test(data.shipping_profile.trim())) {
          shippingProfileId = parseInt(data.shipping_profile.trim());
        } else {
          try {
            const profilesRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/shops/${shopId}/shipping-profiles`,
              method: 'GET',
              headers
            });
            const matchingProfile = (profilesRes.data.results || []).find(
              (p: { title: string }) => p.title.toLowerCase() === data.shipping_profile.toLowerCase()
            );
            if (matchingProfile) {
              shippingProfileId = matchingProfile.shipping_profile_id;
            }
          } catch (err) {
            console.warn("Failed to fetch shipping profiles dynamically:", err);
          }
        }
      }

      // Resolve processing profile (readiness state) dynamically from Etsy if physical listing
      readinessStateId = undefined;
      if (isPhysical && data.readiness_state_id) {
        const val = String(data.readiness_state_id).trim();
        if (/^\d+$/.test(val)) {
          readinessStateId = parseInt(val);
        } else {
          try {
            const res = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`,
              method: 'GET',
              headers
            });
            const matching = (res.data.results || []).find((p: any) => {
              const label = `${p.readiness_state} (${p.processing_days_display_label || (p.min_processing_days + '-' + p.max_processing_days + ' days')})`;
              return label.toLowerCase() === val.toLowerCase();
            });
            if (matching) {
              readinessStateId = matching.readiness_state_id;
            }
          } catch (err) {
            console.warn("Failed to fetch readiness states dynamically:", err);
          }
        }
      }

      // 3. Create or Update Draft Listing
      const payload: Record<string, unknown> = {
        quantity: parseInt(data.quantity) || 999,
        title: data.title ? data.title.substring(0, 140) : undefined,
        description: data.description,
        price: parseFloat(data.price) || 0.0,
        who_made: data.who_made || "i_did",
        when_made: data.when_made || "2020_2026",
        taxonomy_id: TAXONOMY_MAP[data.category as string] || 2078,
        is_supply: data.is_supply === "true",
        type: isPhysical ? "physical" : "download"
      };

      if (isPhysical) {
        if (shippingProfileId !== undefined) {
          payload.shipping_profile_id = shippingProfileId;
        } else {
          return NextResponse.json({
            error: 'Failed to push to Etsy',
            details: 'Etsy requires a Shipping Profile for physical listings. Please select or enter a shipping profile before pushing.'
          }, { status: 400 });
        }

        if (readinessStateId !== undefined) {
          payload.readiness_state_id = readinessStateId;
        } else {
          return NextResponse.json({
            error: 'Failed to push to Etsy',
            details: 'Etsy requires a Processing Profile (readiness_state_id) for physical listings. Please select or enter a processing profile before pushing.'
          }, { status: 400 });
        }
      }

      if (shopSectionId !== undefined) {
        payload.shop_section_id = shopSectionId;
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
         await axiosWithRetry({
           url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}?legacy=false`,
           method: 'PATCH',
           headers,
           data: payload
         });
      } else {
         // Create
         const listingRes = await axiosWithRetry({
           url: `https://api.etsy.com/v3/application/shops/${shopId}/listings?legacy=false`,
           method: 'POST',
           headers,
           data: payload
         });
         listingId = String(listingRes.data.listing_id);
      }

      // 4. Update Properties
      const propertyUpdates = [];

      const PROP_IDS = {
        primary_color: 200,
        secondary_color: 52047899002,
        occasion: 46803063641,
        celebration: 46803063659,
        subject: 400394338806,
        orientation: 406291158455,
        framing: 145330288558,
        aspect_ratio: 570246213622,
        room: 145330288592,
        home_style: 145330288652,
        can_be_personalized: 148789511775,
        sleeve_length: 325502675244,
        neckline: 325502675262,
        clothing_style: 325502673988,
        capacity: 52047898162,
        dishwasher_safe: 47626760110,
        microwave_safe: 47626760308
      };

      if (data.primary_color && VALUE_IDS_MAP[200] && VALUE_IDS_MAP[200][data.primary_color as string]) {
        propertyUpdates.push({ id: 200, value_ids: [VALUE_IDS_MAP[200][data.primary_color as string]], values: [data.primary_color as string] });
      }

      if (data.secondary_color && VALUE_IDS_MAP[52047899002] && VALUE_IDS_MAP[52047899002][data.secondary_color as string]) {
        propertyUpdates.push({ id: 52047899002, value_ids: [VALUE_IDS_MAP[52047899002][data.secondary_color as string]], values: [data.secondary_color as string] });
      }

      if (data.occasion && VALUE_IDS_MAP[46803063641] && VALUE_IDS_MAP[46803063641][data.occasion as string]) {
        propertyUpdates.push({ id: 46803063641, value_ids: [VALUE_IDS_MAP[46803063641][data.occasion as string]], values: [data.occasion as string] });
      }

      if (data.celebration && VALUE_IDS_MAP[46803063659] && VALUE_IDS_MAP[46803063659][data.celebration as string]) {
        propertyUpdates.push({ id: 46803063659, value_ids: [VALUE_IDS_MAP[46803063659][data.celebration as string]], values: [data.celebration as string] });
      }

      // Art subject (ID 400394338806) - supports up to 3 values
      if (data.subject) {
        const subList = String(data.subject).split(',').map(s => s.trim()).filter(Boolean);
        const subIds = subList.map(s => VALUE_IDS_MAP[400394338806]?.[s]).filter(Boolean);
        if (subIds.length > 0) {
          propertyUpdates.push({ id: 400394338806, value_ids: subIds, values: subList.filter(s => VALUE_IDS_MAP[400394338806]?.[s]) });
        }
      }

      // Graphic (Clothing graphic 332797777099 or Home graphic 396998957792) - supports 1 value
      if (isPhysical) {
        const graphicPropId = (data.category === "T-Shirts" || data.category === "Sweatshirts & Hoodies") ? 332797777099 : (data.category === "Mugs & Drinkware" ? 396998957792 : null);
        if (graphicPropId && data.graphic && VALUE_IDS_MAP[graphicPropId] && VALUE_IDS_MAP[graphicPropId][data.graphic as string]) {
          propertyUpdates.push({ id: graphicPropId, value_ids: [VALUE_IDS_MAP[graphicPropId][data.graphic as string]], values: [data.graphic as string] });
        }
      }

      const otherProps = ['orientation', 'framing', 'aspect_ratio', 'room', 'home_style', 'can_be_personalized', 'sleeve_length', 'neckline', 'clothing_style', 'dishwasher_safe', 'microwave_safe'];
      for (const key of otherProps) {
        const val = data[key];
        const propId = (PROP_IDS as any)[key];
        if (val && propId && VALUE_IDS_MAP[propId] && VALUE_IDS_MAP[propId][val as string]) {
          propertyUpdates.push({ id: propId, value_ids: [VALUE_IDS_MAP[propId][val as string]], values: [val as string] });
        }
      }

      if (data.capacity) {
        propertyUpdates.push({ id: 52047898162, value_ids: [], values: [String(data.capacity)] });
      }

      if (data.materials) {
        const matList = String(data.materials).split(',').map(s => s.trim()).filter(s => s.length > 0);
        const resolvedIds = [];
        const resolvedNames = [];
        for (const mat of matList) {
          const mId = resolveMaterialId(mat);
          if (mId) {
            resolvedIds.push(mId);
            resolvedNames.push(mat);
          }
        }
        if (resolvedIds.length > 0) {
          propertyUpdates.push({ id: 148789511893, value_ids: resolvedIds, values: resolvedNames });
        }
      }

      for (const prop of propertyUpdates) {
        try {
          await axiosWithRetry({
            url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/${prop.id}`,
            method: 'PUT',
            headers,
            data: { value_ids: prop.value_ids, values: prop.values }
          });
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
         return null; 
      }
      if (fileUrl.match(/^[A-Za-z]:/)) {
         return fileUrl; 
      }
      if (fileUrl.startsWith('/')) {
         return path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', fileUrl);
      }
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
      // 5. Upload Preview Images
      if (data.images) {
        let existingImages: { listing_image_id: number }[] = [];
        if (listingId) {
          try {
            const existingImagesRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/listings/${listingId}/images`,
              method: 'GET',
              headers
            });
            existingImages = existingImagesRes.data.results || [];
            
            // Delete all EXCEPT the first one
            for (let i = 1; i < existingImages.length; i++) {
              try {
                await axiosWithRetry({
                  url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images/${existingImages[i].listing_image_id}`,
                  method: 'DELETE',
                  headers
                });
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

            await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
              method: 'POST',
              headers: uploadHeaders,
              data: formData
            });
            
            if (rank === 1 && existingImages.length > 0) {
                 try {
                    await axiosWithRetry({
                      url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images/${existingImages[0].listing_image_id}`,
                      method: 'DELETE',
                      headers
                    });
                 } catch (delErr: unknown) {
                    if ((delErr as {response?: {status?: number}}).response?.status !== 404) throw delErr;
                 }
            }
            
            rank++;
          }
        }
      }
    }

    if (data.updateType === "all" || data.updateType === "video") {
      // 6. Upload Promo Video
      if (data.video) {
        const absoluteVideoPath = resolveFilePath(data.video);
        if (absoluteVideoPath && fs.existsSync(absoluteVideoPath)) {
          // Delete existing video(s)
          try {
            const existingVideosRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/listings/${listingId}/videos`,
              method: 'GET',
              headers
            });
            const existingVideos = existingVideosRes.data.results || [];
            for (const v of existingVideos) {
              try {
                await axiosWithRetry({
                  url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/videos/${v.listing_video_id}`,
                  method: 'DELETE',
                  headers
                });
              } catch (delErr: any) {
                if (delErr.response?.status !== 404) throw delErr;
              }
            }
          } catch (err) {
            console.warn("Failed to delete existing video:", err);
          }

          // Upload new video file
          const videoBuffer = fs.readFileSync(absoluteVideoPath);
          const videoBlob = new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' });
          const videoFormData = new FormData();
          videoFormData.append("video", videoBlob, path.basename(absoluteVideoPath));
          videoFormData.append("name", path.basename(absoluteVideoPath));

          const uploadHeaders: Record<string, string> = { ...headers };
          delete uploadHeaders['Content-Type'];

          await axiosWithRetry({
            url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/videos`,
            method: 'POST',
            headers: uploadHeaders,
            data: videoFormData
          });
        }
      }
    }

    if (data.updateType === "all" || data.updateType === "files") {
      // 7. Upload Digital Files
      const isPhysical = data.listingType === 'physical';
      if (data.digital_file && !isPhysical) {
        if (listingId) {
          try {
            const existingFilesRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
              method: 'GET',
              headers
            });
            const existingFiles = existingFilesRes.data;
            for (const f of existingFiles.results || []) {
              try {
                await axiosWithRetry({
                  url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files/${f.listing_file_id}`,
                  method: 'DELETE',
                  headers
                });
              } catch (delErr: unknown) {
                if ((delErr as {response?: {status?: number}}).response?.status !== 404) throw delErr;
              }
            }
          } catch (err: unknown) {
            const error = err as { response?: { data?: unknown }, message?: string };
            console.warn("Failed to fetch/delete existing files:", error.response?.data || error.message);
          }
        }

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

            await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
              method: 'POST',
              headers: uploadHeaders,
              data: formData
            });
          }
        }
      }
    }

    // 8. Variations and Inventory Mapping (Physical Listings Only)
    const isPhysicalProduct = data.listingType === 'physical';
    const rawVariations = (data as any).variations;
    if (isPhysicalProduct && rawVariations && rawVariations.properties && rawVariations.properties.length > 0) {
      const variations = rawVariations;
      const enabledCombs = (variations.combinations || []).filter((c: any) => c.isEnabled);
      
      if (enabledCombs.length > 0) {
        // Resolve Property IDs (handling deprecated 100 size ID and allocating custom IDs 513/514)
        const usedIds = new Set();
        variations.properties.forEach((p: any) => {
          let id = p.propertyId;
          if (id === 100) id = 513;
          if (id && id > 0) usedIds.add(id);
        });

        let customIdCounter = 513;
        const resolvedProperties = variations.properties.map((prop: any) => {
          let propId = prop.propertyId;
          if (propId === 100) {
            propId = 513;
          }
          if (!propId || propId === 0) {
            while (usedIds.has(customIdCounter)) {
              customIdCounter++;
            }
            propId = customIdCounter;
            usedIds.add(propId);
          }
          return {
            ...prop,
            propertyId: propId
          };
        });

        const resolvedValueIdsMap: Record<string, number> = {};

        // A. Update Inventory / Establish Variations (on text or all updates)
        if (data.updateType === "all" || data.updateType === "text") {
          // If readinessStateId is still undefined, try to fetch current listing details from Etsy to get it
          if (readinessStateId === undefined) {
            try {
              const listingDetailsRes = await axiosWithRetry({
                url: `https://api.etsy.com/v3/application/listings/${listingId}?legacy=false`,
                method: 'GET',
                headers
              });
              if (listingDetailsRes.data && listingDetailsRes.data.readiness_state_id) {
                readinessStateId = listingDetailsRes.data.readiness_state_id;
              }
            } catch (detailErr: any) {
              console.warn("Failed to fetch current listing details for readiness_state_id:", detailErr.response?.data || detailErr.message);
            }
          }

          const productsPayload = [];
          
          for (const comb of enabledCombs) {
            // Resolve SKU template
            let resolvedSku = "";
            if (comb.skuTemplate) {
              resolvedSku = comb.skuTemplate.replace(/{folder}/g, data.folder || "");
            } else {
              const suffix = Object.keys(comb.values).map((k: any) => comb.values[k].toUpperCase().replace(/\s+/g, '')).join("-");
              resolvedSku = `${data.folder || "PRODUCT"}-${suffix}`;
            }
            resolvedSku = resolvedSku.trim().substring(0, 64);

            // Resolve Price and Quantity
            const priceFloat = parseFloat(comb.price) || parseFloat(data.price) || 0.0;
            const qtyInt = parseInt(comb.quantity) || parseInt(data.quantity) || 999;

            // Resolve Property Values
            const propertyValues = resolvedProperties.map((prop: any) => {
              const valueString = comb.values[prop.name] || "";
              let valId = null;
              if (VALUE_IDS_MAP[prop.propertyId] && VALUE_IDS_MAP[prop.propertyId][valueString]) {
                valId = VALUE_IDS_MAP[prop.propertyId][valueString];
              }
              return {
                property_id: prop.propertyId,
                property_name: prop.name,
                scale_id: null,
                value_ids: valId ? [valId] : [],
                values: [valueString]
              };
            });

            const offering = {
              price: priceFloat,
              quantity: qtyInt,
              is_enabled: true,
              readiness_state_id: readinessStateId
            };

            productsPayload.push({
              sku: resolvedSku,
              offerings: [offering],
              property_values: propertyValues
            });
          }

          const propertyIds = resolvedProperties.map((p: any) => p.propertyId);
          const inventoryPayload = {
            products: productsPayload,
            price_on_property: propertyIds,
            quantity_on_property: propertyIds,
            sku_on_property: propertyIds
          };

          try {
            const inventoryRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/listings/${listingId}/inventory?legacy=false`,
              method: 'PUT',
              headers,
              data: inventoryPayload
            });

            if (inventoryRes.data && Array.isArray(inventoryRes.data.products)) {
              for (const prod of inventoryRes.data.products) {
                if (Array.isArray(prod.property_values)) {
                  for (const pv of prod.property_values) {
                    const propId = pv.property_id;
                    const valStr = pv.values && pv.values[0];
                    const valId = pv.value_ids && pv.value_ids[0];
                    if (propId && valStr && valId) {
                      resolvedValueIdsMap[`${propId}-\s*${valStr}\s*`.trim()] = valId;
                      resolvedValueIdsMap[`${propId}-${valStr}`] = valId;
                    }
                  }
                }
              }
            }
          } catch (invErr: any) {
            console.error("Failed to update listing inventory:", invErr.response?.data || invErr.message);
            throw new Error(`Failed to update listing variations/inventory: ${JSON.stringify(invErr.response?.data || invErr.message)}`);
          }
        }

        // B. Update Variation Images (on all, text, or images updates)
        if (data.updateType === "all" || data.updateType === "images" || data.updateType === "text") {
          // If we didn't call PUT inventory in this request, resolvedValueIdsMap will be empty.
          // In that case, fetch the current inventory from Etsy to resolve custom/standard value IDs.
          if (Object.keys(resolvedValueIdsMap).length === 0) {
            try {
              const currentInventoryRes = await axiosWithRetry({
                url: `https://api.etsy.com/v3/application/listings/${listingId}/inventory?legacy=false`,
                method: 'GET',
                headers
              });
              if (currentInventoryRes.data && Array.isArray(currentInventoryRes.data.products)) {
                for (const prod of currentInventoryRes.data.products) {
                  if (Array.isArray(prod.property_values)) {
                    for (const pv of prod.property_values) {
                      const propId = pv.property_id;
                      const valStr = pv.values && pv.values[0];
                      const valId = pv.value_ids && pv.value_ids[0];
                      if (propId && valStr && valId) {
                        resolvedValueIdsMap[`${propId}-\s*${valStr}\s*`.trim()] = valId;
                        resolvedValueIdsMap[`${propId}-${valStr}`] = valId;
                      }
                    }
                  }
                }
              }
            } catch (invErr: any) {
              console.warn("Failed to retrieve current inventory for variation images resolution:", invErr.response?.data || invErr.message);
            }
          }

          // Determine which property varies the image (prefer name containing "color", fallback to the first property)
          const imageProperty = resolvedProperties.find((p: any) => 
            p.name.toLowerCase().includes('color') || p.name.toLowerCase().includes('colour')
          ) || resolvedProperties[0];

          try {
            const listingImagesRes = await axiosWithRetry({
              url: `https://api.etsy.com/v3/application/listings/${listingId}/images`,
              method: 'GET',
              headers
            });
            const listingImages = listingImagesRes.data.results || [];
            
            const variationImagesPayload = [];
            const mappedValues = new Set();

            for (const comb of enabledCombs) {
              const valStr = comb.values[imageProperty.name];
              const slot = comb.imageSlot; // 1-indexed
              
              if (valStr && slot && slot >= 1 && slot <= 10 && !mappedValues.has(valStr)) {
                const imageObj = listingImages[slot - 1];
                const valId = resolvedValueIdsMap[`${imageProperty.propertyId}-${valStr}`] || resolvedValueIdsMap[`${imageProperty.propertyId}-\s*${valStr}\s*`.trim()];
                
                if (imageObj && imageObj.listing_image_id && valId) {
                  variationImagesPayload.push({
                    property_id: imageProperty.propertyId,
                    value_id: valId,
                    image_id: imageObj.listing_image_id
                  });
                  mappedValues.add(valStr);
                }
              }
            }

            if (variationImagesPayload.length > 0) {
              await axiosWithRetry({
                url: `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/variation-images`,
                method: 'POST',
                headers,
                data: {
                  variation_images: variationImagesPayload
                }
              });
            }
          } catch (varImgErr: any) {
            console.warn("Failed to update variation images association:", varImgErr.response?.data || varImgErr.message);
          }
        }
      }
    }

    return NextResponse.json({ success: true, listing_id: listingId });
  } catch (err: unknown) {
    const errorDetails = (err as { response?: { data?: unknown } }).response?.data || (err as Error).message;
    console.error("Etsy Push Error:", JSON.stringify(errorDetails, null, 2));
    
    // TRANSACTION ROLLBACK: Delete newly created draft listing if operations failed
    if (isNewListing && listingId) {
      try {
        console.log(`Triggering rollback deletion for orphan listing draft ID: ${listingId}`);
        await axiosWithRetry({
          url: `https://api.etsy.com/v3/application/listings/${listingId}`,
          method: 'DELETE',
          headers
        });
        console.log(`Rollback complete: Deleted draft listing ID ${listingId}.`);
      } catch (rollbackErr: any) {
        console.error(`Failed to rollback and delete draft listing ID ${listingId}:`, rollbackErr.response?.data || rollbackErr.message);
      }
    }

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
