import { dataset, geographyLabel } from "@/lib/profile/data";
import type {
  CountryRecord,
  FindexBlock,
  IncomeBlock,
  ResolvedKind,
  ResolvedNumber,
  SuicideBand,
} from "@/lib/profile/types";

export function countryByIso3(iso3: string): CountryRecord | undefined {
  return dataset.countries[iso3];
}

export function countryList(): CountryRecord[] {
  return Object.values(dataset.countries);
}

export function resolveSeries(country: CountryRecord, code: string): ResolvedNumber | null {
  const own = country.series[code];
  if (own) {
    return { v: own.v, y: own.y, i: code, g: country.iso3, gname: country.name, kind: "country" };
  }
  const region = dataset.aggregates[country.regionId]?.series[code];
  if (region && country.regionName) {
    return { v: region.v, y: region.y, i: code, g: country.regionId, gname: country.regionName, kind: "region" };
  }
  const income = dataset.aggregates[country.incomeId]?.series[code];
  if (income && country.incomeName) {
    return { v: income.v, y: income.y, i: code, g: country.incomeId, gname: country.incomeName, kind: "income" };
  }
  return null;
}

export type ResolvedIncome = {
  block: IncomeBlock;
  gname: string;
  kind: ResolvedKind;
};

export function resolveIncome(country: CountryRecord): ResolvedIncome | null {
  if (country.income && country.income.decileDaily.length === 10) {
    return { block: country.income, gname: country.name, kind: country.income.kind };
  }
  const region = dataset.incomeByRegion[country.regionId];
  if (region && region.decileDaily.length === 10 && country.regionName) {
    return { block: region, gname: country.regionName, kind: "region-average" };
  }
  const income = dataset.incomeByIncome[country.incomeId];
  if (income && income.decileDaily.length === 10 && country.incomeName) {
    return { block: income, gname: country.incomeName, kind: "income-average" };
  }
  return null;
}

export type ResolvedFindex = {
  block: FindexBlock;
  gname: string;
  kind: ResolvedKind;
};

export function resolveFindex(country: CountryRecord): ResolvedFindex | null {
  if (country.findex) {
    return { block: country.findex, gname: country.name, kind: "country" };
  }
  if (country.incomeId === "HIC" && dataset.findexAggregates.HIC) {
    return {
      block: dataset.findexAggregates.HIC,
      gname: dataset.findexAggregates.HIC.name || "High income",
      kind: "income",
    };
  }
  const regionCode = dataset.findexRegion[country.regionId];
  const region = regionCode ? dataset.findexAggregates[regionCode] : undefined;
  if (region) {
    return { block: region, gname: region.name || country.regionName, kind: "region" };
  }
  const income = dataset.findexAggregates[country.incomeId];
  if (income) {
    return { block: income, gname: income.name || country.incomeName, kind: "income" };
  }
  return null;
}

export function rateForSex(block: { women: number | null; men: number | null; all: number | null }, sex: "female" | "male"): number | null {
  const specific = sex === "female" ? block.women : block.men;
  return specific ?? block.all;
}

export function rateForIncome(block: { poor40: number | null; rich60: number | null; all: number | null }, percentile: number): number | null {
  const specific = percentile <= 40 ? block.poor40 : block.rich60;
  return specific ?? block.all;
}

type Average = { v: number; y: number; pop: number };

function weighted(items: Average[]): { v: number; yMin: number; yMax: number } | null {
  const usable = items.filter((item) => item.pop > 0 && Number.isFinite(item.v));
  const total = usable.reduce((sum, item) => sum + item.pop, 0);
  if (total <= 0 || usable.length === 0) return null;
  const v = usable.reduce((sum, item) => sum + item.pop * item.v, 0) / total;
  const years = usable.map((item) => item.y);
  return { v, yMin: Math.min(...years), yMax: Math.max(...years) };
}

const regionCache = new Map<string, { hypF: ReturnType<typeof weighted>; hypM: ReturnType<typeof weighted>; dep: ReturnType<typeof weighted>; affect: ReturnType<typeof weighted>; suicideF: ReturnType<typeof weighted>; suicideM: ReturnType<typeof weighted> }>();

