const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const TAXONOMY_MAP = {
  "Store Graphics": 769,
  "Digital Prints": 2078,
  "Digital Planners": 354,
  "Templates": 1874,
  "Clip Art": 7663,
  "Wall Art": 2078,
  "Digital Patterns": 7192,
  "Fonts": 10620,
  "Logos & Branding": 1877,
  "Social Media Templates": 12486,
  "Website Templates": 2818,
  "Digital Paper": 1251,
  "SVG Files": 7663,
  "Lightroom Presets": 12107
};

async function checkAllProperties() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    
    for (const [name, id] of Object.entries(TAXONOMY_MAP)) {
      console.log(`\n=== Properties for ${name} (${id}) ===`);
      const res = await axios.get(`https://api.etsy.com/v3/application/buyer-taxonomy/nodes/${id}/properties`, {
        headers: {
          'x-api-key': `${apiKey}:${sharedSecret}`
        }
      });
      
      const props = res.data.results;
      console.log(`Available properties: ${props.map(p => p.name).join(', ')}`);
      
      // Specifically check for our 4 main ones
      const hasOccasion = props.some(p => p.name.toLowerCase() === 'occasion');
      const hasHoliday = props.some(p => p.name.toLowerCase() === 'holiday');
      const hasSubject = props.some(p => p.name.toLowerCase().includes('subject'));
      const hasColor = props.some(p => p.name.toLowerCase() === 'primary color');
      
      console.log(`Occasion: ${hasOccasion}, Holiday (Celebration): ${hasHoliday}, Subject: ${hasSubject}, Color: ${hasColor}`);
      
      // Sleep slightly to avoid rate limits
      await new Promise(r => setTimeout(r, 250));
    }
  } catch (err) {
    console.error("Error", err.response ? err.response.data : err.message);
  }
}
checkAllProperties();
