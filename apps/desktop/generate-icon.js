const fs = require('fs');
const path = require('path');

// Simple SVG icon (checkmark in a circle)
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#3b82f6" rx="128"/>
  <path d="M 150 256 L 220 326 L 370 176" stroke="white" stroke-width="48" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const iconPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.svg');
fs.writeFileSync(iconPath, svg);
console.log('✓ Created icon.svg');
