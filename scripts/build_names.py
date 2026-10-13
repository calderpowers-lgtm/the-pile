#!/usr/bin/env python3
"""Build src/data/pile-names.json from the CC0 popular-names-by-country dataset.

Source: https://github.com/sigpwned/popular-names-by-country-dataset (CC0 1.0).
That dataset compiles Wikipedia's per-country name lists, which cite national
statistics offices and civil registries. Copies of the CSVs live in data/names/.

Weights: a published count or percent when the list has one; otherwise 1/rank
(a Zipf approximation, flagged as such on the sheet).
"""
import csv, json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "names"
OUT = ROOT / "src" / "data" / "pile-names.json"

def read(name):
    with open(SRC / name, encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))

def main():
    out = defaultdict(dict)
    fore = defaultdict(list)
    for r in read("common-forenames-by-country.csv"):
        if r["Gender"] in ("M", "F"):
            fore[(r["Country"], r["Gender"])].append(r)
    for (cc, g), rows in fore.items():
        seen, names = set(), []
        for r in rows:
            key = r["Name Group"]
            nm = (r["Romanized Name"] or r["Localized Name"]).strip()
            if not nm or key in seen:
                continue
            seen.add(key)
            names.append([nm, round(1 / int(r["Index"] or len(names) + 1), 4)])
        years = sorted({r["Year"] for r in rows if r["Year"]})
        out[cc][g] = {"w": "rank", "years": "–".join([years[0], years[-1]]) if len(years) > 1 else (years[0] if years else ""), "n": names}
    sur = defaultdict(list)
    for r in read("common-surnames-by-country.csv"):
        sur[r["Country"]].append(r)
    for cc, rows in sur.items():
        seen, names, counted = set(), [], all(r["Count"] or r["Percent"] for r in rows)
        for r in rows:
            key = r["Name Group"]
            nm = (r["Romanized Name"] or r["Localized Name"]).strip()
            if not nm or key in seen:
                continue
            seen.add(key)
            if counted:
                w = float(r["Count"]) if r["Count"] else float(r["Percent"]) * 1e6
            else:
                w = round(1 / int(r["Rank"] or len(names) + 1), 4)
            names.append([nm, w])
        out[cc]["S"] = {"w": "count" if counted else "rank", "n": names}
    data = {
        "source": "Popular Names by Country Dataset (sigpwned), compiled from Wikipedia per-country lists that cite national statistics offices and civil registries",
        "license": "CC0 1.0",
        "url": "https://github.com/sigpwned/popular-names-by-country-dataset",
        "countries": dict(sorted(out.items())),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(len(out), "countries,", OUT.stat().st_size, "bytes")

if __name__ == "__main__":
    main()
