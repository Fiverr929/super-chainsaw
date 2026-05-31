import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import path from "path";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function fixListing() {
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

    const shopId = process.env.ETSY_SHOP_ID; // CafeHTML
    const listingId = 4513062935;

    // 1. Update Tags (Full 13 tags)
    console.log("1. Fixing Tags (Pushing 13 full tags)...");
    const tags = [
      "90s aesthetic", "zero boyfriends", "funny quote svg", "anti valentines", 
      "independent woman", "retro graphic", "digital download", "sarcastic shirt", 
      "girl power art", "single life tee", "funny saying png", "digital print svg", 
      "90s vintage design"
    ];
    
    // Ensure all are <= 20 chars
    const cleanTags = tags.map(t => t.substring(0, 20));

    const updatePayload = new URLSearchParams();
    cleanTags.forEach(tag => updatePayload.append("tags[]", tag));
    
    await client.put(`/application/shops/${shopId}/listings/${listingId}`, updatePayload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    console.log("✅ Successfully updated Tags to full 13 count!");

    // 2. Upload the Digital File
    console.log("2. Uploading the actual Digital File...");
    const brainDir = "C:\\Users\\This PC\\.gemini\\antigravity\\brain\\24d77fb2-6e95-4ff9-a25b-682b683f3932";
    const digitalFileName = "media__1780032620787.png";
    const digitalFilePath = path.join(brainDir, digitalFileName);
    
    if (fs.existsSync(digitalFilePath)) {
      const form = new FormData();
      form.append("file", fs.createReadStream(digitalFilePath));
      form.append("name", "Zero_Boyfriends_Digital.png");
      
      try {
        await client.post(`/application/shops/${shopId}/listings/${listingId}/files`, form, {
          headers: {
            ...form.getHeaders()
          }
        });
        console.log(`✅ Successfully uploaded Digital Download File: ${digitalFileName}!`);
      } catch (err) {
        console.error("❌ Failed to upload digital file:", err.response?.data || err.message);
      }
    } else {
      console.log(`Could not find digital file at ${digitalFilePath}`);
    }

  } catch (error) {
    console.error("❌ ERROR RUNNING SCRIPT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

fixListing();
