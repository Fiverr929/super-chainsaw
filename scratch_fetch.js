const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function getTaxonomy() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    if (!apiKey) {
      console.error("No API key");
      return;
    }
    const res = await axios.get('https://api.etsy.com/v3/application/buyer-taxonomy/nodes', {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`
      }
    });
    fs.writeFileSync('taxonomy.json', JSON.stringify(res.data, null, 2));
    console.log("Taxonomy saved to taxonomy.json");
  } catch (err) {
    console.error("Error", err.response ? err.response.data : err.message);
  }
}
getTaxonomy();
