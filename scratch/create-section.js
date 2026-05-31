import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function runSectionPilot() {
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

    const shopId = process.env.ETSY_SHOP_ID; // 63621736 for CafeHTML
    const listingId = 4513062935; // Our CafeHTML listing ID
    const sectionTitle = "Prints"; // Assuming they meant Prints instead of Pints

    console.log(`1. Checking existing sections in Shop ${shopId}...`);
    const sectionsRes = await client.get(`/application/shops/${shopId}/sections`);
    const sections = sectionsRes.data.results;
    
    let targetSectionId = null;
    const existingSection = sections.find(s => s.title.toLowerCase() === sectionTitle.toLowerCase() || s.title.toLowerCase() === "pints");
    
    if (existingSection) {
       console.log(`✅ Section '${existingSection.title}' already exists with ID: ${existingSection.shop_section_id}`);
       targetSectionId = existingSection.shop_section_id;
    } else {
       console.log(`Creating new section: '${sectionTitle}'...`);
       const createPayload = new URLSearchParams({ title: sectionTitle });
       const createRes = await client.post(`/application/shops/${shopId}/sections`, createPayload, {
         headers: { "Content-Type": "application/x-www-form-urlencoded" }
       });
       targetSectionId = createRes.data.shop_section_id;
       console.log(`✅ Successfully created section '${sectionTitle}' with ID: ${targetSectionId}`);
    }

    if (targetSectionId) {
      console.log(`2. Assigning Listing ${listingId} to section ${targetSectionId}...`);
      const updatePayload = new URLSearchParams({
        shop_section_id: targetSectionId.toString()
      });

      await client.put(`/application/shops/${shopId}/listings/${listingId}`, updatePayload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log("✅ Successfully updated the listing's Shop Section!");
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

runSectionPilot();
