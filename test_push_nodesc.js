const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testPushNoDesc() {
  try {
    const shopId = process.env.ETSY_SHOP_ID;
    
    console.log("Pushing new listing with NO description...");
    const pushRes = await axios.post('http://localhost:3000/api/etsy/push', {
      quantity: "999",
      title: "Temporary Listing No Description",
      price: "3.99",
      category: "Digital Prints",
      section: "",
      primary_color: "",
      occasion: "",
      celebration: "",
      subject: "",
      tags: "test,digital",
      images: "",
      digital_file: ""
    });
    
    console.log("Created Listing ID:", pushRes.data);
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

testPushNoDesc();
