require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function doResearch() {
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

    // 1. Get Shop Sections
    console.log("--- SHOP SECTIONS ---");
    const sectionsRes = await axios.get(`https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/sections`, { headers });
    for (const sec of sectionsRes.data.results) {
        console.log(`- ${sec.title} (ID: ${sec.shop_section_id})`);
    }

    // 2. Search Taxonomy for Digital Prints
    console.log("\n--- TAXONOMY SEARCH (Digital Prints) ---");
    const taxRes = await axios.get('https://api.etsy.com/v3/application/seller-taxonomy/nodes', { headers });
    
    function searchTree(nodes, keyword) {
        for (const node of nodes) {
            if (node.name.toLowerCase().includes(keyword.toLowerCase())) {
                console.log(`FOUND: ${node.name} (ID: ${node.id})`);
            }
            if (node.children) {
                searchTree(node.children, keyword);
            }
        }
    }
    
    searchTree(taxRes.data.results, "digital print");

  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

doResearch();
