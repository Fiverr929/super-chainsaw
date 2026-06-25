const http = require('http');

const data = JSON.stringify({
  existingData: {
    title: "Men's Cotton T-Shirt",
    bullet_points_auto: true
  },
  requestedFields: ["title", "bullet_points", "keywords"],
  rules: {
    title: "Write a short title.",
    bullet_points: "Write exactly 3 bullet points separated by newlines.",
    keywords: "Write 3 comma separated keywords."
  },
  context: "A simple black t-shirt."
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/amazon/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
