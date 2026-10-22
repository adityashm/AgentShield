const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../frontend/public/stitch_downloads');
const files = fs.readdirSync(dir);
const htmlFiles = files.filter(f => f.endsWith('.html'));

console.log('Total HTML files in public/stitch_downloads:', htmlFiles.length);

const externalRefs = new Set();
const relativeRefs = [];

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // match href="..." or src="..."
  const regex = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ref = match[1];
    if (ref.startsWith('http') || ref.startsWith('//')) {
      externalRefs.add(ref);
    } else if (!ref.startsWith('#') && !ref.startsWith('data:')) {
      relativeRefs.push({ file, ref });
    }
  }
});

console.log('Unique external resources referenced across all HTML files:');
externalRefs.forEach(r => console.log(' -', r));

console.log('\nRelative file references found across all HTML files:', relativeRefs.length);
relativeRefs.forEach(r => console.log(' - File:', r.file, '-> Ref:', r.ref));
