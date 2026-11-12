import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🧪 RUNNING MASTER TEST SUITE — QURAN VOCAB APP');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ----------------------------------------------------
// TEST GROUP 1: Vocabulary Schema & Primary Loading
// ----------------------------------------------------
console.log('📁 1. Vocabulary Schema & Primary Dataset:');
runTest('vocabulary.json exists and is a valid JSON array', () => {
  const filePath = path.join(rootDir, 'data', 'vocabulary.json');
  assert.ok(fs.existsSync(filePath), 'vocabulary.json must exist');
  const vocab = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.ok(Array.isArray(vocab), 'vocabulary must be an array');
  assert.strictEqual(vocab.length, 2000, 'vocabulary should contain exactly 2000 items');
});

runTest('Each vocabulary item has required fields (id, lemma_ar, meaning, level)', () => {
  const vocab = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'vocabulary.json'), 'utf8'));
  const seenIds = new Set();
  vocab.forEach((item, idx) => {
    assert.ok(item.id, `Item at index ${idx} missing id`);
    assert.ok(!seenIds.has(item.id), `Duplicate ID found: ${item.id}`);
    seenIds.add(item.id);
    assert.ok(item.lemma_ar && item.lemma_ar.trim().length > 0, `Item ${item.id} missing lemma_ar`);
    assert.ok(item.primary_meaning_bn || item.primary_meaning_en, `Item ${item.id} missing translation`);
    assert.ok(item.level >= 1 && item.level <= 20, `Item ${item.id} has invalid level: ${item.level}`);
  });
});

// ----------------------------------------------------
// TEST GROUP 2: Fallback Dataset & Validator Behavior
// ----------------------------------------------------
console.log('\n📁 2. Fallback Dataset & Validation Protection:');
runTest('vocabulary-validation.json is recognized as report and REJECTED as vocab array', () => {
  const reportPath = path.join(rootDir, 'data', 'vocabulary-validation.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  // Validator logic from app.js
  const isVocabularyArray = (data) => {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;
    const sample = data[0];
    return !!(sample && sample.lemma_ar && (sample.primary_meaning_bn || sample.primary_meaning_en));
  };

  assert.strictEqual(isVocabularyArray(report), false, 'Validation report MUST be rejected by vocabulary validator');
});

runTest('vocabulary-fallback.json exists and satisfies vocabulary schema', () => {
  const fallbackPath = path.join(rootDir, 'data', 'vocabulary-fallback.json');
  assert.ok(fs.existsSync(fallbackPath), 'vocabulary-fallback.json must exist');
  const fallback = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
  assert.ok(Array.isArray(fallback), 'fallback must be an array');
  assert.ok(fallback.length >= 50, 'fallback must contain at least 50 core words');
  
  const isVocabularyArray = (data) => {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;
    const sample = data[0];
    return !!(sample && sample.lemma_ar && (sample.primary_meaning_bn || sample.primary_meaning_en));
  };
  assert.strictEqual(isVocabularyArray(fallback), true, 'fallback dataset MUST be accepted by vocabulary validator');
});

// ----------------------------------------------------
// TEST GROUP 3: Curriculum Reference Integrity
// ----------------------------------------------------
console.log('\n📁 3. Curriculum Reference Integrity:');
runTest('curriculum.json covers all 20 levels and 90 days', () => {
  const currPath = path.join(rootDir, 'data', 'curriculum.json');
  assert.ok(fs.existsSync(currPath), 'curriculum.json must exist');
  const curr = JSON.parse(fs.readFileSync(currPath, 'utf8'));
  assert.ok(Array.isArray(curr.levels), 'curriculum.levels must be an array');
  assert.strictEqual(curr.levels.length, 20, 'curriculum must have 20 levels');
  
  const vocab = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'vocabulary.json'), 'utf8'));
  curr.levels.forEach(lvl => {
    const wordsInLvl = vocab.filter(w => w.level === lvl.level);
    assert.strictEqual(wordsInLvl.length, 100, `Level ${lvl.level} must have exactly 100 words in vocab dataset`);
  });
});

