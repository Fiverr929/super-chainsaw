const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function testEtsyUpdateE2EFiles() {
  try {
    const dummyImgPath = path.join(__dirname, 'public', 'test.jpg');
    if (!fs.existsSync(dummyImgPath)) {
        fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
        // write a valid tiny image (1x1 red pixel)
        fs.writeFileSync(dummyImgPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 'base64'));
    }

    // 1. Push
    console.log("Pushing new listing with image...");
    const pushRes = await axios.post('http://localhost:3000/api/etsy/push', {
      quantity: "999",
      title: "Temporary E2E File Test",
      description: "Test description",
      price: "3.99",
      category: "Digital Prints",
      section: "",
      primary_color: "",
      occasion: "",
      celebration: "",
      subject: "",
      tags: "test",
      images: "/test.jpg",
      digital_file: ""
    });
    
    const newListingId = pushRes.data.listing_id;
    console.log("Created Listing ID:", newListingId);

    // 2. Update
    console.log("Updating listing with same image...");
    const updateRes = await axios.post('http://localhost:3000/api/etsy/push', {
      listing_id: newListingId,
      quantity: "999",
      title: "Temporary E2E File Test (UPDATED)",
      description: "Test description updated",
      price: "4.99",
      category: "Digital Prints",
      section: "",
      primary_color: "",
      occasion: "",
      celebration: "",
      subject: "",
      tags: "test",
      images: "/test.jpg",
      digital_file: ""
    });
    
    console.log("Update Success:", updateRes.data);
  } catch (err) {
    console.error("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

testEtsyUpdateE2EFiles();
