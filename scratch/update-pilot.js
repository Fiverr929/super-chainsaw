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

    console.log("1. Finding Correct Taxonomy ID...");
    // Let's get taxonomy nodes to find "Digital Prints"
    const taxRes = await client.get("/application/seller-taxonomy/nodes");
    const nodes = taxRes.data.results;
    
    let targetTaxonomyId = 1205; // Fallback to what worked
    
    // Recursive search for "Digital Prints"
    function searchNodes(nodeList, term) {
      for (const n of nodeList) {
        if (n.name.toLowerCase().includes(term.toLowerCase())) {
          return n.id;
        }
        if (n.children && n.children.length > 0) {
          const found = searchNodes(n.children, term);
          if (found) return found;
        }
      }
      return null;
    }

    const foundId = searchNodes(nodes, "Digital Prints") || searchNodes(nodes, "Digital");
    if (foundId) {
      targetTaxonomyId = foundId;
      console.log(`Found Taxonomy ID for Digital: ${targetTaxonomyId}`);
    } else {
      console.log(`Could not find specific digital taxonomy, using fallback: ${targetTaxonomyId}`);
    }

    console.log("2. Updating Existing Etsy Draft Listing...");
    
    const shopId = process.env.ETSY_SHOP_ID;
    const listingId = 4513044308; // The ID of the last listing created

    console.log(`Checking if Listing ${listingId} exists...`);
    try {
      const getRes = await client.get(`/application/listings/${listingId}`);
      console.log(`Listing found! Current Taxonomy ID: ${getRes.data.taxonomy_id}`);
    } catch (err) {
      console.error("Listing not found. It might have been deleted.");
      return;
    }

    const updatePayload = {
      taxonomy_id: targetTaxonomyId
    };

    console.log(`Updating Listing ${listingId} in Shop ${shopId} to taxonomy ${targetTaxonomyId}...`);
    let updateRes;
    try {
      updateRes = await client.patch(`/application/shops/${shopId}/listings/${listingId}`, updatePayload);
    } catch(err) {
      if(err.response?.status === 404) {
        console.log("PATCH failed with 404, trying PUT with application/json...");
        updateRes = await client.put(`/application/shops/${shopId}/listings/${listingId}`, updatePayload);
      } else {
        throw err;
      }
    }
    
    console.log("✅ DRAFT UPDATED SUCCESSFULLY!");
    console.log("Listing ID:", listingId);
    console.log("New Taxonomy ID:", updateRes.data.taxonomy_id);

  } catch (error) {
    console.error("❌ ERROR UPDATING DRAFT:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

runUpdatePilot();
