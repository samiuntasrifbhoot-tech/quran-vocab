import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const targetAssetsDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets');

console.log('🔄 Syncing web assets into Android project...');
console.log(`Source: ${rootDir}`);
console.log(`Destination: ${targetAssetsDir}`);

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'android' || entry === 'scripts') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Ensure target assets directory exists
if (!fs.existsSync(targetAssetsDir)) {
  fs.mkdirSync(targetAssetsDir, { recursive: true });
}

// Copy primary files and folders
const itemsToCopy = [
  'index.html',
  'manifest.json',
  'icon.svg',
  'sw.js',
  'css',
  'js',
  'data'
];

for (const item of itemsToCopy) {
  const srcPath = path.join(rootDir, item);
  const destPath = path.join(targetAssetsDir, item);
  if (fs.existsSync(srcPath)) {
    console.log(` -> Copying ${item}...`);
    copyRecursive(srcPath, destPath);
  }
}

console.log('✅ Android web assets synchronized successfully!');
