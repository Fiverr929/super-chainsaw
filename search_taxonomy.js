const fs = require('fs');

const data = JSON.parse(fs.readFileSync('taxonomy.json'));
const results = {};
const targets = [
  "Wall Art", "Digital Patterns", "Fonts", "Digital Paper", 
  "SVG", "Presets", "Lightroom", "Patterns", "Paper", "Stickers"
];

function searchNode(node, path) {
  const currentPath = path ? path + " > " + node.name : node.name;
  
  for (const t of targets) {
    if (node.name.toLowerCase().includes(t.toLowerCase())) {
      if (!results[t]) results[t] = [];
      results[t].push({ id: node.id, path: currentPath });
    }
  }
  
  if (node.children) {
    for (const child of node.children) {
      searchNode(child, currentPath);
    }
  }
}

for (const result of data.results) {
  searchNode(result, "");
}

for (const [t, arr] of Object.entries(results)) {
  console.log(`\n=== ${t} ===`);
  for (const item of arr) {
    console.log(`[${item.id}] ${item.path}`);
  }
}
