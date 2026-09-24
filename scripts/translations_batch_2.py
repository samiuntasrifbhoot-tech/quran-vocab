#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Authentic Quranic translations for vocabulary items 41 to 80.
Tuple format: (EN_primary, BN_primary, list_of_alt_EN, semantic_category)
"""

BATCH_2 = {
    # 41 - 80
    "QCV-0224": ("struck, afflicted, befell", "আঘাত করল, স্পর্শ করল, ঘটল", ["afflicted", "reached"], "Actions"),
    "QCV-0225": ("decreed, decided, fulfilled", "ফয়সালা করল, আদেশ দিল, সম্পন্ন করল", ["decreed", "judged"], "Judgment"),
    "QCV-0230": ("Quran, recitation", "কুরআন, তিলাওয়াত", ["recitation", "Scripture"], "Revelation"),
    "QCV-0231": ("prayer, worship", "সালাত, নামাজ, প্রার্থনা", ["ritual prayer", "supplication"], "Worship"),
    "QCV-0234": ("worlds, all creation, mankind", "বিশ্বজগৎ, সমস্ত সৃষ্টি, সৃষ্টিজগৎ", ["all creation", "realms"], "Allah / Divine Attributes"),
    "QCV-0238": ("became arrogant, waxed proud", "অহংকার করল, ঔদ্ধত্য দেখাল", ["showed pride", "disdained"], "Morality"),
    "QCV-0240": ("on that Day, at that time", "সেই দিন, সেদিন", ["at that moment", "then"], "Time"),
    "QCV-0241": ("touched, afflicted, reached", "স্পর্শ করল, পৌঁছাল", ["afflicted", "grazed"], "Actions"),
    "QCV-0244": ("little, few, small amount", "কম, সামান্য, অল্প", ["slight", "scarce"], "Numbers / quantities"),
    "QCV-0247": ("bounty, grace, favor", "অনুগ্রহ, দয়া, ফজিলত", ["grace", "virtue"], "Allah / Divine Attributes"),
    "QCV-0249": ("however, but, nevertheless", "কিন্তু, তথাপি", ["yet", "on the other hand"], "Grammar / function words"),
    "QCV-0251": ("righteous deeds, good works", "সৎকর্মসমূহ, নেক কাজ", ["virtuous acts", "good deeds"], "Faith"),
    "QCV-0252": ("sent, raised, resurrected", "পাঠাল, পুনরুজ্জীবিত করল, উঠাল", ["resurrected", "dispatched"], "Actions"),
    "QCV-0257": ("asked forgiveness, sought pardon", "ক্ষমা চাইল, ইস্তিগফার করল", ["sought pardon", "repented"], "Worship"),
    "QCV-0259": ("leaves, forsakes, leaves behind", "ছেড়ে দেয়, পরিত্যাগ করে", ["abandons", "leaves alone"], "Actions"),
    "QCV-0260": ("much, many, abundant", "অনেক, অধিক, প্রচুর", ["abundant", "numerous"], "Numbers / quantities"),
    "QCV-0265": ("warned, gave warning", "সতর্ক করল, সাবধান করল", ["cautioned", "admonished"], "Guidance"),
    "QCV-0266": ("possessed, owned (right hand possesses)", "মালিক হলো, অধিকার করল", ["owned", "held right"], "Social"),
    "QCV-0269": ("fabricated, invented (lies)", "বানিয়ে নিল, মিথ্যা রচনা করল", ["concocted", "invented"], "Disbelief"),
    "QCV-0273": ("severe, harsh, intense", "কঠোর, প্রচণ্ড, তীব্র", ["harsh", "violent"], "Morality"),
    "QCV-0275": ("showed, made to see", "দেখাল, প্রদর্শন করল", ["revealed", "displayed"], "Actions"),
    "QCV-0276": ("wretched is, evil is, vile is", "কতই না নিকৃষ্ট! অতি মন্দ!", ["wretched is", "evil is"], "Morality"),
    "QCV-0281": ("died, passed away", "মৃত্যুবরণ করল, মারা গেল", ["perished", "passed away"], "Death"),
    "QCV-0284": ("daytime, daylight", "দিন, দিবস, দিবাভাগ", ["daylight", "day"], "Time"),
    "QCV-0285": ("was able, had capacity", "সক্ষম হলো, পারল", ["could", "had power to"], "Actions"),
    "QCV-0287": ("warner, one who cautions", "সতর্ককারী, ভীতি প্রদর্শনকারী", ["herald of caution", "messenger"], "Prophets"),
    "QCV-0288": ("God-fearing, the righteous", "মুত্তাকীগণ, সংযমী ব্যক্তিরা", ["the righteous", "pious"], "Faith"),
    "QCV-0289": ("grieves, sorrows, saddens", "দুঃখ পায়, শোক করে", ["worries", "grieves"], "Emotions"),
    "QCV-0290": ("nation, community, people", "উম্মত, জাতি, সম্প্রদায়", ["generation", "group"], "People"),
    "QCV-0291": ("criminal, sinner, guilty", "অপরাধী, পাপী, পাপিষ্ঠ", ["sinner", "culprit"], "Disbelief"),
    "QCV-0292": ("received glad tidings, rejoiced", "সুসংবাদ পেল, আনন্দিত হলো", ["was given good news", "gladly informed"], "Paradise"),
    "QCV-0293": ("carried, bore, loaded", "বহন করল, ধারণ করল", ["bore", "endured"], "Actions"),
    "QCV-0294": ("settled, ascended, leveled", "সমাসীন হলো, সোজা হলো, সমান করল", ["ascended", "established firmly"], "Allah / Divine Attributes"),
    "QCV-0295": ("tasted, experienced", "স্বাদ গ্রহণ করল, আস্বাদন করল", ["experienced", "endured"], "Actions"),
    "QCV-0297": ("all, entirely, together", "সবাই, সকলে, সমবেত", ["together", "entirety"], "Numbers / quantities"),
    "QCV-0299": ("punished, tormented, chastised", "শাস্তি দিল, আযাব দিল", ["tormented", "chastised"], "Hell"),
    "QCV-0300": ("feared, was in awe of", "ভয় করল, শ্রদ্ধাভরে ডরাল", ["dreaded", "revered"], "Emotions"),
    "QCV-0302": ("unseen, mystery, hidden realm", "অদৃশ্য, অগোচর, গায়েব", ["hidden realm", "unperceived"], "Faith"),
    "QCV-0304": ("reached, attained, arrived at", "পৌঁছাল, লাভ করল, উপনীত হলো", ["arrived at", "attained"], "Actions"),
    "QCV-0306": ("sought, desired, aspired for", "কামনা করল, সন্ধান করল, চাইল", ["sought", "desired"], "Actions"),
}
