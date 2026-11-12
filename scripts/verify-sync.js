import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const androidAssetsDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets');

console.log('🔍 Verifying Web and Android Assets Synchronization...');

function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

const criticalFiles = [
  'index.html',
  'manifest.json',
  'sw.js',
  'icon.svg',
  'js/app.js',
  'js/srs.js',
  'css/app.css',
  'data/vocabulary.json',
  'data/vocabulary-fallback.json',
  'data/curriculum.json',
  'data/grammar.json',
  'data/quran-context-verses.json'
];

let mismatches = 0;
let missing = 0;

criticalFiles.forEach(relPath => {
  const rootFilePath = path.join(rootDir, relPath);
  const androidFilePath = path.join(androidAssetsDir, relPath);

  if (!fs.existsSync(rootFilePath)) {
    console.warn(`⚠️ Root file does not exist: ${relPath}`);
    return;
  }

  if (!fs.existsSync(androidFilePath)) {
    console.error(`❌ Missing in Android assets: ${relPath}`);
    missing++;
    return;
  }

  const rootHash = getFileHash(rootFilePath);
  const androidHash = getFileHash(androidFilePath);

  if (rootHash !== androidHash) {
    console.error(`❌ Hash mismatch for: ${relPath}`);
    mismatches++;
  } else {
    console.log(`✅ Synchronized: ${relPath}`);
  }
});

// Also verify that critical SRS methods are present in both
const rootSrs = fs.readFileSync(path.join(rootDir, 'js', 'srs.js'), 'utf8');
const androidSrs = fs.readFileSync(path.join(androidAssetsDir, 'js', 'srs.js'), 'utf8');

const requiredMethods = [
  'recordActivity',
  'markDayCompleted',
  'isDayCompleted',
  'advanceDay',
  'jumpToDay',
  'rateWord',
  'getDueWords',
  'getWeakWords',
  'getActiveLearnedWords',
  'getMasteredWords',
  'getStats',
  'getDailyMission',
  'getMemorizeDeck',
  'exportData',
  'importData',
  'resetAll',
  'saveState',
  'initStorage',
  'restoreFromAnyBackup',
  'checkStreak',
  'toggleWordLearned',
  'getRecord'
];

console.log(`\n🔍 Verifying SRS methods (${requiredMethods.length} required)...`);
let methodErrors = 0;
requiredMethods.forEach(method => {
  const rootHas = rootSrs.includes(`${method}(`);
  const androidHas = androidSrs.includes(`${method}(`);
  if (!rootHas) {
    console.error(`❌ Root js/srs.js missing method: ${method}`);
    methodErrors++;
  }
  if (!androidHas) {
    console.error(`❌ Android js/srs.js missing method: ${method}`);
    methodErrors++;
  }
  if (rootHas && androidHas) {
    console.log(`  ✓ Method verified in both builds: ${method}`);
  }
});

if (mismatches > 0 || missing > 0 || methodErrors > 0) {
  console.error(`\n❌ Synchronization verification failed: ${mismatches} mismatches, ${missing} missing, ${methodErrors} method errors.`);
  console.error('Run "npm run sync:android" to synchronize assets from root to Android project.');
  process.exit(1);
} else {
  console.log('\n✅ All web and Android assets are 100% synchronized and identical.');
  process.exit(0);
}
