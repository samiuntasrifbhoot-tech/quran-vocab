#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete Quranic Arabic Core Lexical Dataset Builder
Produces:
- /data/vocabulary.json (2,000 core items, QCV-0001 to QCV-2000)
- /data/vocabulary-validation.json (comprehensive linguistic validation report)
- /data/quran.json (compact verified Tanzil verse dataset with EN and BN)
- /data/grammar.json (grammatical foundations and particle reference)
- /data/curriculum.json (20 pedagogical levels curriculum)
- /data/README.md (detailed documentation of methodology and sources)
"""

import os
import re
import math
import json
from collections import defaultdict, Counter

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Buckwalter to Arabic dictionary
BW_TO_AR = {
    "'": 'ء', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', 'A': 'ا', 'b': 'ب',
    'p': 'ة', 't': 'ت', 'v': 'ث', 'j': 'ج', 'H': 'ح', 'x': 'خ', 'd': 'د',
    '*': 'ذ', 'r': 'ر', 'z': 'ز', 's': 'س', '$': 'ش', 'S': 'ص', 'D': 'ض',
    'T': 'ط', 'Z': 'ظ', 'E': 'ع', 'g': 'غ', '_': 'ـ', 'f': 'ف', 'q': 'ق',
    'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'h': 'ه', 'w': 'و', 'Y': 'ى',
    'y': 'ي', 'F': 'ً', 'N': 'ٌ', 'K': 'ٍ', 'a': 'َ', 'u': 'ُ', 'i': 'ِ',
    '~': 'ّ', 'o': 'ْ', '^': 'ٓ', '#': 'ٔ', '`': 'ٰ', '{': 'ٱ'
}

def bw2ar(s):
    if not s:
        return ""
    return "".join(BW_TO_AR.get(c, c) for c in s)

def clean_arabic_lemma(ar_str):
    if not ar_str:
        return ""
    # Strip initial shadda from assimilation
    if len(ar_str) > 1 and ar_str[1] == 'ّ':
        ar_str = ar_str[0] + ar_str[2:]
    # Replace initial alif wasla with standard alif for citation lemma
    if ar_str.startswith('ٱ'):
        ar_str = 'ا' + ar_str[1:]
    return ar_str

def format_root(bw_root):
    if not bw_root or bw_root == "-":
        return ""
    ar_root = bw2ar(bw_root)
    # clean diacritics
    ar_root = re.sub(r'[\u064B-\u065F\u0670]', '', ar_root)
    return " ".join(list(ar_root))

def romanize_arabic(ar_text):
    """Produces clean pedagogical transliteration"""
    char_map = {
        'ء': "'", 'أ': "a", 'إ': "i", 'ؤ': "u", 'ئ': "i", 'آ': "aa",
        'ا': "a", 'ب': "b", 'ت': "t", 'ث': "th", 'ج': "j", 'ح': "h",
        'خ': "kh", 'د': "d", 'ذ': "dh", 'ر': "r", 'ز': "z", 'س': "s",
        'ش': "sh", 'ص': "s", 'ض': "d", 'ط': "t", 'ظ': "dh", 'ع': "'",
        'غ': "gh", 'ف': "f", 'ق': "q", 'ك': "k", 'ل': "l", 'م': "m",
        'ن': "n", 'ه': "h", 'و': "w", 'ي': "y", 'ى': "aa", 'ة': "h",
        'َ': "a", 'ُ': "u", 'ِ': "i", 'ْ': "", 'ّ': "", 'ٰ': "aa", 'ٱ': "a"
    }
    res = []
    for c in ar_text:
        res.append(char_map.get(c, ""))
    out = "".join(res)
    # compress repeated vowels
    out = re.sub(r'a{3,}', 'aa', out)
    out = re.sub(r'i{3,}', 'ee', out)
    out = re.sub(r'u{3,}', 'oo', out)
    return out if out else "word"

print("1. Parsing Tanzil Quran verses...")
quran_verses = {}
with open("quran-uthmani.txt", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
            s, a = int(parts[0]), int(parts[1])
            quran_verses[(s, a)] = {"ar": parts[2], "en": "", "bn": ""}

print(f"Loaded {len(quran_verses)} Arabic Quran verses from Tanzil.")

# Load English
with open("quran-en.txt", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
            s, a = int(parts[0]), int(parts[1])
            if (s, a) in quran_verses:
                quran_verses[(s, a)]["en"] = parts[2]

# Load Bengali
with open("quran-bn.txt", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
            s, a = int(parts[0]), int(parts[1])
            if (s, a) in quran_verses:
                quran_verses[(s, a)]["bn"] = parts[2]

print("Tanzil verses in Arabic, English, and Bengali loaded successfully.")
