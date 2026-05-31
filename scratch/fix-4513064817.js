import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

async function updateListing() {
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
    const listingId = 4513064817;

    console.log(`Updating Listing ${listingId}...`);
    const newDescription = "Embrace the 90s aesthetic with this 'Life's Goal Zero Boyfriends' graphic design! Perfect for anti-Valentine's day, funny apparel, or just celebrating independence. This is a digital download file.\n\nIncluded: High-resolution PNG and SVG files.\n\nFor additional details, a single message is all it takes. - Jimmy";
    const shopSectionId = "58753559"; // Digital Prints

    const updatePayload = new URLSearchParams({
      description: newDescription,
      shop_section_id: shopSectionId
    });

    try {
      // Trying PATCH first as it's the standard for partial updates
      await client.patch(`/application/shops/${shopId}/listings/${listingId}`, updatePayload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log("✅ Successfully updated with PATCH!");
    } catch(patchErr) {
      console.log("PATCH failed. Trying PUT with full payload...");
      // For PUT, etsy requires many fields. Let's fetch it first.
      const getRes = await client.get(`/application/listings/${listingId}`);
      const existing = getRes.data;
      
      const putPayload = new URLSearchParams({
        title: existing.title,
        description: newDescription,
        price: existing.price.amount / existing.price.divisor,
        quantity: existing.quantity,
        who_made: existing.who_made,
        when_made: existing.when_made,
        taxonomy_id: existing.taxonomy_id,
        state: "draft",
        shop_section_id: shopSectionId
      });
      
      await client.put(`/application/shops/${shopId}/listings/${listingId}`, putPayload, {
         headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log("✅ Successfully updated with full PUT payload!");
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

updateListing();
