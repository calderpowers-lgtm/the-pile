#!/usr/bin/env python3
"""ISO 4217 currency per country from datahub.io country-codes (ODC-PDDL), copy in data/currency/."""
import csv, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
out = {}
with open(ROOT / "data/currency/country-codes.csv", encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        iso3, code = r["ISO3166-1-Alpha-3"], r["ISO4217-currency_alphabetic_code"].split(",")[0].strip()
        if iso3 and len(code) == 3:
            out[iso3] = [code, r["ISO4217-currency_name"].split(",")[0].strip()]
(ROOT / "src/data/pile-currencies.json").write_text(json.dumps({"source": "datahub.io country-codes (ISO 4217 currency codes), ODC-PDDL", "url": "https://github.com/datasets/country-codes", "countries": out}, separators=(",", ":")))
print(len(out))
