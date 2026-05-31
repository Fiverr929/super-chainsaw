import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import path from "path";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runFullPilot() {
  try {
    const res = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ETSY_API_KEY,
        refresh_token: process.env.ETSY_REFRESH_TOKEN,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const token = res.data.access_token;
    const apiKey = process.env.ETSY_SHARED_SECRET ? `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}` : process.env.ETSY_API_KEY;

    const client = axios.create({
      baseURL: "https://openapi.etsy.com/v3",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
      },
    });

    const shopId = process.env.ETSY_SHOP_ID;
    console.log(`Using Shop ID: ${shopId}`);

    // 1. Create the Draft Listing
    console.log("1. Creating Draft Listing...");
    const createPayload = new URLSearchParams({
      quantity: "999",
      title: "Life's Goal Zero Boyfriends 90s Aesthetic Graphic Design SVG PNG Digital Download",
      description: "Embrace the 90s aesthetic with this 'Life's Goal Zero Boyfriends' graphic design! Perfect for anti-Valentine's day, funny apparel, or just celebrating independence. This is a digital download file.\n\nIncluded: High-resolution PNG and SVG files.\n\nCreated by me.",
      price: "4.99",
      who_made: "i_did",
      when_made: "2020_2026",
      taxonomy_id: "2078",
      type: "download",
      is_supply: "false",
      state: "draft",
    });

    const tags = ["90s aesthetic", "zero boyfriends", "funny quote svg", "anti valentines", "independent woman", "retro graphic design", "digital download", "sarcastic shirt png"];
    tags.forEach((tag) => createPayload.append("tags[]", tag));

    const createRes = await client.post(`/application/shops/${shopId}/listings`, createPayload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const listingId = createRes.data.listing_id;
    console.log(`✅ Draft Created! Listing ID: ${listingId}`);

    // 2. Upload Images with Alt Text
    console.log("2. Uploading Images with Alt Text...");
    const brainDir = "C:\\Users\\This PC\\.gemini\\antigravity\\brain\\24d77fb2-6e95-4ff9-a25b-682b683f3932";
    const imageFiles = [
      { name: "media__1780032584296.png", alt: "Woman wearing a pink t-shirt with Life's Goal Zero Boyfriends neon text" },
      { name: "media__1780032593285.png", alt: "Mockup of a pink t-shirt featuring 90s aesthetic Zero Boyfriends graphic" }
    ];
    
    for (const imgData of imageFiles) {
      const imgPath = path.join(brainDir, imgData.name);
      if (fs.existsSync(imgPath)) {
        console.log(`Uploading ${imgData.name} with alt text...`);
        const form = new FormData();
        form.append("image", fs.createReadStream(imgPath));
        form.append("alt_text", imgData.alt);
        
        try {
          await client.post(`/application/shops/${shopId}/listings/${listingId}/images`, form, {
            headers: {
              ...form.getHeaders()
            }
          });
          console.log(`✅ Successfully uploaded ${imgData.name} with Alt Text!`);
        } catch (imgErr) {
          console.error(`❌ Failed to upload ${imgData.name}:`, imgErr.response?.data || imgErr.message);
        }
      }
    }

    // 3. Set Properties (Pink & Valentine's)
    console.log("3. Setting dynamic properties (Color & Occasion)...");
    
    // Pink
    try {
      const colorPayload = new URLSearchParams();
      colorPayload.append("value_ids[]", "7");
      colorPayload.append("values[]", "Pink");
      await client.put(`/application/shops/${shopId}/listings/${listingId}/properties/200`, colorPayload, {
         headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log("✅ Set Primary Color to Pink");
    } catch(e) { console.log("Failed to set Color"); }

    // Valentine's
    try {
      const occasionPayload = new URLSearchParams();
      occasionPayload.append("value_ids[]", "6");
      occasionPayload.append("values[]", "Valentine's Day");
      await client.put(`/application/shops/${shopId}/listings/${listingId}/properties/46803063641`, occasionPayload, {
         headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log("✅ Set Occasion to Valentine's Day");
    } catch(e) { console.log("Failed to set Occasion"); }

    console.log("\n=================================");
    console.log(`🎉 FULL PILOT TEST COMPLETE!`);
    console.log(`Go to CafeHTML drafts to see it.`);
    console.log(`Listing ID: ${listingId}`);
    console.log("=================================\n");

  } catch (error) {
    console.error("❌ ERROR RUNNING SCRIPT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

runFullPilot();
