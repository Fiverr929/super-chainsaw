import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runPilot() {
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
    const taxonomyId = 2078;

    console.log("1. Fetching available properties to find the 'digital content created' field...");
    const propRes = await client.get(`/application/seller-taxonomy/nodes/${taxonomyId}/properties`);
    const properties = propRes.data.results;
    
    // Dump all properties to a file just to see them
    fs.writeFileSync("scratch/properties.json", JSON.stringify(properties, null, 2));

    const targetProp = properties.find(p => p.name.toLowerCase().includes("how is this digital content created") || p.name.toLowerCase().includes("created"));
    
    if (targetProp) {
      console.log(`Found Property: ${targetProp.name} (ID: ${targetProp.property_id})`);
      const val = targetProp.possible_values.find(v => v.name.toLowerCase().includes("created by me") || v.name.toLowerCase().includes("i did"));
      
      if (val) {
         console.log(`Found Value: ${val.name} (ID: ${val.value_id})`);
         
         console.log("Updating listing...");
         const propPayload = new URLSearchParams();
         propPayload.append("value_ids[]", val.value_id.toString());
         propPayload.append("values[]", val.name);
          
         await client.put(
            `/application/shops/${shopId}/listings/${listingId}/properties/${targetProp.property_id}`,
            propPayload,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
         );
         console.log("✅ Successfully updated the digital content creation property!");
      } else {
         console.log("Could not find 'Created by me' in the possible values:", targetProp.possible_values);
      }
    } else {
      console.log("Could not find any property matching that description.");
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

runPilot();
