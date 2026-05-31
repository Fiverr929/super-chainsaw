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

    const propRes = await axios.get('https://api.etsy.com/v3/application/seller-taxonomy/nodes/2078/properties', { headers });
    
    for (const prop of propRes.data.results) {
        if ([200, 46803063641, 46803063659, 400394338806].includes(prop.property_id)) {
            console.log(`\nexport const PROP_${prop.name.toUpperCase().replace(/ /g, '_')} = {`);
            console.log(`  id: ${prop.property_id},`);
            console.log(`  values: {`);
            for (const val of prop.possible_values) {
                console.log(`    "${val.name}": ${val.value_id},`);
            }
            console.log(`  }`);
            console.log(`};`);
        }
    }
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

exploreProperties();
