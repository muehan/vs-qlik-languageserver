const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, 'src', 'qlik_keywords.csv');
const dest = path.resolve(__dirname, 'out', 'qlik_keywords.csv');

fs.copyFileSync(src, dest);
console.log('✅ CSV copied to out/');
