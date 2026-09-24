# Quranic Arabic Core Lexical Dataset (QCV-2000)

## 1. Overview & Pedagogical Purpose
This dataset provides a carefully selected foundation of **2,000 high-value Quranic Arabic lexical items** (`QCV-0001` through `QCV-2000`), engineered to give serious students of the Quran the strongest possible lexical grounding.

> **Crucial Educational Disclaimer:**  
> Learning 2,000 words alone does **not** guarantee an arbitrary percentage (e.g. 80% or 90%) of Quranic understanding. True Quranic comprehension requires vocabulary combined with grammar (*nahw*), morphology (*sarf*), rhetorical awareness (*balāghah*), repeated Quranic exposure, sentence-level reading, and spaced repetition.

---

## 2. Primary Data Sources
1. **Quranic Arabic Corpus (Version 0.4)** by Kais Dukes (Language and Cognition Research, University of Leeds):
   - Lemma definitions, exact token frequencies, ayah counts, surah counts.
   - Part-of-speech tags and morphological segmentation.
   - Triliteral and quadriliteral root annotations.
   - Derived verbal forms (Forms I–X).
2. **Tanzil Quran Project (Version 1.0.2)**:
   - Verified Uthmani script Quran text (`quran-uthmani.txt`).
   - Sahih International English translation.
   - Muhiuddin Khan Bengali translation.

Every Arabic lemma, frequency, and Quranic reference in this dataset is authentic and verified against these sources.

---

## 3. Lemma-First Architecture
The primary unit of vocabulary is the **LEMMA** (lexical citation form), not redundant inflected surface forms.
- For nouns, the canonical citation lemma is provided (e.g. `رَبّ` instead of separate entries for `رَبُّ`, `رَبَّ`, `رَبِّ`, `رَبَّهُ`).
- For verbs, the 3rd person masculine singular past tense form is used as citation lemma, with conjugated forms and verbal forms cataloged under `morphology`.
- Function words (prepositions, conjunctions, particles, pronouns, demonstratives) receive high priority (~280 entries) because they govern Arabic sentence syntax.

---

## 4. Dataset Schema (`/data/vocabulary.json`)
Each of the 2,000 entries conforms to this structure:
```json
{
  "id": "QCV-0001",
  "lemma_ar": "مِنْ",
  "root": "",
  "transliteration": "min",
  "pos": "P",
  "word_type": "preposition",
  "primary_meaning_en": "from, of",
  "primary_meaning_bn": "থেকে, হইতে, মধ্য থেকে",
  "alternative_meanings": ["out of", "part of", "since"],
  "short_explanation_en": "Primary preposition indicating origin, separation, or partitivity (harf jarr).",
  "semantic_category": "Grammar / function words",
  "frequency_tokens": 3226,
  "ayah_count": 2230,
  "surah_count": 95,
  "priority_score": 98.5,
  "difficulty": 1,
  "level": 1,
  "morphology": {
    "form": "",
    "common_forms": ["مِنْ", "مِنَ"],
    "related_forms": []
  },
  "example_references": [
    {"surah": 1, "ayah": 1},
    {"surah": 2, "ayah": 255}
  ],
  "prerequisites": [],
  "related_word_ids": [],
  "inclusion_reason": "Foundational preposition occurring 3,200+ times across 95 surahs."
}
```

---

## 5. Transparent Learning Priority Scoring (0–100)
The Priority Score is calculated using a multi-factor formula:
$$\text{Score} = 0.30(F) + 0.20(A) + 0.15(S) + 0.15(G) + 0.10(C) + 0.05(M) + 0.05(U)$$
- **Quran Token Frequency ($F$)**: 30% (logarithmically scaled 0–100)
- **Ayah Coverage ($A$)**: 20% (distinct ayahs containing lemma)
- **Surah Coverage ($S$)**: 15% (distinct surahs containing lemma)
- **Grammar/Function Importance ($G$)**: 15% (particles, pronouns, core verbs)
- **Semantic Importance ($C$)**: 10% (theological pillars, divine attributes, eschatology)
- **Morphological Productivity ($M$)**: 5% (density of derived family members in the Quran)
- **Learning Utility ($U$)**: 5% (immediate sentence comprehension unlock)

---

## 6. Level System (20 Levels $\times$ 100 Words)
The 2,000 words are grouped into 20 progressive learning levels:
- **Level 1–2**: Foundational function words, pronouns, demonstratives, and primary divine names.
- **Level 3–5**: High-frequency core action verbs, faith nouns, and cosmic creation vocabulary.
- **Level 6–10**: Common verbs across forms I–X, faculties of mind/heart, guidance, and community.
- **Level 11–15**: Eschatology (Day of Judgment, Paradise, Hell), parables, and prophetic narratives.
- **Level 16–20**: Advanced theological terminology, moral virtues, and nuanced rhetorical gems.

---

## 7. File Structure
- `/data/vocabulary.json`: The complete 2,000 items (QCV-0001 to QCV-2000) with verified morphological, frequency, and pedagogical data.
- `/data/vocabulary-validation.json`: Validation statistics, frequencies, and top 100 rankings.
- `/data/quran-context-verses.json`: Verified Tanzil context verses (1,459 authentic ayahs) referenced by the vocabulary items with Uthmani Arabic text, Sahih International English, and Muhiuddin Khan Bengali translation. *Note: This dataset contains the specific verses used in vocabulary context practice and reading; it is deliberately scoped as context verses, not the complete 6,236 ayahs.*
- `/data/quran.json`: Backward-compatible mirror of the context verses.
- `/data/grammar.json`: Grammatical particle classifications, verbal forms tables (Forms I–X), and functional categories.
- `/data/curriculum.json`: Detailed 20-level pedagogical curriculum with 100 word IDs per level.
