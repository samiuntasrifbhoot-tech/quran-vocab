import fs from 'fs';
import readline from 'readline';

const bwMap = {
  "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا", "b": "ب",
  "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ", "d": "د",
  "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص", "D": "ض",
  "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "_": "ـ", "f": "ف", "q": "ق",
  "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
  "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ"
};

function bwToArabic(bw) {
  if (!bw) return "";
  return bw.split("").map(c => bwMap[c] || c).join("");
}

function cleanAr(str) {
  if (!str) return "";
  return str
    .replace(/\s+/g, "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A\u08D4-\u08E1\u08E3-\u08FF\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

const posBnMap = {
  'N': 'বিশেষ্য (Noun)',
  'PN': 'বিশেষ নাম (Proper Noun)',
  'ADJ': 'গুণবাচক বিশেষণ (Adjective)',
  'V': 'ক্রিয়া (Verb)',
  'PRON': 'সর্বনাম (Pronoun)',
  'DEM': 'ইঙ্গিতবাচক সর্বনাম (Demonstrative)',
  'REL': 'সম্বন্ধবাচক সর্বনাম (Relative)',
  'T': 'কালবাচক অব্যয় (Time Adverb)',
  'LOC': 'স্থানবাচক অব্যয় (Place Adverb)',
  'P': 'পদান্বয়ী অব্যয় / হরফে জার (Preposition)',
  'CONJ': 'সংযোজক অব্যয় / হরফে আতফ (Conjunction)',
  'SUB': 'অধীনস্থ অব্যয় (Subordinating)',
  'ACC': 'নাসব অব্যয় (Accusative particle)',
  'COND': 'শর্তবাচক অব্যয় (Conditional)',
  'EXP': 'ব্যতিক্রমসূচক অব্যয় (Exceptive)',
  'FUT': 'ভবিষ্যদ্বাচক অব্যয় (Future particle)',
  'INTG': 'প্রশ্নবোধক অব্যয় (Interrogative)',
  'NEG': 'না-বোধক অব্যয় (Negative)',
  'PRO': 'নিষেধাজ্ঞাসূচক অব্যয় (Prohibition)',
  'REM': 'পুনরারম্ভক অব্যয় (Resumption)',
  'RES': 'সংকোচনসূচক অব্যয় (Restriction)',
  'VOC': 'সম্বোধনমূলক অব্যয় (Vocative)',
  'INL': 'কুরআনিক আদ্যক্ষর (Initials)'
};

const prefixBnMap = {
  'bi+': { ar: 'بِـ', bn: 'দ্বারা / সাথে / নামে', en: 'by / with / in' },
  'b:P+': { ar: 'بِـ', bn: 'দ্বারা / সাথে', en: 'by / with' },
  'w:CONJ+': { ar: 'وَ', bn: 'এবং / আর', en: 'and' },
  'w:REM+': { ar: 'وَ', bn: 'আর / এবং', en: 'and' },
  'f:CONJ+': { ar: 'فَـ', bn: 'সুতরাং / অতঃপর', en: 'then / so' },
  'f:REM+': { ar: 'فَـ', bn: 'সুতরাং / অতঃপর', en: 'then / so' },
  'l:P+': { ar: 'لِـ', bn: 'জন্য / উদ্দেশ্যে', en: 'for' },
  'l:EMPH+': { ar: 'لَـ', bn: 'নিশ্চয়ই / অবশ্যই', en: 'surely' },
  'k:P+': { ar: 'كَـ', bn: 'মতো / যেমন', en: 'like / as' },
  'Al+': { ar: 'الـ', bn: 'নির্দিষ্ট (the)', en: 'the' },
  's:FUT+': { ar: 'سَـ', bn: 'শীঘ্রই', en: 'will' },
  'A:INTG+': { ar: 'أَ', bn: 'কি? (প্রশ্ন)', en: 'is / are?' }
};

const suffixBnMap = {
  'PRON:3MS': { ar: 'ـهُ', bn: 'তার / তাকে', en: 'him / his' },
  'PRON:3FS': { ar: 'ـهَا', bn: 'তার / তাকে (স্ত্রী)', en: 'her / its' },
  'PRON:3MD': { ar: 'ـهُمَا', bn: 'তাদের উভয়ের', en: 'both of them' },
  'PRON:3MP': { ar: 'ـهُمْ', bn: 'তাদের / তাদেরকে', en: 'them / their' },
  'PRON:3FP': { ar: 'ـهُنَّ', bn: 'তাদের (স্ত্রী)', en: 'them fem' },
  'PRON:2MS': { ar: 'ـكَ', bn: 'তোমার / তোমাকে', en: 'you / your' },
  'PRON:2FS': { ar: 'ـكِ', bn: 'তোমার (স্ত্রী)', en: 'you / your fem' },
  'PRON:2MD': { ar: 'ـكُمَا', bn: 'তোমাদের উভয়ের', en: 'both of you' },
  'PRON:2MP': { ar: 'ـكُمْ', bn: 'তোমাদের / তোমাদেরকে', en: 'you all / your' },
  'PRON:2FP': { ar: 'ـكُنَّ', bn: 'তোমাদের (স্ত্রী)', en: 'you all fem' },
  'PRON:1S': { ar: 'ـي / ـنِي', bn: 'আমার / আমাকে', en: 'me / my' },
  'PRON:1P': { ar: 'ـنَا', bn: 'আমাদের / আমাদেরকে', en: 'us / our' }
};

async function main() {
  console.log('Loading datasets...');
  const vocab = JSON.parse(fs.readFileSync('data/vocabulary.json', 'utf-8'));
  const quran = JSON.parse(fs.readFileSync('data/quran.json', 'utf-8'));

  const vocabByCleanLemma = new Map();
  const vocabByCleanRoot = new Map();

  vocab.forEach(w => {
    const cl = cleanAr(w.lemma_ar);
    if (cl && !vocabByCleanLemma.has(cl)) vocabByCleanLemma.set(cl, w);
    if (cl.startsWith('ال')) {
      const woAl = cl.slice(2);
      if (woAl && !vocabByCleanLemma.has(woAl)) vocabByCleanLemma.set(woAl, w);
    }
    if (w.root) {
      const cr = cleanAr(w.root);
      if (cr) {
        if (!vocabByCleanRoot.has(cr)) vocabByCleanRoot.set(cr, []);
        vocabByCleanRoot.get(cr).push(w);
      }
    }
  });

  console.log('Parsing morphology corpus...');
  const rl = readline.createInterface({
    input: fs.createReadStream('corpus_data/quranic-corpus-morphology-0.4.txt'),
    crlfDelay: Infinity
  });

  const corpusWords = {};
  for await (const line of rl) {
    if (!line.startsWith('(')) continue;
    const parts = line.split('\t');
    const m = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!m) continue;
    const verseKey = `${m[1]}:${m[2]}`;
    if (!quran[verseKey]) continue;

    const wordNum = parseInt(m[3]);
    const wordKey = `${verseKey}:${wordNum}`;
    if (!corpusWords[wordKey]) {
      corpusWords[wordKey] = {
        surah: parseInt(m[1]),
        ayah: parseInt(m[2]),
        wordNum,
        segments: []
      };
    }
    corpusWords[wordKey].segments.push({
      form: parts[1],
      tag: parts[2],
      features: parts[3]
    });
  }

  const resultVerses = {};
  const globalTokenDict = {};

  for (const vKey in quran) {
    const v = quran[vKey];
    const tokens = v.text_ar.trim().split(/\s+/).filter(Boolean);
    resultVerses[vKey] = [];

    tokens.forEach((tok, idx) => {
      const wordNum = idx + 1;
      const cKey = `${vKey}:${wordNum}`;
      const cData = corpusWords[cKey];

      let lemmaAr = '';
      let rootAr = '';
      let posTag = 'N';
      let prefixes = [];
      let suffixes = [];
      let stemForm = '';

      if (cData && cData.segments) {
        cData.segments.forEach(seg => {
          if (seg.features.startsWith('PREFIX|')) {
            const pKey = seg.features.replace('PREFIX|', '');
            prefixes.push(prefixBnMap[pKey] || { ar: bwToArabic(seg.form), bn: 'উপসর্গ', en: 'prefix' });
          } else if (seg.features.startsWith('SUFFIX|')) {
            const sKey = seg.features.replace('SUFFIX|', '');
            suffixes.push(suffixBnMap[sKey] || { ar: bwToArabic(seg.form), bn: 'প্রত্যয়', en: 'suffix' });
          } else if (seg.features.includes('STEM|')) {
            stemForm = bwToArabic(seg.form);
            const lemM = seg.features.match(/LEM:([^|]+)/);
            if (lemM) lemmaAr = bwToArabic(lemM[1]);
            const rootM = seg.features.match(/ROOT:([^|]+)/);
            if (rootM) rootAr = bwToArabic(rootM[1]);
            posTag = seg.tag;
          }
        });
      }

      const cleanTok = cleanAr(tok);
      if (!lemmaAr) lemmaAr = tok;

      const cleanLem = cleanAr(lemmaAr);
      let matchedVocab = vocabByCleanLemma.get(cleanLem);
      if (!matchedVocab && cleanTok) {
        matchedVocab = vocabByCleanLemma.get(cleanTok);
      }
      if (!matchedVocab && cleanTok.startsWith('ال')) {
        matchedVocab = vocabByCleanLemma.get(cleanTok.slice(2));
      }
      if (!matchedVocab && rootAr) {
        const rootMatches = vocabByCleanRoot.get(cleanAr(rootAr));
        if (rootMatches && rootMatches.length > 0) {
          matchedVocab = rootMatches[0];
        }
      }

      let meaningBn = '';
      let meaningEn = '';
      let vocabId = matchedVocab ? matchedVocab.id : null;

      if (matchedVocab) {
        let baseBn = matchedVocab.primary_meaning_bn;
        let baseEn = matchedVocab.primary_meaning_en;

        const prefixBn = prefixes.map(p => p.bn).join(' + ');
        const suffixBn = suffixes.map(s => s.bn).join(' + ');
        const prefixEn = prefixes.map(p => p.en).join(' + ');
        const suffixEn = suffixes.map(s => s.en).join(' + ');

        if (prefixes.length > 0 && suffixes.length > 0) {
          meaningBn = `${baseBn} (${prefixBn} + ${suffixBn})`;
          meaningEn = `${baseEn} (${prefixEn} + ${suffixEn})`;
        } else if (prefixes.length > 0) {
          meaningBn = `${prefixBn} : ${baseBn}`;
          meaningEn = `${prefixEn} : ${baseEn}`;
        } else if (suffixes.length > 0) {
          meaningBn = `${baseBn} (${suffixBn})`;
          meaningEn = `${baseEn} (${suffixEn})`;
        } else {
          meaningBn = baseBn;
          meaningEn = baseEn;
        }

        if (!rootAr && matchedVocab.root) {
          rootAr = matchedVocab.root;
        }
      } else {
        const pNamesBn = prefixes.map(p => p.bn).join(' + ');
        const sNamesBn = suffixes.map(s => s.bn).join(' + ');
        const posDesc = posBnMap[posTag] || 'কুরআনিক শব্দ';

        if (rootAr) {
          meaningBn = `${posDesc} (মূলধাতু: ${rootAr})`;
          meaningEn = `${posTag} form (Root: ${rootAr})`;
        } else if (pNamesBn || sNamesBn) {
          meaningBn = `সংযুক্ত পদ (${[pNamesBn, sNamesBn].filter(Boolean).join(' + ')})`;
          meaningEn = `Compound word`;
        } else {
          meaningBn = posDesc;
          meaningEn = `Quranic word`;
        }
      }

      const breakdownParts = [];
      prefixes.forEach(p => breakdownParts.push(`${p.ar} (${p.bn})`));
      if (stemForm || lemmaAr) {
        breakdownParts.push(`${stemForm || lemmaAr}`);
      }
      suffixes.forEach(s => breakdownParts.push(`${s.ar} (${s.bn})`));

      const wordInfo = {
        w: tok,
        lem: lemmaAr || tok,
        root: rootAr || (matchedVocab ? matchedVocab.root : ''),
        bn: meaningBn,
        en: meaningEn,
        pos: posBnMap[posTag] || (matchedVocab ? matchedVocab.word_type : 'শব্দ'),
        vid: vocabId,
        bk: breakdownParts.length > 1 ? breakdownParts.join(' + ') : ''
      };

      resultVerses[vKey].push(wordInfo);

      if (cleanTok && !globalTokenDict[cleanTok]) {
        globalTokenDict[cleanTok] = {
          lem: wordInfo.lem,
          root: wordInfo.root,
          bn: wordInfo.bn,
          en: wordInfo.en,
          pos: wordInfo.pos,
          vid: wordInfo.vid,
          bk: wordInfo.bk
        };
      }
    });
  }

  const output = {
    verses: resultVerses,
    dict: globalTokenDict
  };

  const outPath = 'data/quran-words.json';
  fs.writeFileSync(outPath, JSON.stringify(output), 'utf-8');
  const sizeMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Generated ${outPath} (${sizeMb} MB) with ${Object.keys(resultVerses).length} verses.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
