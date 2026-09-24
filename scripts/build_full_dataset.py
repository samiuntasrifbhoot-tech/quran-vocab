#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quranic Arabic Core Vocabulary Builder
Builds the 2,000 core lexical items grounded strictly in:
1. Quranic Arabic Corpus (v0.4) by Kais Dukes
2. Tanzil Quran Text (Uthmani, English Sahih International, Bengali Muhiuddin Khan)
"""

import os
import re
import math
import json
from collections import defaultdict, Counter

# Buckwalter to standard Arabic Unicode mapping
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
    # Replace alif wasla with standard alif for citation lemma
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

print("Helper functions defined.")
