import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const vocabPath = path.join(rootDir, 'data', 'vocabulary.json');
const versesPath = path.join(rootDir, 'data', 'quran-context-verses.json');
const altVersesPath = path.join(rootDir, 'data', 'quran.json');
const curriculumPath = path.join(rootDir, 'data', 'curriculum.json');
const wordsDictPath = path.join(rootDir, 'data', 'quran-words.json');

console.log('🔍 Starting Comprehensive Dataset Audit...');

const issues = [];
const stats = {
  vocabCount: 0,
  uniqueIds: 0,
  duplicateIds: 0,
  missingIds: 0,
  missingArabic: 0,
  missingBnMeaning: 0,
  missingEnMeaning: 0,
  emptyRoots: 0,
  rootsByPos: {},
  curriculumLevels: 0,
  versesCount: 0,
  wordsDictEntries: 0,
  brokenVerseRefsInVocab: 0,
  levelWordCounts: {},
  rootStatusCounts: {
    verified: 0,
    not_applicable: 0,
    needs_review: 0
  }
};

// 1. Audit Vocabulary
if (fs.existsSync(vocabPath)) {
  const raw = fs.readFileSync(vocabPath, 'utf8');
  let vocab = [];
  try {
    vocab = JSON.parse(raw);
  } catch (e) {
    issues.push({ id: 'FILE_PARSE', field: 'vocabulary.json', type: 'MALFORMED_JSON', severity: 'CRITICAL', details: e.message });
  }

  if (Array.isArray(vocab)) {
    stats.vocabCount = vocab.length;
    const seenIds = new Set();

    // Check Quran verses for cross-referencing
    let quranVersesMap = {};
    if (fs.existsSync(versesPath)) {
      try {
        quranVersesMap = JSON.parse(fs.readFileSync(versesPath, 'utf8'));
      } catch (e) {}
    } else if (fs.existsSync(altVersesPath)) {
      try {
        quranVersesMap = JSON.parse(fs.readFileSync(altVersesPath, 'utf8'));
      } catch (e) {}
    }
    stats.versesCount = Object.keys(quranVersesMap).length;

    vocab.forEach((item, index) => {
      const id = item.id || `IDX_${index}`;
      if (!item.id) {
        stats.missingIds++;
        issues.push({ id, field: 'id', type: 'MISSING_ID', severity: 'HIGH' });
      } else if (seenIds.has(item.id)) {
        stats.duplicateIds++;
        issues.push({ id: item.id, field: 'id', type: 'DUPLICATE_ID', severity: 'CRITICAL' });
      } else {
        seenIds.add(item.id);
      }

      if (!item.lemma_ar || !item.lemma_ar.trim()) {
        stats.missingArabic++;
        issues.push({ id, field: 'lemma_ar', type: 'MISSING_ARABIC_TEXT', severity: 'CRITICAL' });
      }

      if (!item.primary_meaning_bn || !item.primary_meaning_bn.trim()) {
        stats.missingBnMeaning++;
        issues.push({ id, field: 'primary_meaning_bn', type: 'MISSING_BN_MEANING', severity: 'HIGH' });
      }

      if (!item.primary_meaning_en || !item.primary_meaning_en.trim()) {
        stats.missingEnMeaning++;
        issues.push({ id, field: 'primary_meaning_en', type: 'MISSING_EN_MEANING', severity: 'MEDIUM' });
      }

      // Root categorization & validation
      const pos = (item.pos || item.word_type || 'UNKNOWN').toUpperCase();
      if (!item.root || !item.root.trim()) {
        stats.emptyRoots++;
        stats.rootsByPos[pos] = (stats.rootsByPos[pos] || 0) + 1;
        // Prepositions, pronouns, conjunctions, particles do not have triliteral roots
        const nonRootTypes = ['P', 'CONJ', 'PRON', 'DEM', 'REL', 'INTG', 'PART', 'VOC', 'PREP', 'ACC', 'NEG', 'RES', 'EXP'];
        const isNonRootPos = nonRootTypes.some(t => pos.includes(t)) ||
          ['particle', 'pronoun', 'preposition', 'conjunction', 'demonstrative'].includes((item.word_type || '').toLowerCase());

        if (isNonRootPos) {
          stats.rootStatusCounts.not_applicable++;
        } else {
          stats.rootStatusCounts.needs_review++;
        }
      } else {
        stats.rootStatusCounts.verified++;
      }

      // Level distribution
      const lvl = item.level || 0;
      stats.levelWordCounts[lvl] = (stats.levelWordCounts[lvl] || 0) + 1;

      // Verse reference validation
      if (item.example_references && Array.isArray(item.example_references)) {
        item.example_references.forEach(ref => {
          if (ref.surah && ref.ayah) {
            const vKey = `${ref.surah}:${ref.ayah}`;
            if (!quranVersesMap[vKey]) {
              stats.brokenVerseRefsInVocab++;
              issues.push({ id, field: 'example_references', type: 'UNRESOLVED_VERSE_REF', severity: 'LOW', ref: vKey });
            }
          }
        });
      }
    });

    stats.uniqueIds = seenIds.size;
  }
}

