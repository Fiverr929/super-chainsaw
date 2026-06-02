const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function checkProperties() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    
    // Check 2078 (Digital Prints) and 354 (Digital Planners)
    const taxIds = [2078, 354, 1874];
    
    for (const id of taxIds) {
      console.log(`\n=== Properties for Taxonomy ID ${id} ===`);
      const res = await axios.get(`https://api.etsy.com/v3/application/buyer-taxonomy/nodes/${id}/properties`, {
        headers: {
          'x-api-key': `${apiKey}:${sharedSecret}`
        }
      });
      
      const props = res.data.results;
      const subjectProp = props.find(p => p.name.toLowerCase().includes('subject'));
      if (subjectProp) {
        console.log(`FOUND Subject Property! ID: ${subjectProp.property_id}, Name: ${subjectProp.name}`);
      } else {
        console.log(`NO Subject property found for this category.`);
        console.log(`Available properties: ${props.map(p => p.name).join(', ')}`);
      }
    }
  } catch (err) {
    console.error("Error", err.response ? err.response.data : err.message);
  }
}
checkProperties();
