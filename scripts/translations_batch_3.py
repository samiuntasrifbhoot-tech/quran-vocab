#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Authentic Quranic translations for vocabulary items 81 to 120.
Tuple format: (EN_primary, BN_primary, list_of_alt_EN, semantic_category)
"""

BATCH_3 = {
    # 81 - 120
    "QCV-0308": ("saved, rescued, delivered", "উদ্ধার করল, বাঁচাল, মুক্তি দিল", ["rescued", "delivered"], "Actions"),
    "QCV-0313": ("turned away, hindered, averted", "বাধা দিল, বিরত রাখল, মুখ ফেরাল", ["prevented", "diverted"], "Disbelief"),
    "QCV-0314": ("best-knowing, most knowledgeable", "সর্বজ্ঞ, সবচেয়ে বেশি অবগত", ["most knowing", "all-aware"], "Allah / Divine Attributes"),
    "QCV-0316": ("differed, disputed, disagreed", "মতভেদ করল, মতানৈক্য করল", ["disputed", "varied"], "Disbelief"),
    "QCV-0317": ("evil became, was bad", "মন্দ হলো, নিকৃষ্ট হলো", ["was bad", "evil was"], "Morality"),
    "QCV-0318": ("forbidden made, prohibited", "হারাম করল, নিষিদ্ধ করল", ["prohibited", "made unlawful"], "Worship"),
    "QCV-0320": ("straight, upright, guided", "সরল, সোজা, সুদৃঢ়", ["upright", "direct"], "Guidance"),
    "QCV-0322": ("evil, misfortune, harm", "মন্দ, ক্ষতি, অমঙ্গল, পাপ", ["harm", "misfortune"], "Morality"),
    "QCV-0324": ("prostrated, bowed in worship", "সিজদা করল, অবনত হলো", ["bowed down", "did prostration"], "Worship"),
    "QCV-0325": ("faith, belief, conviction", "ঈমান, বিশ্বাস, ধর্মবিশ্বাস", ["belief", "trust"], "Faith"),
    "QCV-0327": ("possessors of, endowed with (pl.)", "অধিকারীগণ, ওয়ালাগণ", ["owners of", "endowed with"], "Grammar / function words"),
    "QCV-0328": ("praise, thanksgiving, commendation", "প্রশংসা, হামদ, কৃতজ্ঞতা", ["gratitude", "thanksgiving"], "Worship"),
    "QCV-0330": ("as for, but regarding", "পক্ষান্তরে, আর ... এর ব্যাপারে", ["as to", "whereas"], "Grammar / function words"),
    "QCV-0333": ("turned away, evaded, disdained", "উপেক্ষা করল, মুখ ফিরিয়ে নিল", ["disregarded", "evaded"], "Disbelief"),
    "QCV-0335": ("saw, perceived clearly, observed", "দেখল, প্রত্যক্ষ করল, প্রত্যক্ষদর্শী হলো", ["perceived", "looked intently"], "Actions"),
    "QCV-0336": ("availed, profited, enriched", "উপকারে আসল, কাজে আসল, সমৃদ্ধ করল", ["profited", "availed"], "Actions"),
    "QCV-0337": ("glory, exalted is, transcendent is", "মহিমা, পবিত্রতা, সুবহান", ["exaltedness", "glorification"], "Allah / Divine Attributes"),
    "QCV-0340": ("misguidance, astray, error", "পথভ্রষ্টতা, গোমরাহি, বিভ্রান্তি", ["going astray", "error"], "Disbelief"),
    "QCV-0344": ("sent forth, put forward, offered", "অগ্রবর্তী করল, পেশ করল, আগে পাঠাল", ["put forward", "advanced"], "Actions"),
    "QCV-0345": ("forgot, neglected", "ভুলে গেল, অবহেলা করল", ["neglected", "omitted"], "Actions"),
    "QCV-0347": ("women, wives, females", "নারীগণ, মহিলারা, স্ত্রীগণ", ["females", "ladies"], "People"),
    "QCV-0349": ("path, straight way, highway", "পথ, সরল পথ, সিরাজ", ["pathway", "course"], "Guidance"),
    "QCV-0350": ("mountain, mount", "পাহাড়, পর্বত", ["mount", "hill"], "Nature"),
    "QCV-0352": ("reformed, made right, rectified", "সংশোধন করল, ভালো করল, মেরামত করল", ["rectified", "improved"], "Morality"),
    "QCV-0353": ("became (in morning), entered morning", "হয়ে গেল, সকালে উপনীত হলো", ["turned into", "arrived at morning"], "Actions"),
    "QCV-0360": ("name, noun, appellation", "নাম, পদবী", ["appellation", "title"], "Other"),
    "QCV-0361": ("best, fairest, most excellent", "সর্বোত্তম, অতি সুন্দর, শ্রেষ্ঠ", ["fairest", "most beautiful"], "Morality"),
    "QCV-0362": ("adorned, made pleasing, beautified", "সুশোভিত করল, আকর্ষণীয় করল", ["beautified", "embellished"], "Actions"),
    "QCV-0363": ("sufficed, was enough, satisfied", "যথেষ্ট হলো, রক্ষা করল", ["was sufficient", "satisfied"], "Allah / Divine Attributes"),
    "QCV-0364": ("answered, responded, granted", "সাড়া দিল, কবুল করল, উত্তর দিল", ["responded", "granted prayer"], "Worship"),
    "QCV-0367": ("evil deeds, sins, misdeeds", "মন্দ কাজসমূহ, পাপরাশি, গুনাহ", ["sins", "misdeeds"], "Disbelief"),
    "QCV-0369": ("perhaps, maybe, it may be", "হয়তো, সম্ভবতঃ, আশা করা যায়", ["it may be that", "hopefully"], "Grammar / function words"),
    "QCV-0370": ("woe! destruction! ruin!", "ধ্বংস! দুর্ভোগ! সর্বনাশ!", ["ruin to", "woe unto"], "Hell"),
    "QCV-0371": ("dead, deceased, lifeless", "মৃত, নির্জীব, প্রাণহীন", ["deceased", "lifeless"], "Death"),
    "QCV-0372": ("remained, stayed, tarried", "অবস্থান করল, থাকল, বিলম্ব করল", ["tarried", "stayed"], "Time"),
    "QCV-0375": ("authority, clear proof, power", "কর্তৃত্ব, সনদ, স্পষ্ট প্রমাণ", ["proof", "mandate"], "Faith"),
    "QCV-0376": ("took back (soul), caused to die", "ওফাত দিল, প্রাণ হরণ করল, পূর্ণ নিল", ["took soul", "caused to die"], "Death"),
    "QCV-0381": ("strove, struggled (in Allah's cause)", "জিহাদ করল, প্রচেষ্টা চালাল", ["struggled", "exerted effort"], "Worship"),
    "QCV-0382": ("cattle, livestock, grazing beasts", "গৃহপালিত পশু, গবাদি পশু", ["livestock", "flocks"], "Nature"),
    "QCV-0383": ("passed away, passed by, became empty", "অতিবাহিত হলো, চলে গেল, নির্জন হলো", ["passed away", "went before"], "Time"),
}