// 2. Audit Word-by-Word Dictionary
if (fs.existsSync(wordsDictPath)) {
  try {
    const raw = fs.readFileSync(wordsDictPath, 'utf8');
    const dictData = JSON.parse(raw);
    if (dictData.dict) {
      stats.wordsDictEntries = Object.keys(dictData.dict).length;
    }
  } catch (e) {
    issues.push({ id: 'FILE_PARSE', field: 'quran-words.json', type: 'MALFORMED_JSON', severity: 'MEDIUM', details: e.message });
  }
}

// 3. Audit Curriculum
if (fs.existsSync(curriculumPath)) {
  try {
    const raw = fs.readFileSync(curriculumPath, 'utf8');
    const curr = JSON.parse(raw);
    if (curr.levels) {
      stats.curriculumLevels = curr.levels.length;
    }
  } catch (e) {
    issues.push({ id: 'FILE_PARSE', field: 'curriculum.json', type: 'MALFORMED_JSON', severity: 'HIGH' });
  }
}

console.log('--- AUDIT RESULTS ---');
console.log(`Total Vocabulary Items: ${stats.vocabCount}`);
console.log(`Unique IDs: ${stats.uniqueIds}`);
console.log(`Duplicate IDs: ${stats.duplicateIds}`);
console.log(`Missing IDs: ${stats.missingIds}`);
console.log(`Missing Arabic Text: ${stats.missingArabic}`);
console.log(`Missing Bengali Meanings: ${stats.missingBnMeaning}`);
console.log(`Missing English Meanings: ${stats.missingEnMeaning}`);
console.log(`Total Empty Roots: ${stats.emptyRoots} (Not Applicable Particles/Pronouns: ${stats.rootStatusCounts.not_applicable}, Needs Linguistic Review: ${stats.rootStatusCounts.needs_review}, Verified Roots: ${stats.rootStatusCounts.verified})`);
console.log(`Quran Context Verses: ${stats.versesCount}`);
console.log(`Word-Form Dict Entries: ${stats.wordsDictEntries}`);
console.log(`Curriculum Levels: ${stats.curriculumLevels}`);
console.log(`Level Breakdown:`, stats.levelWordCounts);
console.log(`Total Issue Items Logged: ${issues.length}`);

// Write machine readable validation report
const reportPath = path.join(rootDir, 'data', 'dataset-audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  statistics: stats,
  totalIssues: issues.length,
  issuesSummary: {
    critical: issues.filter(i => i.severity === 'CRITICAL').length,
    high: issues.filter(i => i.severity === 'HIGH').length,
    medium: issues.filter(i => i.severity === 'MEDIUM').length,
    low: issues.filter(i => i.severity === 'LOW').length
  },
  issues: issues.slice(0, 300) // Top samples
}, null, 2));

console.log(`✅ Machine-readable report saved to: ${reportPath}`);