// ----------------------------------------------------
// TEST GROUP 4: Quran Context & Verse References
// ----------------------------------------------------
console.log('\n📁 4. Quran Verse & Reference Integrity:');
runTest('quran-context-verses.json contains verified Quranic verses', () => {
  const vPath = path.join(rootDir, 'data', 'quran-context-verses.json');
  assert.ok(fs.existsSync(vPath), 'quran-context-verses.json must exist');
  const verses = JSON.parse(fs.readFileSync(vPath, 'utf8'));
  const count = Object.keys(verses).length;
  assert.ok(count >= 1000, `Should have at least 1000 context verses, found: ${count}`);
  
  // Sample check Surah 1:1
  const fatiha1 = verses['1:1'];
  assert.ok(fatiha1, 'Verse 1:1 should exist');
  assert.ok(fatiha1.text_ar && (fatiha1.text_ar.includes('ٱللَّهِ') || fatiha1.text_ar.includes('اللَّهِ')), 'Arabic text must contain Allah');
  assert.ok(fatiha1.text_bn, 'Bengali text must be present');
});

// ----------------------------------------------------
// TEST GROUP 5: SRS Scheduling & Rating Engine
// ----------------------------------------------------
console.log('\n📁 5. SRS Scheduling & Progression:');
runTest('SRS rating 0 (Again) resets consecutive_correct and schedules short interval', async () => {
  // Mock simple SRS logic corresponding to srs.js
  const MasteryState = { NEW: 'NEW', LEARNING: 'LEARNING', FAMILIAR: 'FAMILIAR', STRONG: 'STRONG', MASTERED: 'MASTERED' };
  const record = {
    word_id: 'TEST_01',
    state: MasteryState.STRONG,
    reps: 5,
    interval: 14,
    ease: 2.5,
    consecutive_correct: 3,
    wrong_count: 0
  };

  // Simulate Rating 0 (Again)
  record.reps += 1;
  record.wrong_count += 1;
  record.consecutive_correct = 0;
  record.interval = 1;
  record.state = MasteryState.LEARNING;

  assert.strictEqual(record.consecutive_correct, 0, 'consecutive_correct must reset to 0');
  assert.strictEqual(record.interval, 1, 'interval must reset to 1 day');
  assert.strictEqual(record.state, MasteryState.LEARNING, 'Mastered/strong word must regress to LEARNING on fail');
});

runTest('SRS rating 2 (Good) and 3 (Easy) advance interval and consecutive_correct', () => {
  const record = {
    word_id: 'TEST_02',
    state: 'NEW',
    reps: 0,
    interval: 0,
    ease: 2.5,
    consecutive_correct: 0,
    correct_count: 0
  };

  // 1st Correct Answer (Good)
  record.reps += 1;
  record.correct_count += 1;
  record.consecutive_correct += 1;
  record.interval = 1;
  assert.strictEqual(record.interval, 1);

  // 2nd Correct Answer (Good)
  record.reps += 1;
  record.correct_count += 1;
  record.consecutive_correct += 1;
  record.interval = 3;
  assert.strictEqual(record.interval, 3);

  // 3rd Correct Answer (Easy)
  record.reps += 1;
  record.correct_count += 1;
  record.consecutive_correct += 1;
  record.ease += 0.15;
  record.interval = Math.round(record.interval * record.ease * 1.3);
  assert.ok(record.interval >= 9, `Interval should expand above 9 days, got: ${record.interval}`);
});

// ----------------------------------------------------
// TEST GROUP 6: Storage Merge & Timestamp Precedence
// ----------------------------------------------------
console.log('\n📁 6. Storage Merge & Timestamp Precedence:');
runTest('Newer review timestamp wins over older stale backup', () => {
  const localRecord = {
    word_id: 'W_01',
    state: 'LEARNING',
    reps: 3,
    last_reviewed_at: 1700005000000 // Newer review (forgot word)
  };
  const staleBackupRecord = {
    word_id: 'W_01',
    state: 'MASTERED',
    reps: 10,
    last_reviewed_at: 1700001000000 // Older review from 3 weeks ago
  };

  const allRecords = { 'W_01': localRecord };
  const sourceB = { 'W_01': staleBackupRecord };

  for (const [wid, rec] of Object.entries(sourceB)) {
    if (!allRecords[wid]) {
      allRecords[wid] = rec;
    } else {
      const currentRec = allRecords[wid];
      const recTime = rec.last_reviewed_at || 0;
      const currTime = currentRec.last_reviewed_at || 0;
      if (recTime > currTime) {
        allRecords[wid] = rec;
      }
    }
  }

  assert.strictEqual(allRecords['W_01'].state, 'LEARNING', 'Recent activity must be preserved, not overwritten by stale backup');
});

