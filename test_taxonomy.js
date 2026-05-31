require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function exploreTaxonomy() {
  try {
    // 1. Get Access Token
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

    // 2. Fetch Taxonomy Tree
    const taxRes = await axios.get('https://api.etsy.com/v3/application/seller-taxonomy/nodes', { headers });
    
    // Let's find some digital categories
    const categories = taxRes.data.results || [];
    console.log(`Total Top-Level Categories: ${categories.length}`);
    
    // We'll just print out a few levels deep to see how it's structured
    for (const cat of categories.slice(0, 5)) {
        console.log(`- ${cat.name} (ID: ${cat.id})`);
    }

  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

exploreTaxonomy();
