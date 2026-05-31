import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runUpdatePilot() {
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
    const listingId = 4513044308; // Existing draft listing
    const taxonomyId = 2078; // Digital Prints

    // 1. Fetch available properties for Digital Prints (2078)
    console.log("1. Fetching available properties for taxonomy 2078...");
    try {
      const propRes = await client.get(`/application/seller-taxonomy/nodes/${taxonomyId}/properties`);
      const properties = propRes.data.results;
      
      // Look for Subject (e.g. Graphic, Quote, Humor), Occasion (Valentine's)
      let subjectProp = properties.find(p => p.name.toLowerCase().includes("subject"));
      let occasionProp = properties.find(p => p.name.toLowerCase().includes("occasion"));
      let colorProp = properties.find(p => p.name.toLowerCase().includes("primary color"));
      
      console.log(`Found Property IDs -> Subject: ${subjectProp?.property_id}, Occasion: ${occasionProp?.property_id}, Primary Color: ${colorProp?.property_id}`);
      
      // If we found Primary Color, let's look for "Pink" in its valid values
      if (colorProp && colorProp.possible_values) {
        const pinkVal = colorProp.possible_values.find(v => v.name.toLowerCase().includes("pink"));
        if (pinkVal) {
          console.log(`Updating Primary Color to Pink (Property ${colorProp.property_id}, Value ${pinkVal.value_id})...`);
          
          const propPayload = new URLSearchParams();
          propPayload.append("value_ids[]", pinkVal.value_id.toString());
          propPayload.append("values[]", pinkVal.name);
          
          await client.put(
            `/application/shops/${shopId}/listings/${listingId}/properties/${colorProp.property_id}`,
            propPayload,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          console.log("✅ Successfully updated Primary Color property.");
        }
      }

      // If Occasion was found, look for Valentine's Day
      if (occasionProp && occasionProp.possible_values) {
        const valVal = occasionProp.possible_values.find(v => v.name.toLowerCase().includes("valentine"));
        if (valVal) {
          console.log(`Updating Occasion to Valentine's (Property ${occasionProp.property_id}, Value ${valVal.value_id})...`);
          
          const propPayload = new URLSearchParams();
          propPayload.append("value_ids[]", valVal.value_id.toString());
          propPayload.append("values[]", valVal.name);
          
          await client.put(
            `/application/shops/${shopId}/listings/${listingId}/properties/${occasionProp.property_id}`,
            propPayload,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          console.log("✅ Successfully updated Occasion property.");
        }
      }
    } catch (propErr) {
      console.log("Failed to fetch or update properties:", propErr.response?.data || propErr.message);
    }

    // 2. Fetch images and update Alt Text
    console.log("2. Fetching listing images to apply alt text...");
    try {
      const imgRes = await client.get(`/application/shops/${shopId}/listings/${listingId}/images`);
      const images = imgRes.data.results;
      
      console.log(`Found ${images.length} images.`);
      
      const altTexts = [
        "Woman wearing a pink t-shirt with Life's Goal Zero Boyfriends neon text",
        "Mockup of a pink t-shirt featuring 90s aesthetic Zero Boyfriends graphic"
      ];
      
      for (let i = 0; i < images.length; i++) {
        const imageId = images[i].listing_image_id;
        const altText = altTexts[i] || "Life's Goal Zero Boyfriends Graphic Design";
        
        console.log(`Updating image ${imageId} alt text to: "${altText}"`);
        
        const altPayload = { alt_text: altText };
        // We use PUT for image, some endpoints require multipart or urlencoded, but let's try json or URLSearchParams
        const altParams = new URLSearchParams({ alt_text: altText });
        await client.put(
          `/application/shops/${shopId}/listings/${listingId}/images/${imageId}`,
          altParams,
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
      }
      console.log("✅ Successfully updated all image alt texts.");

    } catch (imgErr) {
       console.log("Failed to update image alt text:", imgErr.response?.data || imgErr.message);
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

runUpdatePilot();