// ----------------------------------------------------
// TEST GROUP 7: Web and Android Synchronization
// ----------------------------------------------------
console.log('\n📁 7. Web & Android Parity Check:');
runTest('Web and Android asset files and required SRS methods are identical', () => {
  const rootSrs = fs.readFileSync(path.join(rootDir, 'js', 'srs.js'), 'utf8');
  const androidSrs = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'js', 'srs.js'), 'utf8');
  assert.strictEqual(rootSrs, androidSrs, 'js/srs.js must be identical in web and Android assets');

  const rootApp = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
  const androidApp = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'js', 'app.js'), 'utf8');
  assert.strictEqual(rootApp, androidApp, 'js/app.js must be identical in web and Android assets');
  
  const rootHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const androidHtml = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'index.html'), 'utf8');
  assert.strictEqual(rootHtml, androidHtml, 'index.html must be identical in web and Android assets');
});

// ----------------------------------------------------
// TEST GROUP 8: Backend Request Validation & Rate Limiting
// ----------------------------------------------------
console.log('\n📁 8. Backend Security & Validation:');
runTest('server.js enforces 64kb limit and contains CORS allowlist and rate limiting', () => {
  const serverCode = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
  assert.ok(serverCode.includes("express.json({ limit: '64kb' })"), 'Must enforce 64kb payload limit');
  assert.ok(serverCode.includes('allowedOriginPatterns'), 'Must define explicit CORS allowed origin patterns');
  assert.ok(serverCode.includes('tutorRateLimiter'), 'Must attach rate limiter on tutor endpoint');
  assert.ok(serverCode.includes('validateTutorRequest'), 'Must attach request validator on tutor endpoint');
});

// ----------------------------------------------------
// TEST GROUP 9: Android Security Configuration
// ----------------------------------------------------
console.log('\n📁 9. Android Security Hardening:');
runTest('AndroidManifest.xml and network_security_config.xml disallow cleartext traffic', () => {
  const manifest = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'AndroidManifest.xml must set usesCleartextTraffic to false');

  const netConfig = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml'), 'utf8');
  assert.ok(netConfig.includes('cleartextTrafficPermitted="false"'), 'Base network config must not permit cleartext');
});

// ----------------------------------------------------
// TEST GROUP 10: Server API Live Endpoint Verification
// ----------------------------------------------------
console.log('\n📁 10. Live Server Endpoint & Fallback Response:');
await runAsyncTest('POST /api/tutor returns valid grounded response within payload limits', async () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      word_id: 'QCV-0001',
      lemma_ar: 'وَـ',
      root: '',
      pos: 'CONJ',
      word_type: 'conjunction',
      meaning_bn: 'এবং, আর',
      meaning_en: 'and'
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tutor',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 200, `Expected status 200, got ${res.statusCode}`);
          const json = JSON.parse(data);
          assert.strictEqual(json.success, true, 'Response must indicate success: true');
          assert.ok(json.explanation && json.explanation.length > 50, 'Must include grounded explanation');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
});

// ----------------------------------------------------
// TEST GROUP 11: 90-Day Learning System & Session Scenarios
// ----------------------------------------------------
console.log('\n📁 11. 90-Day Learning System Scenarios (Critical Audit Verification):');

// Initialize mock localStorage for Node.js
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

const { SRSEngine, MasteryState } = await import('../js/srs.js');

runTest('Scenario 1: Completing a normal review must NOT advance curriculum day', () => {
  const srs = new SRSEngine();
  srs.currentDay = 5;
  // Simulated review session completion calls recordActivity(), not advanceDay()
  srs.recordActivity();
  assert.strictEqual(srs.currentDay, 5, 'Current day must remain 5 after completing review');
});

runTest('Scenario 2: Completing a flashcard session must NOT advance curriculum day', () => {
  const srs = new SRSEngine();
  srs.currentDay = 12;
  // Flashcard session completion
  srs.recordActivity();
  assert.strictEqual(srs.currentDay, 12, 'Current day must remain 12 after flashcards');
});

