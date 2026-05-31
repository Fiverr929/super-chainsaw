require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testUploads() {
  try {
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.ETSY_API_KEY,
      refresh_token: process.env.ETSY_REFRESH_TOKEN
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const shopId = process.env.ETSY_SHOP_ID;
    const listingId = '4513288798'; // The ID we created earlier

    // Test Image Upload
    // Let's create a dummy image first
    const dummyImgPath = path.join(__dirname, 'dummy.jpg');
    if (!fs.existsSync(dummyImgPath)) {
        fs.writeFileSync(dummyImgPath, Buffer.from("fake image content"));
    }

    const fileBuffer = fs.readFileSync(dummyImgPath);
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("image", blob, "dummy.jpg");
    formData.append("alt_text", "This is a test alt text");

    console.log("Uploading image...");
    const res = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`, {
      method: 'POST',
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData
    });

    const data = await res.json();
    console.log("Image Upload Status:", res.status);
    console.log("Image Upload Response:", data);

  } catch (err) {
    console.error("Error:", err);
  }
}

testUploads();
