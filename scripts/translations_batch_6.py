#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Authentic Quranic translations for vocabulary items 201 to 240.
Tuple format: (EN_primary, BN_primary, list_of_alt_EN, semantic_category)
"""

BATCH_6 = {
    # 201 - 240
    "QCV-0516": ("hypocrites", "মুনাফিকরা, কপট বিশ্বাসীরা", ["double-dealers", "dissemblers"], "Disbelief"),
    "QCV-0517": ("supplication, prayer, calling", "দোয়া, প্রার্থনা, আহ্বান", ["invocation", "appeal"], "Worship"),
    "QCV-0519": ("turned around, returned, overturned", "ফিরে গেল, উল্টে গেল, প্রত্যাবর্তন করল", ["turned back", "overturned"], "Actions"),
    "QCV-0520": ("protected, guarded, shielded", "রক্ষা করল, বাঁচাল, সুরক্ষা দিল", ["shielded", "preserved"], "Actions"),
    "QCV-0523": ("female, woman", "নারী, স্ত্রীবাচক, মেয়ে", ["feminine", "female"], "People"),
    "QCV-0524": ("generation, epoch, century", "প্রজন্ম, যুগ, শতাব্দী", ["epoch", "era"], "Time"),
    "QCV-0525": ("caused to grow, produced vegetation", "উৎপন্ন করল, চারা গজাল", ["germinated", "made flourish"], "Nature"),
    "QCV-0526": ("traveled, journeyed, moved", "ভ্রমণ করল, চলাফেরা করল", ["journeyed", "traversed"], "Actions"),
    "QCV-0527": ("alone, specifically (detached pronoun)", "শুধুমাত্র, কেবল (যেমন: ইয়্যাকা)", ["Thee alone", "Him only"], "Grammar / function words"),
    "QCV-0530": ("refrained, desisted, ceased", "বিরত থাকল, নিবৃত্ত হলো, থামল", ["desisted", "ceased"], "Actions"),
    "QCV-0531": ("dwelt, settled, rested", "বাস করল, স্থির হলো, প্রশান্তি পেল", ["inhabited", "rested"], "Actions"),
    "QCV-0532": ("group, faction, troop", "দল, জামাত, উপদল", ["party", "contingent"], "People"),
    "QCV-0533": ("possessor of (accusative case)", "অধিকারী (যথা: যা মালিন)", ["owner of", "endowed with"], "Grammar / function words"),
    "QCV-0535": ("Jesus (Prophet Isa)", "ঈসা (আ.)", ["Prophet Jesus"], "Prophets"),
    "QCV-0541": ("encompassed, surrounded, hemmed in", "বেষ্টন করল, ঘিরে ফেলল, আয়ত্তে নিল", ["surrounded", "comprehended"], "Allah / Divine Attributes"),
    "QCV-0542": ("explained in detail, differentiated", "বিস্তারিত ব্যাখ্যা করল, বিশদ করল", ["clarified", "distinguished"], "Revelation"),
    "QCV-0544": ("spread out, extended, expanded", "প্রসারিত করল, বিস্তার করল, বিছিয়ে দিল", ["stretched", "unfolded"], "Actions"),
    "QCV-0545": ("recited, read", "পাঠ করল, পড়ল, তিলাওয়াত করল", ["read", "proclaimed"], "Revelation"),
    "QCV-0546": ("spread corruption, caused mischief", "ফ্যাসাদ সৃষ্টি করল, বিশৃঙ্খলা করল", ["ruined", "corrupted"], "Disbelief"),
    "QCV-0547": ("Adam (first human and prophet)", "আদম (আ.)", ["Prophet Adam"], "Prophets"),
    "QCV-0548": ("completed, perfected", "পূর্ণ করল, সমাপ্ত করল, সম্পন্ন করল", ["perfected", "fulfilled"], "Actions"),
    "QCV-0549": ("admonished, exhorted, preached to", "উপদেশ দিল, নসিহত করল", ["counseled", "exhorted"], "Guidance"),
    "QCV-0550": ("good things, pure provisions", "পবিত্র বস্তুসমূহ, উৎকৃষ্ট রিজিক", ["pure provisions", "wholesome things"], "Life"),
    "QCV-0551": ("standing, upright, watchful", "দণ্ডায়মান, অটল, তত্ত্বাবধায়ক", ["upright", "established"], "Actions"),
    "QCV-0552": ("met, encountered", "সাক্ষাৎ করল, মুখোমুখি হলো", ["encountered", "confronted"], "Actions"),
    "QCV-0553": ("covenant, solemn pledge, bond", "দৃঢ় অঙ্গীকার, প্রতিশ্রুতির বন্ধন", ["solemn pact", "treaty"], "Faith"),
    "QCV-0555": ("blind, spiritually oblivious", "অন্ধ, দৃষ্টিহীন, বোধহীন", ["sightless", "heedless"], "People"),
    "QCV-0558": ("seven", "সাত, সপ্ত", ["seven"], "Numbers / quantities"),
    "QCV-0559": ("deniers, those who reject truth", "মিথ্যা প্রতিপন্নকারীরা, অস্বীকারকারীরা", ["rejectors of truth", "fabricators"], "Disbelief"),
    "QCV-0561": ("overcame, conquered, prevailed", "বিজয়ী হলো, পরাভূত করল, জয়ী হলো", ["prevailed", "triumphed"], "Actions"),
    "QCV-0562": ("extended, prolonged, spread", "প্রসারিত করল, বাড়িয়ে দিল, ঢালল", ["stretched out", "prolonged"], "Actions"),
    "QCV-0563": ("fashioned, proportioned, leveled", "সুসামঞ্জস্য করল, সমান করল, বানাল", ["proportioned", "balanced"], "Allah / Divine Attributes"),
    "QCV-0565": ("sin, blame, restriction", "পাপ, দোষ, আপত্তি", ["blame", "guilt"], "Morality"),
    "QCV-0568": ("discloses, reveals, brings to light", "প্রকাশ করে, উন্মোচন করে", ["makes apparent", "reveals"], "Actions"),
    "QCV-0569": ("deceived, deluded, tempted", "প্রতারিত করল, বিভ্রান্ত করল", ["deluded", "beguiled"], "Disbelief"),
    "QCV-0571": ("turned away, averted, diverted", "ফিরিয়ে দিল, অপসারিত করল, সরাল", ["diverted", "averted"], "Actions"),
    "QCV-0572": ("removed, uncovered, lifted (affliction)", "দূর করল, উন্মোচিত করল, সরাল", ["dispelled", "relieved"], "Actions"),
    "QCV-0573": ("made to hear, caused to perceive", "শোনাল, শ্রবণ করাল", ["caused to hear", "alerted"], "Actions"),
    "QCV-0574": ("closer, nearest, more fitting", "নিকটতর, ঘনিষ্ঠতর, অধিক যোগ্য", ["nearer", "more proximate"], "Morality"),
    "QCV-0575": ("best, finest, supreme (feminine)", "সর্বোত্তম, পরম কল্যাণ, জান্নাত", ["supreme good", "most beautiful"], "Allah / Divine Attributes"),
}