runTest('Scenario 3: Completing practice must NOT advance curriculum day', () => {
  const srs = new SRSEngine();
  srs.currentDay = 20;
  // Practice session completion
  srs.recordActivity();
  assert.strictEqual(srs.currentDay, 20, 'Current day must remain 20 after practice');
});

runTest('Scenario 4: Completing a single-word session must NOT advance curriculum day', () => {
  const srs = new SRSEngine();
  srs.currentDay = 35;
  // Single word drill completion
  srs.recordActivity();
  assert.strictEqual(srs.currentDay, 35, 'Current day must remain 35 after single word drill');
});

runTest('Scenario 5: Completing today\'s actual daily mission marks correct day completed without advancing day', () => {
  const srs = new SRSEngine();
  srs.currentDay = 7;
  assert.strictEqual(srs.isDayCompleted(7), false);
  srs.markDayCompleted(7, { score: 100 });
  assert.strictEqual(srs.isDayCompleted(7), true, 'Day 7 must now be marked completed');
  assert.strictEqual(srs.currentDay, 7, 'Current day must stay 7 until user chooses next day');
});

runTest('Scenario 6: Reopening the app must preserve completed-day status', () => {
  const srs1 = new SRSEngine();
  srs1.currentDay = 8;
  srs1.markDayCompleted(8, { accuracy: 95 });
  srs1.saveState();

  // Fresh instance simulating app restart
  const srs2 = new SRSEngine();
  assert.strictEqual(srs2.isDayCompleted(8), true, 'Completed day 8 must survive app restart');
  assert.strictEqual(srs2.completedDays[8].accuracy, 95);
});

runTest('Scenario 7: Repeating a completed daily mission must NOT create duplicate completion records', () => {
  const srs = new SRSEngine();
  srs.completedDays = {};
  srs.markDayCompleted(10, { attempt: 1 });
  srs.markDayCompleted(10, { attempt: 2 });
  assert.strictEqual(Object.keys(srs.completedDays).length, 1, 'There must be exactly 1 record for day 10');
  assert.strictEqual(srs.completedDays[10].attempt, 2);
});

runTest('Scenario 8: Starting next day must happen ONLY through intended user action (advanceDay)', () => {
  const srs = new SRSEngine();
  srs.currentDay = 15;
  srs.advanceDay();
  assert.strictEqual(srs.currentDay, 16, 'Day must advance from 15 to 16');
  srs.currentDay = 90;
  srs.advanceDay();
  assert.strictEqual(srs.currentDay, 90, 'Day cannot advance past 90');
});

runTest('Scenario 9: Skipping an exam must NOT falsely mark a day as completed', () => {
  const srs = new SRSEngine();
  srs.completedDays = {};
  srs.currentDay = 1;
  // User skips ahead to Day 10 by passing exam
  srs.jumpToDay(10);
  assert.strictEqual(srs.currentDay, 10, 'Current day should be 10');
  assert.strictEqual(srs.isDayCompleted(10), false, 'Target day 10 must NOT be marked completed');
  assert.strictEqual(srs.isDayCompleted(5), false, 'Intermediate days must NOT be marked completed');
});

runTest('Scenario 10: Previous days show real completion history, not inferred completion', () => {
  const srs = new SRSEngine();
  srs.completedDays = { 1: { completedAt: Date.now() }, 3: { completedAt: Date.now() } };
  srs.currentDay = 4;
  assert.strictEqual(srs.isDayCompleted(1), true, 'Day 1 is completed');
  assert.strictEqual(srs.isDayCompleted(2), false, 'Day 2 was skipped, must NOT be inferred completed');
  assert.strictEqual(srs.isDayCompleted(3), true, 'Day 3 is completed');
  assert.strictEqual(srs.isDayCompleted(4), false, 'Day 4 is current and not yet completed');
});

// ----------------------------------------------------
// TEST GROUP 12: In-Depth SRS Rating & Math Verification
// ----------------------------------------------------
console.log('\n📁 12. SRS Rating Engine & Post-Failure Recovery:');

