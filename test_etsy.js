require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function test() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const refreshToken = process.env.ETSY_REFRESH_TOKEN;
    const shopId = process.env.ETSY_SHOP_ID;

    // Get Access Token
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: apiKey,
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const accessToken = tokenRes.data.access_token;

    // Get an active listing ID to test on
    const listingsRes = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/listings?limit=1`, {
      headers: { 'x-api-key': `${apiKey}:${process.env.ETSY_SHARED_SECRET}`, 'Authorization': `Bearer ${accessToken}` }
    });
    const listingId = listingsRes.data.results[0].listing_id;
    console.log("Testing on listing:", listingId);

    // Try updating a property with JUST value_ids
    try {
      await axios.put(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/properties/200`, 
        { value_ids: [1] }, // 1 = Black
        { headers: { 'x-api-key': `${apiKey}:${process.env.ETSY_SHARED_SECRET}`, 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );
      console.log("Property put with ONLY value_ids SUCCEEDED!");
    } catch (err) {
      console.error("Property put with ONLY value_ids FAILED:", err.response?.data || err.message);
    }
  } catch(err) {
    console.error("Setup failed:", err.response?.data || err.message);
  }
}
test();
