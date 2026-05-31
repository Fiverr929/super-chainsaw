const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testPropertyPut() {
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
    const listingId = "4513303452"; // Known valid listing
    const propId = 200; // Primary Color
    const valueIds = [1]; // Red

    console.log("Updating property with value_ids only...");
    try {
        const updateRes = await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/${propId}`, 
          { value_ids: valueIds }, 
          { headers }
        );
        console.log("PUT Success");
    } catch(e) { console.error("PUT Error:", e.response?.data); }

    console.log("Updating property with values array...");
    try {
        const updateRes2 = await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/${propId}`, 
          { value_ids: valueIds, values: [] }, 
          { headers }
        );
        console.log("PUT Success with values");
    } catch(e) { console.error("PUT Error:", e.response?.data); }

  } catch (err) {
    console.error("Auth Error:", err.message);
  }
}

testPropertyPut();
