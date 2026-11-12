import fs from 'fs';

// Arabic to Buckwalter mapping
const arToBw = {
  'ء': '\'', 'أ': '>', 'ؤ': '&', 'إ': '<', 'ئ': '}',
  'ا': 'A', 'ب': 'b', 'ة': 'p', 'ت': 't', 'ث': 'v',
  'ج': 'j', 'ح': 'H', 'خ': 'x', 'د': 'd', 'ذ': '*',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': '$', 'ص': 'S',
  'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'E', 'غ': 'g',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm',
  'ن': 'n', 'ه': 'h', 'و': 'w', 'ى': 'Y', 'ي': 'y'
};

const bwToAr = {};
for (const [ar, bw] of Object.entries(arToBw)) {
  bwToAr[bw] = ar;
}

function buckwalterToArabic(text) {
  return text.split('').map(c => bwToAr[c] || c).join('');
}

function cleanRootArabic(str) {
  return (str || '')
    .replace(/\s+/g, '') // remove spaces between letters like 'ح و ل' -> 'حول'
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآء]/g, 'ا') // normalize alif/hamza
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

// Parse corpus_data/quranic-corpus-morphology-0.4.txt
const corpusRaw = fs.readFileSync('corpus_data/quranic-corpus-morphology-0.4.txt', 'utf8');
const corpusLines = corpusRaw.split('\n');

const corpusRootsBw = new Set();
const corpusRootsAr = new Set();

for (const line of corpusLines) {
  if (!line || line.startsWith('#')) continue;
  const match = line.match(/ROOT:([A-Za-z*&<>'`$]+)/);
  if (match) {
    const rootBw = match[1];
    corpusRootsBw.add(rootBw);
    const rootAr = buckwalterToArabic(rootBw);
    corpusRootsAr.add(rootAr);
  }
}

console.log('Total unique roots in Quranic Corpus:', corpusRootsAr.size);

// Load vocabulary.json
const vocab = JSON.parse(fs.readFileSync('data/vocabulary.json', 'utf8'));

let exactBwMatches = 0;
let variantMatches = 0;
let unmatchedRoots = [];
let emptyRootsCount = 0;

vocab.forEach(item => {
  const root = (item.root || '').trim();
  if (!root) {
    emptyRootsCount++;
    return;
  }

  const cleanAr = root.replace(/\s+/g, '');
  const bw = cleanAr.split('').map(c => arToBw[c] || c).join('');

  if (corpusRootsBw.has(bw)) {
    exactBwMatches++;
  } else {
    // Check normalized
    const norm = cleanRootArabic(root);
    let found = false;
    for (const cr of corpusRootsAr) {
      if (cleanRootArabic(cr) === norm) {
        found = true;
        break;
      }
    }
    if (found) {
      variantMatches++;
    } else {
      unmatchedRoots.push({ id: item.id, lemma: item.lemma_ar, root });
    }
  }
});

console.log('\n--- ROOT AUDIT RESULTS ---');
console.log('Total vocabulary items:', vocab.length);
console.log('Empty roots:', emptyRootsCount);
console.log('Non-empty claimed roots:', exactBwMatches + variantMatches + unmatchedRoots.length);
console.log('Exact direct transliteration root matches with Leeds Corpus:', exactBwMatches);
console.log('Orthographic variant matches (e.g. Alif/Hamza/Ya variants):', variantMatches);
console.log('Total verified against Leeds Corpus:', exactBwMatches + variantMatches);
console.log('Unmatched roots count:', unmatchedRoots.length);
if (unmatchedRoots.length > 0) {
  console.log('Unmatched root details:', JSON.stringify(unmatchedRoots, null, 2));
}
