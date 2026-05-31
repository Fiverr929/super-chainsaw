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
    const listingId = "4513296437"; // The one I just created

    console.log("Trying PUT...");
    try {
        const updateRes = await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, { title: "Updated PUT" }, { headers });
        console.log("PUT Success:", updateRes.data.title);
    } catch(e) { console.error("PUT Error:", e.response?.status, e.response?.data); }

    console.log("Trying PATCH...");
    try {
        const updateRes2 = await axios.patch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, { title: "Updated PATCH" }, { headers });
        console.log("PATCH Success:", updateRes2.data.title);
    } catch(e) { console.error("PATCH Error:", e.response?.status, e.response?.data); }

  } catch (err) {
    console.error("Auth Error:", err.message);
  }
}

testEtsyPut();
