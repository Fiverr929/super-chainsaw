import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import path from "path";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runReupload() {
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
    const listingId = 4513044308;

    // 1. Fetch existing images to delete later
    console.log("1. Fetching existing images to delete later...");
    const imgRes = await client.get(`/application/listings/${listingId}/images`);
    const oldImages = imgRes.data.results;
    
    // 2. Upload new images with alt text FIRST (Etsy requires at least 1 image)
    console.log("2. Uploading NEW images with embedded Alt Text...");
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
      } else {
        console.log(`Image ${imgData.name} not found. Skipping.`);
      }
    }

    // 3. Delete old images
    console.log("3. Deleting OLD images without alt text...");
    for (const img of oldImages) {
      console.log(`Deleting old image ${img.listing_image_id}...`);
      await client.delete(`/application/shops/${shopId}/listings/${listingId}/images/${img.listing_image_id}`);
    }
    console.log("✅ All previous images deleted.");

  } catch (error) {
    console.error("❌ ERROR RUNNING SCRIPT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

runReupload();