function regionStats(regionId: string) {
  const cached = regionCache.get(regionId);
  if (cached) return cached;
  const hypF: Average[] = [];
  const hypM: Average[] = [];
  const dep: Average[] = [];
  const affect: Average[] = [];
  const suicideF: Average[] = [];
  const suicideM: Average[] = [];
  for (const country of Object.values(dataset.countries)) {
    if (country.regionId !== regionId) continue;
    const hyp = country.who.hypertension;
    if (hyp?.female != null) hypF.push({ v: hyp.female, y: hyp.y, pop: country.pop });
    if (hyp?.male != null) hypM.push({ v: hyp.male, y: hyp.y, pop: country.pop });
    if (country.who.depression) dep.push({ v: country.who.depression.v, y: country.who.depression.y, pop: country.pop });
    if (country.negativeAffect) affect.push({ v: country.negativeAffect.v, y: country.negativeAffect.y, pop: country.pop });
    const allF = country.who.suicide?.female.find((band) => band.all);
    const allM = country.who.suicide?.male.find((band) => band.all);
    if (allF && country.who.suicide) suicideF.push({ v: allF.v, y: country.who.suicide.y, pop: country.pop });
    if (allM && country.who.suicide) suicideM.push({ v: allM.v, y: country.who.suicide.y, pop: country.pop });
  }
  const stats = {
    hypF: weighted(hypF),
    hypM: weighted(hypM),
    dep: weighted(dep),
    affect: weighted(affect),
    suicideF: weighted(suicideF),
    suicideM: weighted(suicideM),
  };
  regionCache.set(regionId, stats);
  return stats;
}

export function hypertensionFor(country: CountryRecord, sex: "female" | "male"): ResolvedNumber | null {
  const own = country.who.hypertension;
  const value = own ? (sex === "female" ? own.female : own.male) ?? own.both : null;
  if (own && value != null) {
    return { v: value, y: own.y, i: "NCD_HYP_PREVALENCE_A", g: country.iso3, gname: country.name, kind: "country" };
  }
  const stats = regionStats(country.regionId);
  const fallback = sex === "female" ? stats.hypF : stats.hypM;
  if (!fallback || !country.regionName) return null;
  return {
    v: fallback.v,
    y: fallback.yMax,
    i: "NCD_HYP_PREVALENCE_A",
    g: country.regionId,
    gname: country.regionName,
    kind: "region-average",
  };
}

export function depressionFor(country: CountryRecord): ResolvedNumber | null {
  if (country.who.depression) {
    return {
      v: country.who.depression.v,
      y: country.who.depression.y,
      i: "GDO_q35",
      g: country.iso3,
      gname: country.name,
      kind: "country",
    };
  }
  const fallback = regionStats(country.regionId).dep;
  if (!fallback || !country.regionName) return null;
  return {
    v: fallback.v,
    y: fallback.yMax,
    i: "GDO_q35",
    g: country.regionId,
    gname: country.regionName,
    kind: "region-average",
  };
}

export function negativeAffectFor(country: CountryRecord): (ResolvedNumber & { period: string }) | null {
  if (country.negativeAffect) {
    return {
      v: country.negativeAffect.v,
      y: country.negativeAffect.y,
      i: "WHR2026_NEGATIVE_AFFECT",
      g: country.iso3,
      gname: country.name,
      kind: "country",
      period: country.negativeAffect.period,
    };
  }
  const fallback = regionStats(country.regionId).affect;
  if (!fallback || !country.regionName) return null;
  return {
    v: fallback.v,
    y: fallback.yMax,
    i: "WHR2026_NEGATIVE_AFFECT",
    g: country.regionId,
    gname: country.regionName,
    kind: "region-average",
    period: "2023-2025",
  };
}

export function suicideFor(
  country: CountryRecord,
  sex: "female" | "male",
  age: number,
): { band: SuicideBand; y: number; gname: string; kind: ResolvedKind } | null {
  const own = country.who.suicide;
  if (own) {
    const bands = sex === "female" ? own.female : own.male;
    const specific = bands.filter((band) => !band.all && age >= band.min && age <= band.max);
    specific.sort((a, b) => a.max - a.min - (b.max - b.min));
    const band = specific[0] ?? bands.find((item) => item.all);
    if (band) return { band, y: own.y, gname: country.name, kind: "country" };
  }
  const fallback = sex === "female" ? regionStats(country.regionId).suicideF : regionStats(country.regionId).suicideM;
  if (!fallback || !country.regionName) return null;
  return {
    band: { label: "all ages", min: 0, max: 120, all: true, v: fallback.v },
    y: fallback.yMax,
    gname: country.regionName,
    kind: "region-average",
  };
}

export function wealthFor(country: CountryRecord, decileIndex: number): {
  ppp: number;
  lcu: number | null;
  year: number | null;
  gname: string;
  kind: ResolvedKind;
  pppFactor: number | null;
} | null {
  const own = country.wealth;
  if (own && own.decilePpp[decileIndex] != null) {
    return {
      ppp: own.decilePpp[decileIndex]!,
      lcu: own.decileLcu[decileIndex] ?? null,
      year: own.year,
      gname: country.name,
      kind: "country",
      pppFactor: own.ppp,
    };
  }
  const region = dataset.widRegionWealth[country.widRegion2];
  if (region && region.decilePpp[decileIndex] != null && country.widRegion2) {
    return {
      ppp: region.decilePpp[decileIndex]!,
      lcu: null,
      year: null,
      gname: country.widRegion2,
      kind: "region-average",
      pppFactor: null,
    };
  }
  return null;
}

export function describeGeography(kind: string, name: string): string {
  return geographyLabel(kind, name);
}
