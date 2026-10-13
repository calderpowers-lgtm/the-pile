#!/usr/bin/env python3
"""Build the bundled country dataset for The Pile.

Hits official downloads and APIs. Every stored figure keeps its indicator,
year, and geography. Numbers are not typed in by hand.

Writes:
  src/data/pile-dataset.json
  src/data/pile-gaps.json

Raw responses are cached under data/cache/ so a rerun can resume.
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "src" / "data" / "pile-dataset.json"
GAPS_OUT = ROOT / "src" / "data" / "pile-gaps.json"
RETRIEVED = "2026-10-13"
UA = "ThePileDataset/1.0 (+https://github.com/calderpowers-lgtm/the-pile)"

WPP_BASE = "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES"
WPP_POP = f"{WPP_BASE}/WPP2024_Population1JanuaryByAge5GroupSex_Medium.csv.gz"
WPP_FERT = f"{WPP_BASE}/WPP2024_Fertility_by_Age5.csv.gz"
WPP_DEMO = f"{WPP_BASE}/WPP2024_Demographic_Indicators_Medium.csv.gz"
WPP_YEAR = 2024

FINDEX_URL = "https://thedocs.worldbank.org/en/doc/be6615202d1f08a25855c8ac2d615122-0050012025/related/GlobalFindexDatabase2025.csv"
WID_COUNTRIES = "https://wid.world/bulk_download/WID_countries.csv"
WID_FILE = "https://wid.world/bulk_download/WID_data_{code}.csv"
UNHCR_URL = "https://api.unhcr.org/population/v1/population/?year=2024&limit=300&coa_all=true&page={page}"
RESTCOUNTRIES = "https://restcountries.com/v3.1/all?fields=cca3,currencies"
WHR_PDF = "https://files.worldhappiness.report/WHR26_Statistical_Appendix.pdf"

# World Bank region id -> Findex aggregate code (Findex regions exclude high income).
FINDEX_REGION = {
    "EAS": "EAP",
    "ECS": "ECA",
    "LCN": "LAC",
    "MEA": "MNA",
    "SAS": "SAS",
    "SSF": "SSA",
    "NAC": "HIC",
}

WB_CODES = [
    "SP.URB.TOTL.IN.ZS",
    "SH.H2O.SMDW.ZS",
    "SH.H2O.BASW.ZS",
    "SH.STA.BASS.ZS",
    "SH.STA.SMSS.ZS",
    "SH.H2O.SMDW.UR.ZS",
    "SH.H2O.SMDW.RU.ZS",
    "SH.STA.BASS.UR.ZS",
    "SH.STA.BASS.RU.ZS",
    "SH.XPD.OOPC.CH.ZS",
    "SH.UHC.SRVS.CV.XD",
    "SH.DYN.AIDS.ZS",
    "SH.DYN.AIDS.FE.ZS",
    "SH.DYN.AIDS.MA.ZS",
    "SH.TBS.INCD",
    "SH.MLR.INCD.P3",
    "SH.ANM.ALLW.ZS",
    "SH.ANM.CHLD.ZS",
    "SH.STA.STNT.ZS",
    "SH.STA.STNT.FE.ZS",
    "SH.STA.STNT.MA.ZS",
    "SH.STA.MMRT",
    "SH.STA.DIAB.ZS",
    "SG.VAW.1549.ZS",
    "SN.ITK.MSFI.ZS",
    "SN.ITK.SVFI.ZS",
    "SE.ADT.LITR.ZS",
    "SE.ADT.LITR.FE.ZS",
    "SE.ADT.LITR.MA.ZS",
    "SE.PRM.CUAT.ZS",
    "SE.SEC.CUAT.UP.ZS",
    "SE.TER.CUAT.BA.ZS",
    "SE.PRM.NENR",
    "SE.SEC.NENR",
    "SL.UEM.TOTL.ZS",
    "SL.UEM.TOTL.FE.ZS",
    "SL.UEM.TOTL.MA.ZS",
    "SL.TLF.CACT.ZS",
    "SL.TLF.CACT.FE.ZS",
    "SL.TLF.CACT.MA.ZS",
    "SL.AGR.EMPL.ZS",
    "SL.ISV.IFRM.ZS",
    "SL.ISV.IFRM.FE.ZS",
    "SL.ISV.IFRM.MA.ZS",
    "IT.NET.USER.ZS",
    "IT.CEL.SETS.P2",
    "PA.NUS.PPP",
]

GAPS: list[dict[str, str]] = []


def gap(item: str, detail: str) -> None:
    GAPS.append({"item": item, "detail": detail})
    print(f"GAP {item}: {detail}", flush=True)


def cache_path(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    return CACHE / name


def download(url: str, name: str, timeout: int = 180) -> bytes:
    path = cache_path(name)
    if path.exists() and path.stat().st_size > 0:
        print(f"cache {name}", flush=True)
        return path.read_bytes()
    print(f"get {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = response.read()
            path.write_bytes(data)
            return data
        except Exception as error:  # noqa: BLE001 - retry network errors
            last_error = error
            time.sleep(2 ** attempt)
    raise RuntimeError(f"failed {url}: {last_error}")


def get_json(url: str, name: str, timeout: int = 180) -> object:
    raw = download(url, name, timeout=timeout)
    return json.loads(raw.decode("utf-8-sig"))


def gz_reader(name: str, url: str) -> csv.DictReader:
    download(url, name, timeout=300)
    handle = gzip.open(cache_path(name), "rt", encoding="utf-8-sig", newline="")
    return csv.DictReader(handle)


def num(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    text = str(value).strip().replace(",", "")
    if text in {"", "-", ".", "..", "NA", "null", "None"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def round_num(value: float) -> float:
    return float(f"{value:.8g}")


def wb_countries() -> dict[str, dict]:
    payload = get_json(
        "https://api.worldbank.org/v2/country?format=json&per_page=400",
        "wb-countries.json",
    )
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
    countries: dict[str, dict] = {}
    aggregates: dict[str, dict] = {}
    for row in rows:
        iso3 = row.get("id")
        if not iso3:
            continue
        region = row.get("region") or {}
        income = row.get("incomeLevel") or {}
        record = {
            "iso3": iso3,
            "iso2": row.get("iso2Code") or "",
            "name": row.get("name") or iso3,
            "regionId": region.get("id") or "",
            "regionName": region.get("value") or "",
            "incomeId": income.get("id") or "",
            "incomeName": income.get("value") or "",
        }
        if region.get("id") == "NA" or income.get("id") == "NA":
            aggregates[iso3] = record
        else:
            countries[iso3] = record
    print(f"world bank countries {len(countries)} aggregates {len(aggregates)}", flush=True)
    return {"countries": countries, "aggregates": aggregates}


def wb_indicator_meta(code: str) -> dict:
    url = f"https://api.worldbank.org/v2/indicator/{code}?format=json"
    try:
        payload = get_json(url, f"wb-meta-{code}.json", timeout=60)
    except Exception as error:  # noqa: BLE001
        gap(code, f"World Bank indicator metadata failed: {error}")
        return {"name": code, "sourceOrganization": "World Bank", "sourceNote": ""}
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else None
    if not rows:
        message = payload
        gap(code, f"No World Bank metadata ({message})")
        return {"name": code, "sourceOrganization": "World Bank", "sourceNote": ""}
    row = rows[0]
    return {
        "name": row.get("name") or code,
        "sourceOrganization": row.get("sourceOrganization") or "World Bank",
        "sourceNote": (row.get("sourceNote") or "")[:400],
    }


def wb_series(code: str) -> dict[str, dict]:
    url = (
        "https://api.worldbank.org/v2/country/all/indicator/"
        f"{code}?format=json&mrnev=1&per_page=20000"
    )
    try:
        payload = get_json(url, f"wb-{code}.json", timeout=120)
    except Exception as error:  # noqa: BLE001
        gap(code, f"World Bank data request failed: {error}")
        return {}
    if not isinstance(payload, list) or len(payload) < 2 or not isinstance(payload[1], list):
        gap(code, f"World Bank returned no data rows: {str(payload)[:180]}")
        return {}
    found: dict[str, dict] = {}
    for row in payload[1]:
        if not row or row.get("value") is None:
            continue
        iso3 = row.get("countryiso3code") or ""
        value = num(row.get("value"))
        year = num(row.get("date"))
        if not iso3 or value is None or year is None:
            continue
        found[iso3] = {"v": round_num(value), "y": int(year)}
    if not found:
        gap(code, "World Bank returned only empty values")
    else:
        print(f"wb {code} {len(found)}", flush=True)
    return found


def choose_pip_row(rows: list[dict]) -> dict | None:
    usable = [row for row in rows if num(row.get("mean")) is not None and row.get("reporting_level") in {None, "national"}]
    if not usable:
        return None
    surveys = [row for row in usable if not row.get("is_interpolated")]
    pool = surveys or usable
    pool.sort(key=lambda row: (int(row.get("reporting_year") or 0), 1 if row.get("welfare_type") == "consumption" else 0))
    return pool[-1]


def pip_index(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    if not isinstance(rows, list):
        return {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = row.get("country_code")
        if code:
            grouped[code].append(row)
    return grouped


def income_from_row(row: dict, kind: str) -> dict | None:
    mean = num(row.get("mean"))
    shares = [num(row.get(f"decile{i}")) for i in range(1, 11)]
    if mean is None or any(share is None for share in shares):
        return None
    decile_daily = [round_num(share / 0.1 * mean) for share in shares]  # type: ignore[operator]
    return {
        "year": int(row.get("reporting_year") or 0),
        "welfare": row.get("welfare_type") or "welfare",
        "mean": round_num(mean),
        "median": round_num(num(row.get("median")) or 0),
        "gini": round_num(num(row.get("gini")) or 0),
        "ppp": round_num(num(row.get("ppp")) or 0),
        "decileShare": [round_num(share) for share in shares],  # type: ignore[arg-type]
        "decileDaily": decile_daily,
        "survey": row.get("survey_acronym") or "",
        "kind": kind,
        "interpolated": bool(row.get("is_interpolated")),
        "headcount": {},
        "headcountYear": {},
    }


def load_pip() -> tuple[dict[str, dict], dict[str, dict]]:
    base = "https://api.worldbank.org/pip/v1/pip?country=all&ppp_version=2021&welfare_type=all&reporting_level=national"
    primary = get_json(f"{base}&year=all&povline=3&fill_gaps=false", "pip-line3.json", timeout=300)
    line42 = get_json(f"{base}&year=all&povline=4.2&fill_gaps=false", "pip-line42.json", timeout=300)
    line83 = get_json(f"{base}&year=all&povline=8.3&fill_gaps=false", "pip-line83.json", timeout=300)
    by_country = pip_index(primary if isinstance(primary, list) else [])
    incomes: dict[str, dict] = {}
    for code, rows in by_country.items():
        chosen = choose_pip_row(rows)
        if not chosen:
            continue
        kind = "interpolated" if chosen.get("is_interpolated") else "survey"
        record = income_from_row(chosen, kind)
        if record:
            incomes[code] = record

    def attach_line(payload: object, line_key: str) -> None:
        grouped = pip_index(payload if isinstance(payload, list) else [])
        for code, record in incomes.items():
            rows = grouped.get(code) or []
            same_year = [row for row in rows if int(row.get("reporting_year") or -1) == record["year"]]
            chosen = choose_pip_row(same_year or rows)
            if not chosen:
                continue
            headcount = num(chosen.get("headcount"))
            if headcount is None:
                continue
            record["headcount"][line_key] = round_num(headcount)
            record["headcountYear"][line_key] = int(chosen.get("reporting_year") or record["year"])

    attach_line(primary, "3")
    attach_line(line42, "4.2")
    attach_line(line83, "8.3")
    print(f"pip survey or interpolated countries {len(incomes)}", flush=True)

    missing_note = "filled-gap not requested yet"
    try:
        filled = get_json(
            f"{base}&year=2023&povline=3&fill_gaps=true",
            "pip-fill-3-2023.json",
            timeout=300,
        )
        filled42 = get_json(
            f"{base}&year=2023&povline=4.2&fill_gaps=true",
            "pip-fill-42-2023.json",
            timeout=300,
        )
        filled83 = get_json(
            f"{base}&year=2023&povline=8.3&fill_gaps=true",
            "pip-fill-83-2023.json",
            timeout=300,
        )
        filled_index = pip_index(filled if isinstance(filled, list) else [])
        for code, rows in filled_index.items():
            if code in incomes:
                continue
            chosen = choose_pip_row(rows)
            if not chosen:
                continue
            record = income_from_row(chosen, "filled-gap")
            if record:
                incomes[code] = record

        def attach_fill(payload: object, line_key: str) -> None:
            grouped = pip_index(payload if isinstance(payload, list) else [])
            for code, record in incomes.items():
                if record["kind"] != "filled-gap":
                    continue
                rows = grouped.get(code) or []
                chosen = choose_pip_row(rows)
                if not chosen:
                    continue
                headcount = num(chosen.get("headcount"))
                if headcount is None:
                    continue
                record["headcount"][line_key] = round_num(headcount)
                record["headcountYear"][line_key] = int(chosen.get("reporting_year") or record["year"])

        attach_fill(filled, "3")
        attach_fill(filled42, "4.2")
        attach_fill(filled83, "8.3")
        missing_note = ""
    except Exception as error:  # noqa: BLE001
        missing_note = f"PIP fill_gaps request failed: {error}"
        gap("PIP fill_gaps", missing_note)
    print(f"pip countries after fill {len(incomes)}", flush=True)
    return incomes, {}


def findex_block(rows: list[dict]) -> dict | None:
    def pick(group: str, group2: str, column: str) -> float | None:
        for row in rows:
            if row.get("group") == group and row.get("group2") == group2:
                return num(row.get(column))
        return None

    account_all = pick("all", "all", "account_t_d")
    saved_all = pick("all", "all", "save_any_t_d")
    emergency_all = pick("all", "all", "fin24aP")
    if account_all is None and saved_all is None and emergency_all is None:
        return None
    year = int(num(rows[0].get("year")) or 0)

    def pack(column: str) -> dict:
        return {
            "all": pick("all", "all", column),
            "women": pick("gender", "women", column),
            "men": pick("gender", "men", column),
            "poor40": pick("income", "poorest 40%", column),
            "rich60": pick("income", "richest 60%", column),
        }

    return {
        "year": year,
        "account": pack("account_t_d"),
        "saved": pack("save_any_t_d"),
        "emergency": pack("fin24aP"),
    }


def load_findex() -> tuple[dict[str, dict], dict[str, dict]]:
    raw = download(FINDEX_URL, "findex-2025.csv", timeout=180)
    rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        by_key[(row.get("codewb") or "", row.get("year") or "")].append(row)
    countries: dict[str, dict] = {}
    aggregates: dict[str, dict] = {}
    codes = {code for code, _year in by_key}
    for code in codes:
        years = sorted({year for c, year in by_key if c == code and year.isdigit()}, key=int)
        if not years:
            continue
        year = "2024" if "2024" in years else years[-1]
        block = findex_block(by_key[(code, year)])
        if not block:
            continue
        name = by_key[(code, year)][0].get("countrynewwb") or code
        block["name"] = name
        if len(code) == 3 and code.isalpha() and code not in {"WLD", "SSA", "SAS", "EAP", "ECA", "LAC", "MNA", "HIC", "LIC", "LMC", "UMC"}:
            countries[code] = block
        else:
            aggregates[code] = block
    # Three-letter aggregates were excluded above if I treated all len-3 as countries.
    # Re-home known aggregate codes.
    for code in list(countries):
        if code in {"WLD", "SSA", "SAS", "EAP", "ECA", "LAC", "MNA", "HIC", "LIC", "LMC", "UMC"}:
            aggregates[code] = countries.pop(code)
    print(f"findex countries {len(countries)} aggregates {len(aggregates)}", flush=True)
    return countries, aggregates


def load_wpp() -> dict[str, dict]:
    pop_rows = gz_reader("wpp-pop.csv.gz", WPP_POP)
    fert_rows = gz_reader("wpp-fert.csv.gz", WPP_FERT)
    demo_rows = gz_reader("wpp-demo.csv.gz", WPP_DEMO)
    countries: dict[str, dict] = {}

    age_starts: list[int] | None = None
    for row in pop_rows:
        if row.get("Variant") != "Medium" or row.get("Time") != str(WPP_YEAR):
            continue
        if row.get("LocTypeName") != "Country/Area":
            continue
        iso3 = row.get("ISO3_code") or ""
        if len(iso3) != 3:
            continue
        start = num(row.get("AgeGrpStart"))
        male = num(row.get("PopMale"))
        female = num(row.get("PopFemale"))
        if start is None or male is None or female is None:
            continue
        record = countries.setdefault(
            iso3,
            {
                "iso2": row.get("ISO2_code") or "",
                "name": row.get("Location") or iso3,
                "ages": {},
            },
        )
        record["ages"][int(start)] = (male * 1000.0, female * 1000.0)

    if not countries:
        raise RuntimeError("UN WPP population file produced no countries")
    age_starts = sorted({start for record in countries.values() for start in record["ages"]})
    for record in countries.values():
        male = []
        female = []
        for start in age_starts:
            pair = record["ages"].get(start)
            male.append(int(round(pair[0])) if pair else 0)
            female.append(int(round(pair[1])) if pair else 0)
        record["ageMale"] = male
        record["ageFemale"] = female
        record["pop"] = int(sum(male) + sum(female))
        del record["ages"]

    for row in fert_rows:
        if row.get("Variant") != "Medium" or row.get("Time") != str(WPP_YEAR):
            continue
        if row.get("LocTypeName") != "Country/Area":
            continue
        iso3 = row.get("ISO3_code") or ""
        record = countries.get(iso3)
        if not record:
            continue
        start = num(row.get("AgeGrpStart"))
        asfr = num(row.get("ASFR"))
        if start is None or asfr is None:
            continue
        record.setdefault("asfr", {})[str(int(start))] = round_num(asfr / 1000.0)

    for row in demo_rows:
        if row.get("Variant") != "Medium" or row.get("Time") != str(WPP_YEAR):
            continue
        if row.get("LocTypeName") != "Country/Area":
            continue
        iso3 = row.get("ISO3_code") or ""
        record = countries.get(iso3)
        if not record:
            continue
        record["tfr"] = num(row.get("TFR"))
        record["lex"] = {
            "y": WPP_YEAR,
            "birthM": num(row.get("LExMale")),
            "birthF": num(row.get("LExFemale")),
            "a15M": num(row.get("LE15Male")),
            "a15F": num(row.get("LE15Female")),
            "a65M": num(row.get("LE65Male")),
            "a65F": num(row.get("LE65Female")),
        }

    print(f"wpp countries {len(countries)} age groups {age_starts}", flush=True)
    return {"ageStarts": age_starts, "countries": countries}


def parse_age_band(code: str | None) -> dict | None:
    if not code:
        return None
    if "ALL" in code:
        return {"label": "all ages", "min": 0, "max": 120, "all": True}
    text = code.replace("AGEGROUP_YEARS", "")
    if "PLUS" in text:
        start = num(text.replace("PLUS", ""))
        if start is None:
            return None
        return {"label": f"{int(start)}+", "min": int(start), "max": 120, "all": False}
    if "-" in text:
        left, right = text.split("-", 1)
        lo = num(left)
        hi = num(right)
        if lo is None or hi is None:
            return None
        return {"label": f"{int(lo)}–{int(hi)}", "min": int(lo), "max": int(hi), "all": False}
    return None


def who_pages(code: str, year_from: int) -> list[dict]:
    filt = urllib.parse.quote(f"SpatialDimType eq 'COUNTRY' and TimeDim ge {year_from}")
    url = f"https://ghoapi.azureedge.net/api/{code}?$filter={filt}"
    rows: list[dict] = []
    page = 0
    while url and page < 40:
        page += 1
        payload = get_json(url, f"who-{code}-p{page}.json", timeout=180)
        if not isinstance(payload, dict):
            break
        values = payload.get("value") or []
        rows.extend(values)
        url = payload.get("@odata.nextLink")
    print(f"who {code} rows {len(rows)}", flush=True)
    return rows


def latest_who(rows: list[dict], predicate) -> dict[str, dict]:
    best: dict[str, dict] = {}
    for row in rows:
        if not predicate(row):
            continue
        iso3 = row.get("SpatialDim")
        year = int(row.get("TimeDim") or 0)
        value = num(row.get("NumericValue"))
        if not iso3 or value is None:
            continue
        current = best.get(iso3)
        if current is None or year >= current["y"]:
            if current and year > current["y"]:
                best[iso3] = {"y": year, "rows": [row]}
            elif current and year == current["y"]:
                current["rows"].append(row)
            else:
                best[iso3] = {"y": year, "rows": [row]}
    return best


def load_who() -> dict[str, dict]:
    result: dict[str, dict] = {}

    def ensure(iso3: str) -> dict:
        return result.setdefault(iso3, {})

    try:
        hyp_rows = who_pages("NCD_HYP_PREVALENCE_A", 2010)
        grouped: dict[str, list[dict]] = defaultdict(list)
        for row in hyp_rows:
            if row.get("Dim1") not in {"SEX_FMLE", "SEX_MLE", "SEX_BTSX"}:
                continue
            grouped[row.get("SpatialDim")].append(row)
        for iso3, rows in grouped.items():
            year = max(int(row.get("TimeDim") or 0) for row in rows)
            latest = [row for row in rows if int(row.get("TimeDim") or 0) == year]
            record = {"y": year, "female": None, "male": None, "both": None}
            for row in latest:
                value = num(row.get("NumericValue"))
                if row.get("Dim1") == "SEX_FMLE":
                    record["female"] = value
                elif row.get("Dim1") == "SEX_MLE":
                    record["male"] = value
                elif row.get("Dim1") == "SEX_BTSX":
                    record["both"] = value
            ensure(iso3)["hypertension"] = record
    except Exception as error:  # noqa: BLE001
        gap("WHO hypertension", f"NCD_HYP_PREVALENCE_A failed: {error}")

    try:
        dep_rows = who_pages("GDO_q35", 2000)
        best_year: dict[str, tuple[int, float]] = {}
        for row in dep_rows:
            iso3 = row.get("SpatialDim")
            value = num(row.get("NumericValue"))
            year = int(row.get("TimeDim") or 0)
            if not iso3 or value is None:
                continue
            current = best_year.get(iso3)
            if current is None or year >= current[0]:
                best_year[iso3] = (year, value)
        for iso3, (year, value) in best_year.items():
            ensure(iso3)["depression"] = {"y": year, "v": round_num(value)}
        if best_year:
            years = sorted({year for year, _value in best_year.values()})
            gap(
                "Depression age and sex",
                "WHO GHO GDO_q35 is a national estimate without age or sex. Latest years in the extract: "
                + ", ".join(str(year) for year in years[-4:])
                + ". IHME age-sex prevalence was not available as an open download from this environment.",
            )
    except Exception as error:  # noqa: BLE001
        gap("WHO depression", f"GDO_q35 failed: {error}")

    try:
        suicide_rows = who_pages("SDGSUICIDE", 2018)
        grouped_s: dict[str, list[dict]] = defaultdict(list)
        dim2_seen: set[str] = set()
        for row in suicide_rows:
            if row.get("Dim1") not in {"SEX_FMLE", "SEX_MLE", "SEX_BTSX"}:
                continue
            dim2_seen.add(str(row.get("Dim2")))
            grouped_s[row.get("SpatialDim")].append(row)
        print("suicide age codes", sorted(dim2_seen), flush=True)
        for iso3, rows in grouped_s.items():
            year = max(int(row.get("TimeDim") or 0) for row in rows)
            latest = [row for row in rows if int(row.get("TimeDim") or 0) == year]
            bands = {"female": [], "male": [], "both": []}
            for row in latest:
                band = parse_age_band(row.get("Dim2"))
                value = num(row.get("NumericValue"))
                if not band or value is None:
                    continue
                slot = {"label": band["label"], "min": band["min"], "max": band["max"], "all": band["all"], "v": round_num(value)}
                if row.get("Dim1") == "SEX_FMLE":
                    bands["female"].append(slot)
                elif row.get("Dim1") == "SEX_MLE":
                    bands["male"].append(slot)
                else:
                    bands["both"].append(slot)
            ensure(iso3)["suicide"] = {"y": year, **bands}
    except Exception as error:  # noqa: BLE001
        gap("WHO suicide", f"SDGSUICIDE failed: {error}")

    try:
        indicators = get_json(
            "https://ghoapi.azureedge.net/api/Indicator?$filter=contains(IndicatorName,'nxiet')&$select=IndicatorCode,IndicatorName",
            "who-anxiety-indicators.json",
            timeout=60,
        )
        names = []
        if isinstance(indicators, dict):
            names = [row.get("IndicatorCode") for row in indicators.get("value") or []]
        if not names:
            gap(
                "Anxiety prevalence",
                "WHO GHO indicator search for anxiety returned no series. IHME GBD anxiety prevalence was not available as an open download from this environment, so anxiety is omitted.",
            )
    except Exception as error:  # noqa: BLE001
        gap("Anxiety prevalence", f"WHO indicator search failed: {error}")

    return result


def load_unhcr() -> dict[str, dict]:
    found: dict[str, dict] = {}
    page = 1
    while page < 20:
        payload = get_json(UNHCR_URL.format(page=page), f"unhcr-2024-p{page}.json", timeout=120)
        items = payload.get("items") if isinstance(payload, dict) else None
        if not items:
            break
        for item in items:
            iso3 = item.get("coa_iso")
            if not iso3 or iso3 == "-":
                continue
            found[iso3] = {
                "y": int(item.get("year") or 2024),
                "refugees": int(num(item.get("refugees")) or 0),
                "asylum": int(num(item.get("asylum_seekers")) or 0),
                "idps": int(num(item.get("idps")) or 0),
            }
        max_pages = int(payload.get("maxPages") or page) if isinstance(payload, dict) else page
        if page >= max_pages:
            break
        page += 1
    print(f"unhcr countries {len(found)}", flush=True)
    return found


def load_currencies() -> dict[str, dict]:
    try:
        payload = get_json(RESTCOUNTRIES, "restcountries.json", timeout=60)
    except Exception as error:  # noqa: BLE001
        gap("Currency names", f"restcountries failed: {error}. Local amounts are still shown in currency units from the PPP factor.")
        return {}
    found: dict[str, dict] = {}
    if not isinstance(payload, list):
        return {}
    for row in payload:
        iso3 = row.get("cca3")
        currencies = row.get("currencies") or {}
        if not iso3 or not isinstance(currencies, dict) or not currencies:
            continue
        code = next(iter(currencies))
        meta = currencies[code] or {}
        found[iso3] = {"code": code, "name": meta.get("name") or code}
    return found


def load_wid(iso2_by_iso3: dict[str, str], pop_by_iso2: dict[str, int]) -> tuple[dict[str, dict], dict[str, str], dict[str, dict]]:
    raw = download(WID_COUNTRIES, "wid-countries.csv", timeout=60)
    text = raw.decode("utf-8-sig")
    region_of: dict[str, str] = {}
    for row in csv.DictReader(io.StringIO(text), delimiter=";"):
        alpha2 = (row.get("alpha2") or "").strip()
        region = (row.get("region2") or row.get("region") or "").strip()
        if alpha2:
            region_of[alpha2] = region
    wanted = sorted({iso2 for iso2 in iso2_by_iso3.values() if iso2 and iso2 in region_of})
    print(f"wid files to read {len(wanted)}", flush=True)

    deciles = ["p0p10", "p10p20", "p20p30", "p30p40", "p40p50", "p50p60", "p60p70", "p70p80", "p80p90", "p90p100"]

    def one(code: str) -> tuple[str, dict | None, str | None]:
        url = WID_FILE.format(code=code)
        try:
            data = download(url, f"wid-{code}.csv", timeout=180)
        except Exception as error:  # noqa: BLE001
            return code, None, str(error)
        wealth: dict[int, dict[str, float]] = defaultdict(dict)
        ppp: dict[int, float] = {}
        for line in data.decode("utf-8", "ignore").splitlines():
            parts = line.split(";")
            if len(parts) < 5:
                continue
            variable = parts[1]
            percentile = parts[2]
            year = num(parts[3])
            value = num(parts[4])
            if year is None or value is None:
                continue
            year_i = int(year)
            if variable == "ahwealj992" and percentile in deciles:
                wealth[year_i][percentile] = value
            elif variable == "xlcuspi999" and percentile == "p0p100":
                ppp[year_i] = value
        years = sorted(year for year, values in wealth.items() if all(key in values for key in deciles) and year in ppp and ppp[year] > 0)
        if not years:
            return code, None, "no complete ahwealj992 deciles with xlcuspi999"
        year = years[-1]
        factor = ppp[year]
        lcu = [wealth[year][key] for key in deciles]
        return code, {
            "year": year,
            "ppp": round_num(factor),
            "decileLcu": [round_num(value) for value in lcu],
            "decilePpp": [round_num(value / factor) for value in lcu],
            "region2": region_of.get(code, ""),
        }, None

    found: dict[str, dict] = {}
    failures = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(one, code) for code in wanted]
        for future in as_completed(futures):
            code, record, error = future.result()
            if record:
                found[code] = record
            else:
                failures += 1
                if failures <= 8:
                    print(f"wid miss {code}: {error}", flush=True)
    print(f"wid countries {len(found)} misses {failures}", flush=True)

    # Population-weighted regional decile averages, in USD PPP.
    buckets: dict[str, list[tuple[int, list[float]]]] = defaultdict(list)
    for code, record in found.items():
        pop = pop_by_iso2.get(code) or 0
        if pop <= 0:
            continue
        buckets[record["region2"]].append((pop, record["decilePpp"]))
    for code, record in found.items():
        peers = buckets.get(record["region2"]) or []
        if len(peers) < 2:
            continue
        total = sum(pop for pop, _values in peers)
        if total <= 0:
            continue
        averaged = []
        for index in range(10):
            averaged.append(round_num(sum(pop * values[index] for pop, values in peers) / total))
        record["regionAveragePpp"] = averaged
        record["regionAverageName"] = record["region2"]
    if failures:
        gap(
            "WID wealth files",
            f"{failures} ISO2 files were missing or had no complete decile. Those countries use a population-weighted WID region average when one exists.",
        )
    region_wealth: dict[str, dict] = {}
    for region, peers in buckets.items():
        if len(peers) < 2:
            continue
        total = sum(pop for pop, _values in peers)
        if total <= 0:
            continue
        averaged = [
            round_num(sum(pop * values[index] for pop, values in peers) / total) for index in range(10)
        ]
        region_wealth[region] = {"decilePpp": averaged, "countries": len(peers)}
    return found, region_of, region_wealth


def load_negative_affect(name_index: dict[str, str]) -> dict[str, dict]:
    try:
        pdf = download(WHR_PDF, "whr26-appendix.pdf", timeout=120)
    except Exception as error:  # noqa: BLE001
        gap("Gallup emotions", f"World Happiness Report 2026 appendix PDF was not downloaded: {error}")
        return {}
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        installed = os.system(f"{sys.executable} -m pip install pypdf")
        if installed != 0:
            gap("Worry, stress, and sadness", "pypdf is not installed, so the World Happiness Report appendix could not be read. Emotion shares were omitted.")
            return {}
        from pypdf import PdfReader  # type: ignore
    reader = PdfReader(io.BytesIO(pdf))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    cache_path("whr26-appendix.txt").write_text(text, encoding="utf-8")
    marker = "Ranking of Negative Affect"
    start = text.find(marker)
    if start < 0:
        gap(
            "Worry, stress, and sadness",
            "The World Happiness Report 2026 appendix did not yield a parseable negative-affect ranking, and Gallup Global Emotions country tables are not published as an open data file. Separate stress, worry, and sadness shares were omitted.",
        )
        return {}
    # Keep the ranking pages and stop before the next unrelated figure title if present.
    window = text[start : start + 12000]
    import re

    pairs = re.findall(r"\d+\.\s+([A-Za-z][A-Za-z .'\-]+?)\(([0-9]\.[0-9]{3})\)", window)
    parsed: dict[str, float] = {}
    for name, value in pairs:
        clean = " ".join(name.split())
        parsed[clean] = float(value)
    if "Nigeria" not in parsed or not (0.2 <= parsed["Nigeria"] <= 0.35):
        gap(
            "Worry, stress, and sadness",
            "Could not validate the World Happiness Report negative-affect table (Nigeria anchor missing or out of range). Separate Gallup stress, worry, and sadness shares were not in an open data file, so they were omitted.",
        )
        return {}
    if "United States" not in parsed or not (0.15 <= parsed["United States"] <= 0.4):
        gap(
            "Worry, stress, and sadness",
            "Could not validate the United States anchor in the negative-affect table. Emotion shares were omitted.",
        )
        return {}

    def norm(value: str) -> str:
        return "".join(ch for ch in value.lower() if ch.isalnum())

    aliases = {
        "unitedstates": "unitedstates",
        "unitedstatesofamerica": "unitedstates",
        "usa": "unitedstates",
        "czechrepublic": "czechia",
        "czechia": "czechia",
        "republicofkorea": "korearep",
        "korearep": "korearep",
        "southkorea": "korearep",
        "drcongo": "congodemrep",
        "democraticrepublicofthecongo": "congodemrep",
        "congodemrep": "congodemrep",
        "congo": "congorep",
        "republicofthecongo": "congorep",
        "tanzania": "tanzania",
        "unitedrepublicoftanzania": "tanzania",
        "russia": "russianfederation",
        "russianfederation": "russianfederation",
        "laos": "laopdr",
        "laopdr": "laopdr",
        "vietnam": "vietnam",
        "viet nam": "vietnam",
        "syria": "syrianarabrepublic",
        "syrianarabrepublic": "syrianarabrepublic",
        "iran": "iranislamicrep",
        "iranislamicrepublic": "iranislamicrep",
        "bolivia": "boliviaplurinationalstate",
        "venezuela": "venezuelarb",
        "venezuelabolivarianrepublic": "venezuelarb",
        "yemen": "yemenrep",
        "yemenrep": "yemenrep",
        "gambia": "gambiathe",
        "thegambia": "gambiathe",
        "gambiathe": "gambiathe",
        "somalia": "somaliafedrep",
        "somaliafedrep": "somaliafedrep",
        "stateofpalestine": "westbankandgaza",
        "palestine": "westbankandgaza",
        "taiwanprovinceofchina": "chinataiwanprovinceofchina",
        "hongkongsarofchina": "hongkongsarchina",
        "moldova": "moldovarepublic",
        "republicofmoldova": "moldovarepublic",
        "tanzaniaunitedrepublic": "tanzania",
        "egypt": "egyptarabrep",
        "egyptarabrep": "egyptarabrep",
        "kyrgyzstan": "kyrgyzrepublic",
        "kyrgyzrepublic": "kyrgyzrepublic",
        "slovakia": "slovakrepublic",
        "slovakrepublic": "slovakrepublic",
        "turkey": "turkiye",
        "turkiye": "turkiye",
        "palestine": "westbankandgaza",
        "westbankandgaza": "westbankandgaza",
        "ivorycoast": "cotedivoire",
        "cotedivoire": "cotedivoire",
        "côte divoire": "cotedivoire",
    }
    lookup = {}
    for iso3, name in name_index.items():
        lookup[norm(name)] = iso3
        lookup[aliases.get(norm(name), norm(name))] = iso3
    matched: dict[str, dict] = {}
    unmatched = []
    for name, value in parsed.items():
        key = aliases.get(norm(name), norm(name))
        iso3 = lookup.get(key) or lookup.get(norm(name))
        if not iso3:
            unmatched.append(name)
            continue
        matched[iso3] = {"v": round_num(value), "y": 2025, "period": "2023-2025"}
    print(f"negative affect matched {len(matched)} unmatched {len(unmatched)}", flush=True)
    if unmatched:
        gap(
            "Negative affect name match",
            "Some World Happiness Report names did not match a country: " + ", ".join(unmatched[:30]),
        )
    gap(
        "Stress, worry, and sadness separately",
        "Gallup Global Emotions publishes stress, worry, and sadness separately, but not as an open data file. The sheet uses World Happiness Report 2026 negative affect (the average of Gallup worry, sadness, and anger for 2023–2025) and does not split out stress.",
    )
    return matched


def weighted_average(items: list[tuple[float, float]]) -> float | None:
    total = sum(weight for weight, _value in items if weight > 0)
    if total <= 0 or not items:
        return None
    return sum(weight * value for weight, value in items if weight > 0) / total


def main() -> None:
    meta_countries = wb_countries()
    wb = meta_countries["countries"]
    wb_aggregates = meta_countries["aggregates"]
    wpp = load_wpp()
    age_starts = wpp["ageStarts"]
    wpp_countries: dict[str, dict] = wpp["countries"]

    catalog: dict[str, dict] = {
        "WPP2024_POP_AGE_SEX": {
            "source": "United Nations, World Population Prospects 2024",
            "name": "Population by 5-year age group and sex, medium variant, 1 January",
            "url": WPP_POP,
            "unit": "people",
        },
        "WPP2024_ASFR": {
            "source": "United Nations, World Population Prospects 2024",
            "name": "Age-specific fertility rate, medium variant",
            "url": WPP_FERT,
            "unit": "births per woman per year",
        },
        "WPP2024_LEX": {
            "source": "United Nations, World Population Prospects 2024",
            "name": "Life expectancy by sex at birth, age 15, and age 65, medium variant",
            "url": WPP_DEMO,
            "unit": "years",
        },
        "PIP": {
            "source": "World Bank Poverty and Inequality Platform",
            "name": "Per capita welfare by decile and poverty headcount, 2021 PPP",
            "url": "https://api.worldbank.org/pip/v1/pip",
            "unit": "2021 PPP dollars per person per day",
        },
        "FINDEX2025": {
            "source": "World Bank Global Findex 2025",
            "name": "Account ownership, saved any money, and ability to come up with emergency funds",
            "url": FINDEX_URL,
            "unit": "share of adults age 15+",
        },
        "WID_AHWEAL": {
            "source": "World Inequality Database",
            "name": "Average net personal wealth, equal-split adults (ahwealj992), converted with xlcuspi999",
            "url": "https://wid.world/bulk_download/",
            "unit": "local currency and USD PPP",
        },
        "UNHCR2024": {
            "source": "UNHCR Refugee Population Statistics",
            "name": "Refugees, asylum seekers, and internally displaced people by country of asylum",
            "url": "https://api.unhcr.org/population/v1/population/",
            "unit": "people",
        },
        "SDGSUICIDE": {
            "source": "WHO Global Health Observatory",
            "name": "Suicide mortality rate",
            "url": "https://ghoapi.azureedge.net/api/SDGSUICIDE",
            "unit": "deaths per 100,000",
        },
        "NCD_HYP_PREVALENCE_A": {
            "source": "WHO Global Health Observatory",
            "name": "Age-standardized prevalence of hypertension among adults aged 30 to 79 years",
            "url": "https://ghoapi.azureedge.net/api/NCD_HYP_PREVALENCE_A",
            "unit": "percent",
        },
        "GDO_q35": {
            "source": "WHO Global Health Observatory",
            "name": "Estimated population-based prevalence of depression",
            "url": "https://ghoapi.azureedge.net/api/GDO_q35",
            "unit": "percent",
        },
        "WHR2026_NEGATIVE_AFFECT": {
            "source": "World Happiness Report 2026, statistical appendix",
            "name": "Negative affect, average of Gallup World Poll worry, sadness, and anger, 2023–2025",
            "url": WHR_PDF,
            "unit": "share",
        },
    }

    print("fetching world bank series", flush=True)
    series_by_code: dict[str, dict[str, dict]] = {}
    metas = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        meta_futures = {pool.submit(wb_indicator_meta, code): code for code in WB_CODES}
        data_futures = {pool.submit(wb_series, code): code for code in WB_CODES}
        for future in as_completed(meta_futures):
            code = meta_futures[future]
            metas[code] = future.result()
        for future in as_completed(data_futures):
            code = data_futures[future]
            series_by_code[code] = future.result()
    for code, meta in metas.items():
        org = meta["sourceOrganization"].replace("\n", " ").strip()
        catalog[code] = {
            "source": org or "World Bank, World Development Indicators",
            "name": meta["name"],
            "url": f"https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&mrnev=1",
            "unit": "",
            "note": meta["sourceNote"],
        }

    incomes, _unused = load_pip()
    findex_countries, findex_aggregates = load_findex()
    who = load_who()
    unhcr = load_unhcr()
    currencies = load_currencies()

    iso2_by_iso3 = {}
    pop_by_iso2 = {}
    for iso3, record in wpp_countries.items():
        iso2 = (wb.get(iso3) or {}).get("iso2") or record.get("iso2") or ""
        iso2_by_iso3[iso3] = iso2
        if iso2:
            pop_by_iso2[iso2] = record["pop"]
    wid, wid_region_of, wid_region_wealth = load_wid(iso2_by_iso3, pop_by_iso2)

    names = {iso3: (wb.get(iso3) or {}).get("name") or record["name"] for iso3, record in wpp_countries.items()}
    negative = load_negative_affect(names)

    # Regional and income-group averages for PIP, where a country has no row.
    def group_income(key_name: str, kind: str) -> dict[str, dict]:
        buckets: dict[str, list[tuple[int, dict]]] = defaultdict(list)
        for iso3, income in incomes.items():
            if income["kind"] == "filled-gap":
                continue
            info = wb.get(iso3)
            pop = (wpp_countries.get(iso3) or {}).get("pop") or 0
            if not info or pop <= 0:
                continue
            key = info.get(key_name) or ""
            if key:
                buckets[key].append((pop, income))
        averaged: dict[str, dict] = {}
        for key, items in buckets.items():
            total = sum(pop for pop, _income in items)
            if total <= 0 or len(items) < 2:
                continue
            decile = []
            for index in range(10):
                decile.append(round_num(sum(pop * income["decileDaily"][index] for pop, income in items) / total))
            headcount: dict[str, float] = {}
            headcount_year: dict[str, int] = {}
            for line in ("3", "4.2", "8.3"):
                weighted = [(pop, income["headcount"][line]) for pop, income in items if line in income["headcount"]]
                value = weighted_average(weighted)
                if value is not None:
                    headcount[line] = round_num(value)
                    headcount_year[line] = max(
                        income["headcountYear"].get(line, income["year"])
                        for _pop, income in items
                        if line in income["headcount"]
                    )
            averaged[key] = {
                "year": max(income["year"] for _pop, income in items),
                "welfare": "mixed",
                "mean": round_num(sum(decile) / 10),
                "median": decile[4],
                "gini": None,
                "ppp": None,
                "decileShare": [],
                "decileDaily": decile,
                "survey": "",
                "kind": kind,
                "interpolated": False,
                "headcount": headcount,
                "headcountYear": headcount_year,
                "countries": len(items),
            }
        return averaged

    income_by_region = group_income("regionId", "region-average")
    income_by_income = group_income("incomeId", "income-average")

    countries_out: dict[str, dict] = {}
    for iso3, wpp_row in wpp_countries.items():
        if wpp_row["pop"] <= 0:
            continue
        info = wb.get(iso3) or {
            "iso2": wpp_row.get("iso2") or "",
            "name": wpp_row["name"],
            "regionId": "",
            "regionName": "",
            "incomeId": "",
            "incomeName": "",
        }
        currency = currencies.get(iso3) or {}
        series = {}
        for code, values in series_by_code.items():
            if iso3 in values:
                series[code] = values[iso3]
        countries_out[iso3] = {
            "iso3": iso3,
            "iso2": info.get("iso2") or wpp_row.get("iso2") or "",
            "name": info.get("name") or wpp_row["name"],
            "regionId": info.get("regionId") or "",
            "regionName": info.get("regionName") or "",
            "incomeId": info.get("incomeId") or "",
            "incomeName": info.get("incomeName") or "",
            "currency": currency.get("code") or "",
            "currencyName": currency.get("name") or "",
            "pop": wpp_row["pop"],
            "wppYear": WPP_YEAR,
            "ageMale": wpp_row["ageMale"],
            "ageFemale": wpp_row["ageFemale"],
            "asfr": wpp_row.get("asfr") or {},
            "tfr": wpp_row.get("tfr"),
            "lex": wpp_row.get("lex"),
            "series": series,
            "income": incomes.get(iso3),
            "findex": findex_countries.get(iso3),
            "who": who.get(iso3) or {},
            "unhcr": unhcr.get(iso3),
            "negativeAffect": negative.get(iso3),
            "wealth": wid.get(info.get("iso2") or ""),
            "widRegion2": wid_region_of.get(info.get("iso2") or "", ""),
        }

    aggregates_out: dict[str, dict] = {}
    for code, info in wb_aggregates.items():
        series = {}
        for indicator, values in series_by_code.items():
            if code in values:
                series[indicator] = values[code]
        aggregates_out[code] = {
            "name": info["name"],
            "kind": "income" if code in {"HIC", "UMC", "LMC", "LIC"} else "region",
            "series": series,
        }

    dataset = {
        "version": "2026-10-13",
        "retrieved": RETRIEVED,
        "ageStarts": age_starts,
        "catalog": catalog,
        "findexAggregates": findex_aggregates,
        "findexRegion": FINDEX_REGION,
        "incomeByRegion": income_by_region,
        "incomeByIncome": income_by_income,
        "widRegionWealth": wid_region_wealth,
        "aggregates": aggregates_out,
        "countries": countries_out,
        "gaps": GAPS,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dataset, separators=(",", ":")), encoding="utf-8")
    GAPS_OUT.write_text(json.dumps(GAPS, indent=2), encoding="utf-8")
    pops = sorted((row["pop"], row["name"]) for row in countries_out.values())
    total_pop = sum(row["pop"] for row in countries_out.values())
    with_income = sum(1 for row in countries_out.values() if row["income"])
    with_findex = sum(1 for row in countries_out.values() if row["findex"])
    with_wealth = sum(1 for row in countries_out.values() if row["wealth"])
    print(
        f"wrote {OUT} countries {len(countries_out)} pop {total_pop} income {with_income} findex {with_findex} wealth {with_wealth}",
        flush=True,
    )
    print("largest", pops[-5:], flush=True)
    print(f"gaps {len(GAPS)}", flush=True)

    gap(
        "Household size",
        "No official API in this run returned average household size for each country. UN WPP and World Bank WDI do not publish it. The sheet omits household size.",
    )
    gap(
        "Marital status",
        "UN World Population Prospects does not publish marital status, and the UN Data Portal data endpoint returned HTTP 401. Marital status is omitted rather than estimated.",
    )
    gap(
        "Male age-specific fertility",
        "UN WPP 2024 publishes age-specific fertility for women only. Sheets do not assign a child count to men.",
    )
    # Rewrite gaps file so the three structural gaps are included.
    dataset["gaps"] = GAPS
    OUT.write_text(json.dumps(dataset, separators=(",", ":")), encoding="utf-8")
    GAPS_OUT.write_text(json.dumps(GAPS, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