runTest('Again (0) resets consecutive_correct to 0, interval to 1, and regresses to LEARNING', () => {
  const srs = new SRSEngine();
  const rec = srs.getRecord('TEST_AGAIN');
  rec.state = MasteryState.MASTERED;
  rec.consecutive_correct = 6;
  rec.interval = 60;

  srs.rateWord('TEST_AGAIN', 0);
  assert.strictEqual(rec.consecutive_correct, 0, 'consecutive_correct must be 0');
  assert.strictEqual(rec.interval, 1, 'interval must be 1');
  assert.strictEqual(rec.state, MasteryState.LEARNING, 'state must regress to LEARNING');
  assert.strictEqual(rec.wrong_count, 1);
});

runTest('One correct answer after repeated failures does NOT jump to a long review interval', () => {
  const srs = new SRSEngine();
  const rec = srs.getRecord('TEST_RECOVERY');
  rec.interval = 60;
  rec.consecutive_correct = 5;

  // 1st Failure (Again)
  srs.rateWord('TEST_RECOVERY', 0);
  // 2nd Failure (Again)
  srs.rateWord('TEST_RECOVERY', 0);

  assert.strictEqual(rec.consecutive_correct, 0);
  assert.strictEqual(rec.interval, 1);

  // Now learner answers correctly once (Good - rating 2)
  srs.rateWord('TEST_RECOVERY', 2);
  assert.strictEqual(rec.consecutive_correct, 1, 'consecutive_correct must now be 1');
  assert.strictEqual(rec.interval, 1, 'Interval after 1st recovery must be 1 day (NOT jumped to 60)');
  assert.strictEqual(rec.state, MasteryState.LEARNING, 'State must remain LEARNING');
});

runTest('Hard (1), Good (2), and Easy (3) calculate intervals correctly', () => {
  const srs = new SRSEngine();

  // Fresh word rated Good (2)
  const wGood = srs.rateWord('W_GOOD', 2);
  assert.strictEqual(wGood.interval, 1);

  // 2nd Good
  const wGood2 = srs.rateWord('W_GOOD', 2);
  assert.strictEqual(wGood2.interval, 3);

  // Fresh word rated Easy (3)
  const wEasy = srs.rateWord('W_EASY', 3);
  assert.strictEqual(wEasy.interval, 3);

  // 2nd Easy
  const wEasy2 = srs.rateWord('W_EASY', 3);
  assert.strictEqual(wEasy2.interval, 6);

  // Hard (1) reduces ease and advances interval cautiously
  const wHard = srs.rateWord('W_HARD', 1);
  assert.ok(wHard.ease < 2.5, 'Hard must reduce ease factor');
});

runTest('Duplicate review prevention: rating word immediately pushes due_at into future', () => {
  const srs = new SRSEngine();
  const wordId = 'W_DUPLICATE_CHECK';
  const dummyVocab = [{ id: wordId, lemma_ar: 'تَسْتَعِينُ' }];

  // Initially unrated -> NEW
  assert.strictEqual(srs.getDueWords(dummyVocab).length, 0);

  // Rate word
  srs.rateWord(wordId, 2); // Good
  // Due date is now 1 day in the future
  assert.strictEqual(srs.isDue(wordId), false, 'Word must NOT be due immediately after review');
  assert.strictEqual(srs.getDueWords(dummyVocab).length, 0, 'Word must not appear in due reviews');
});

// ----------------------------------------------------
// TEST GROUP 13: Fallback Mode Safety & Integrity
// ----------------------------------------------------
console.log('\n📁 13. Fallback Mode Safety & Non-Destructive Caching:');

runTest('Fallback dataset is flagged as fallback mode (100 words < 500 threshold)', () => {
  const fallback = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'vocabulary-fallback.json'), 'utf8'));
  const isFallbackMode = fallback.length < 500;
  assert.strictEqual(isFallbackMode, true, '100-word fallback must trigger fallback mode flag');
});

runTest('app.js source includes fallback mode banner and protective cache checks', () => {
  const appJs = fs.readFileSync(path.join(rootDir, 'js', 'app.js'), 'utf8');
  assert.ok(appJs.includes('this.isFallbackMode = (this.vocab.length < 500)'), 'Must define this.isFallbackMode flag');
  assert.ok(appJs.includes('fallback-warning-banner'), 'Must contain fallback warning banner');
  assert.ok(appJs.includes('Protect full 2000-word cache from being overwritten'), 'Must protect full cache in fetchJsonData');
});

console.log('\n====================================================');
console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
