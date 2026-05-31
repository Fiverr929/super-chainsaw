const axios = require('axios');

async function testUpdate() {
  try {
    const res = await axios.post('http://localhost:3000/api/etsy/push', {
      listing_id: "4513288798",
      quantity: "999",
      title: "Test Listing Update 1",
      description: "This is a test digital listing update",
      price: "4.99",
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
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

testUpdate();
