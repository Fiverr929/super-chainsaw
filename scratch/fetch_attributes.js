require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function fetchTaxonomy() {
  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  const refreshToken = process.env.ETSY_REFRESH_TOKEN;

  try {
    // 1. Get Access Token
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: apiKey,
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;
    const headers = {
      'x-api-key': `${apiKey}:${sharedSecret}`,
      'Content-Type': 'application/json'
    };

    const taxonomyId = 2078; // Digital Prints
    console.log("Fetching properties for node:", taxonomyId);

    const res = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, { headers });
    
    const properties = res.data.results;
    for (const prop of properties) {
      if (prop.name === "Holiday" || prop.name === "Occasion" || prop.name === "Primary color" || prop.name === "Subject") {
        console.log(`\n=== ${prop.name} (ID: ${prop.property_id}) ===`);
        const map = {};
        prop.possible_values.forEach(v => {
          map[v.name] = v.value_id;
        });
        console.log(JSON.stringify(map, null, 2));
      }
    }

  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

fetchTaxonomy();
