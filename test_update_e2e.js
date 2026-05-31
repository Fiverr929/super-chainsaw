const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testEtsyUpdateEndToEnd() {
  try {
    const shopId = process.env.ETSY_SHOP_ID;
    
    // 1. We will push a completely new listing via our API
    console.log("Pushing new listing...");
    const pushRes = await axios.post('http://localhost:3000/api/etsy/push', {
      quantity: "999",
      title: "Temporary Listing for E2E Update Test",
      description: "Test description",
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
    
    const newListingId = pushRes.data.listing_id;
    console.log("Created Listing ID:", newListingId);

    // 2. Now we update it
    console.log("Updating listing...");
    const updateRes = await axios.post('http://localhost:3000/api/etsy/push', {
      listing_id: newListingId,
      quantity: "999",
      title: "Temporary Listing for E2E Update Test (UPDATED)",
      description: "Test description updated",
      price: "4.99",
      category: "Digital Prints",
      section: "",
      primary_color: "",
      occasion: "",
      celebration: "",
      subject: "",
      tags: "test,digital,updated",
      images: "",
      digital_file: ""
    });
    
    console.log("Update Success:", updateRes.data);
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

testEtsyUpdateEndToEnd();
