const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testEtsyPut() {
  try {
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.ETSY_API_KEY,
      refresh_token: process.env.ETSY_REFRESH_TOKEN
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;
    const headers = {
      'x-api-key': `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}`,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const shopId = process.env.ETSY_SHOP_ID;
    
    // Create a dummy listing first to make sure we have a valid ID
    const postPayload = {
      quantity: 10,
      title: "Temporary Listing for Update Test",
      description: "Test description",
      price: 3.99,
      who_made: "i_did",
      when_made: "2020_2026",
      taxonomy_id: 2078,
      is_supply: false,
      type: "download"
    };
    console.log("Creating new listing...");
    const createRes = await axios.post(`https://api.etsy.com/v3/application/shops/${shopId}/listings`, postPayload, { headers });
    const newListingId = createRes.data.listing_id;
    console.log("Created Listing ID:", newListingId);

    console.log("Updating listing...");
    const updatePayload = {
      title: "Temporary Listing Updated"
    };
    const updateRes = await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${newListingId}`, updatePayload, { headers });
    console.log("Update Success:", updateRes.data.title);
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

testEtsyPut();
