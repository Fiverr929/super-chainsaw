import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import path from "path";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runPilot() {
  try {
    console.log("1. Exchanging Refresh Token...");
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
    console.log("Token obtained successfully.");

    const apiKey = process.env.ETSY_SHARED_SECRET ? `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}` : process.env.ETSY_API_KEY;

    const client = axios.create({
      baseURL: "https://openapi.etsy.com/v3",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
      },
    });

    console.log("2. Creating DIGITAL Etsy Draft Listing...");
    const title = "Life's Goal Zero Boyfriends 90s Style SVG | Y2K Pink Aesthetic PNG | Funny Anti-Valentine's Digital Design for Sublimation T-Shirts";
    const description = `This is a DIGITAL DOWNLOAD. No physical item will be shipped.

Channel ultimate 90s nostalgia and Y2K aesthetic with this "Life's Goal Zero Boyfriends" digital graphic design. Featuring punchy neon text and a subtle lined paper graphic saying "Sorry for Being a Bad Influence," this design is perfect for your DIY projects.

Ideal for creating custom t-shirts, tote bags, hoodies, mugs, or stickers. Designed for those who embrace the independent, bad-influence lifestyle. Perfect for anti-Valentine's day gifts or alt-fashion apparel printing.

WHAT YOU RECEIVE:
1x High-resolution PNG file (transparent background)
1x High-quality SVG vector file

Perfect for sublimation printing, Cricut, Silhouette, or direct-to-garment (DTG) printing.`;

    const tags = "Digital Download,SVG File,PNG Sublimation,Y2K Aesthetic,90s Grunge,Zero Boyfriends,Anti Valentines Day,Funny Quote Design,TShirt Sublimation,Alt Fashion PNG,Neon Retro Graphic,DIY Apparel Design,Bad Influence";
    
    const listingPayload = {
      quantity: 999,
      title: title,
      description: description,
      price: 3.99, // Digital items are cheaper
      who_made: "i_did",
      when_made: "2020_2026",
      taxonomy_id: 1205, // Using 1205 (T-Shirts) since it is a T-shirt design
      state: "draft",
      is_supply: false,
      type: "download", // explicitly set to download
      tags: tags.split(",")
    };

    const shopId = process.env.ETSY_SHOP_ID;
    const listingRes = await client.post(`/application/shops/${shopId}/listings`, listingPayload);
    const listingId = listingRes.data.listing_id;
    
    console.log("✅ DIGITAL DRAFT CREATED SUCCESSFULLY!");
    console.log("Listing ID:", listingId);
    console.log("URL:", listingRes.data.url);

    // 3. Uploading Images (First 2 files)
    console.log("3. Attempting to upload listing images...");
    const brainDir = "C:\\Users\\This PC\\.gemini\\antigravity\\brain\\24d77fb2-6e95-4ff9-a25b-682b683f3932";
    const imageFiles = [
      "media__1780032584296.png",
      "media__1780032593285.png"
    ];
    
    for (const img of imageFiles) {
      const imgPath = path.join(brainDir, img);
      if (fs.existsSync(imgPath)) {
        console.log(`Uploading thumbnail ${img}...`);
        const form = new FormData();
        form.append("image", fs.createReadStream(imgPath));
        
        try {
          await client.post(`/application/shops/${shopId}/listings/${listingId}/images`, form, {
            headers: {
              ...form.getHeaders()
            }
          });
          console.log(`Successfully uploaded thumbnail ${img}`);
        } catch (imgErr) {
          console.error(`Failed to upload thumbnail ${img}:`, imgErr.response?.data || imgErr.message);
        }
      } else {
        console.log(`Thumbnail ${img} not found. Skipping.`);
      }
    }

    // 4. Uploading Digital Asset (3rd file)
    console.log("4. Attempting to upload the digital asset for download...");
    const digitalFile = "media__1780032620787.png";
    const digitalFilePath = path.join(brainDir, digitalFile);
    if (fs.existsSync(digitalFilePath)) {
      console.log(`Uploading digital asset ${digitalFile}...`);
      const fileForm = new FormData();
      fileForm.append("file", fs.createReadStream(digitalFilePath));
      fileForm.append("name", "Zero_Boyfriends_90s_Graphic.png");

      try {
        await client.post(`/application/shops/${shopId}/listings/${listingId}/files`, fileForm, {
          headers: {
            ...fileForm.getHeaders()
          }
        });
        console.log(`Successfully uploaded DIGITAL ASSET ${digitalFile}`);
      } catch (fileErr) {
        console.error(`Failed to upload digital asset ${digitalFile}:`, fileErr.response?.data || fileErr.message);
      }
    } else {
      console.log(`Digital asset ${digitalFile} not found. Skipping.`);
    }

  } catch (error) {
    console.error("❌ ERROR CREATING DRAFT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

runPilot();
