const fs = require('fs');
const path = require('path');

const FOLDER_NAME = 'skull-shirt';
const LISTINGS_DIR = path.join(__dirname, '../public/listings', FOLDER_NAME);

function scanAssets() {
  if (!fs.existsSync(LISTINGS_DIR)) {
    console.error(`❌ Folder not found: ${LISTINGS_DIR}`);
    return;
  }

  const files = fs.readdirSync(LISTINGS_DIR);
  
  // Separate images from digital files
  const imageFiles = files.filter(f => f.match(/\.(png|jpg|jpeg)$/i));
  const digitalFiles = files.filter(f => !f.match(/\.(png|jpg|jpeg)$/i));

  // Sort images numerically based on the prefix (e.g., "1_Main.png" -> 1)
  imageFiles.sort((a, b) => {
    const numA = parseInt(a.split('_')[0]) || 999;
    const numB = parseInt(b.split('_')[0]) || 999;
    return numA - numB;
  });

  console.log('--- ASSET SCAN RESULTS ---');
  console.log(`Folder: /public/listings/${FOLDER_NAME}/\n`);
  
  console.log('🖼️  Images (Ordered automatically):');
  imageFiles.forEach((file, index) => {
    console.log(`   Position ${index + 1}: ${file}`);
  });

  console.log('\n📦 Digital Asset File:');
  digitalFiles.forEach(file => {
    console.log(`   - ${file}`);
  });
}

scanAssets();
