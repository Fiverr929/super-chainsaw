const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  
  try {
    const res = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/2078/properties`, {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`
      }
    });
    
    const props = res.data.results;
    const holidayProp = props.find(p => p.property_id === 46803063659);
    
    if (holidayProp) {
        const diwali = holidayProp.possible_values.find(v => v.name === "Diwali");
        console.log("DIWALI:", diwali);
    } else {
        console.log("HOLIDAY PROP NOT FOUND");
    }
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

check();
