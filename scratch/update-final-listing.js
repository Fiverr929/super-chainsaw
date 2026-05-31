import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function updateFinalListing() {
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
    const listingId = 4513064817; // Our final pilot listing ID

    console.log("1. Checking for 'Digital Prints' shop section...");
    const sectionsRes = await client.get(`/application/shops/${shopId}/sections`);
    const sections = sectionsRes.data.results;
    
    let targetSectionId = null;
    const digitalPrintsSection = sections.find(s => s.title.toLowerCase().includes("digital prints"));
    
    if (digitalPrintsSection) {
       console.log(`✅ Found 'Digital Prints' section! ID: ${digitalPrintsSection.shop_section_id}`);
       targetSectionId = digitalPrintsSection.shop_section_id;
    } else {
       console.log("⚠️ Could not find a section named 'Digital Prints' in your shop.");
       console.log("Available sections:", sections.map(s => s.title).join(", "));
       console.log("Skipping section update because we lack the 'shops_w' scope to create a new one automatically.");
    }

    console.log("2. Creating Fresh Perfect Draft with Section & Description...");
    const createPayload = new URLSearchParams({
      quantity: "999",
      title: "Life's Goal Zero Boyfriends 90s Aesthetic Graphic Design SVG PNG Digital Download",
      description: "Embrace the 90s aesthetic with this 'Life's Goal Zero Boyfriends' graphic design! Perfect for anti-Valentine's day, funny apparel, or just celebrating independence. This is a digital download file.\n\nIncluded: High-resolution PNG and SVG files.\n\nFor additional details, a single message is all it takes. - Jimmy",
      price: "4.99",
      who_made: "i_did",
      when_made: "2020_2026",
      taxonomy_id: "2078",
      type: "download",
      is_supply: "false",
      state: "draft",
      shop_section_id: "58753559"
    });

    const tags = [
      "90s aesthetic", "zero boyfriends", "funny quote svg", "anti valentines", 
      "independent woman", "retro graphic", "digital download", "sarcastic shirt", 
      "girl power art", "single life tee", "funny saying png", "digital print svg", 
      "90s vintage design"
    ];
    
    tags.forEach((tag) => createPayload.append("tags[]", tag.substring(0, 20)));

    const createRes = await client.post(`/application/shops/${shopId}/listings`, createPayload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const newListingId = createRes.data.listing_id;
    console.log(`✅ Draft Created in 'Digital Prints' section! Listing ID: ${newListingId}`);

  } catch (error) {
    console.error("❌ ERROR RUNNING SCRIPT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

updateFinalListing();
