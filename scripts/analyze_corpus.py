import os
import re
from collections import defaultdict, Counter

def main():
    lemmas = defaultdict(lambda: {
        "pos": Counter(),
        "tag": Counter(),
        "roots": Counter(),
        "tokens": 0,
        "ayahs": set(),
        "surahs": set(),
        "forms": Counter(),
        "verb_forms": Counter(),
        "first_seen": None,
        "sample_refs": []
    })

    total_tokens = 0
    with open("corpus_data/quranic-corpus-morphology-0.4.txt", "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.strip().split("\t")
            if len(parts) >= 4:
                total_tokens += 1
                loc, form, tag, feat = parts[0], parts[1], parts[2], parts[3]
                m_loc = re.match(r"\((\d+):(\d+):(\d+):(\d+)\)", loc)
                if not m_loc:
                    continue
                s, a, w, tok = int(m_loc.group(1)), int(m_loc.group(2)), int(m_loc.group(3)), int(m_loc.group(4))
                
                lem_match = re.search(r"LEM:([^|]+)", feat)
                if lem_match:
                    lem = lem_match.group(1)
                    lem_info = lemmas[lem]
                    lem_info["tokens"] += 1
                    lem_info["ayahs"].add((s, a))
                    lem_info["surahs"].add(s)
                    lem_info["tag"][tag] += 1
                    lem_info["forms"][form] += 1
                    if lem_info["first_seen"] is None:
                        lem_info["first_seen"] = (s, a)
                    if len(lem_info["sample_refs"]) < 5 and (s, a) not in lem_info["sample_refs"]:
                        lem_info["sample_refs"].append((s, a))
                    
                    pos_match = re.search(r"POS:([^|]+)", feat)
                    if pos_match:
                        lem_info["pos"][pos_match.group(1)] += 1
                    
                    root_match = re.search(r"ROOT:([^|]+)", feat)
                    if root_match:
                        lem_info["roots"][root_match.group(1)] += 1
                    
                    vf_match = re.search(r"\(([IVXLCDM]+)\)", feat)
                    if vf_match:
                        lem_info["verb_forms"][vf_match.group(1)] += 1

    print(f"Total corpus tokens processed: {total_tokens}")
    print(f"Total distinct lemmas with LEM: {len(lemmas)}")
    
    sorted_lemmas = sorted(lemmas.items(), key=lambda x: len(x[1]["ayahs"]), reverse=True)
    print("\nTop 20 lemmas by ayah coverage:")
    for lem, info in sorted_lemmas[:20]:
        t_pos = info["pos"].most_common(1)[0][0] if info["pos"] else "N/A"
        t_root = info["roots"].most_common(1)[0][0] if info["roots"] else "-"
        print(f"  LEM: {lem:<15} | POS: {t_pos:<5} | ROOT: {t_root:<6} | Tokens: {info['tokens']:<5} | Ayahs: {len(info['ayahs']):<4} | Surahs: {len(info['surahs']):<3}")

if __name__ == "__main__":
    main()
