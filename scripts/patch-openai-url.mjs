import fs from 'fs';
import path from 'path';

const file = path.join('node_modules', 'openai', 'dist', 'api', 'core.js');
let text = fs.readFileSync(file, 'utf8');
const needle = "url.parse";
if (text.includes(needle)) {
  text = text.replace(/url\.parse\(([^)]+)\)/g, 'new URL($1)');
  fs.writeFileSync(file, text);
  console.log('Patched url.parse -> new URL in', file);
} else {
  console.log('No url.parse found');
}
