
require('dotenv').config({ path: '.env.local' });

async function testGen() {
  const apiKey = process.env.GOOGLE_API_KEY;
  console.log("Testing generation with key length:", apiKey ? apiKey.length : 0);
  
  const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    })
  });
  
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Response:", text.substring(0, 500));
}

testGen();
