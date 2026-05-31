require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function exploreProperties() {
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
      'Authorization': `Bearer ${accessToken}`
    };

    // Taxonomy ID 2078 = Digital Prints
    const propRes = await axios.get('https://api.etsy.com/v3/application/seller-taxonomy/nodes/2078/properties', { headers });
    
    console.log("PROPERTIES FOR DIGITAL PRINTS (2078):");
    for (const prop of propRes.data.results) {
        console.log(`\nProperty: ${prop.name} (ID: ${prop.property_id})`);
        if (prop.possible_values) {
            console.log(`Options: ${prop.possible_values.map(v => v.name).join(', ')}`);
        }
    }
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

exploreProperties();
