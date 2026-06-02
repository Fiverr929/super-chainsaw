require('dotenv').config({ path: '../.env.local' });
const axios = require('axios');

async function testTaxonomy() {
  const apiKey = process.env.ETSY_API_KEY;
  const taxonomyId = 2078; // Digital Prints

  try {
    const res = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, {
      headers: {
        'x-api-key': `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}`
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

testTaxonomy();
