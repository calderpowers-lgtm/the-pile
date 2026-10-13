import rawNames from "@/data/pile-names.json";

import { dataset } from "@/lib/profile/data";
import type { CountryRecord } from "@/lib/profile/types";
import { weighted, type Rng } from "@/lib/random";
import type { Sex, SheetCitation } from "@/lib/types";

type NameList = { w: "rank" | "count"; years?: string; n: [string, number][] };
type NameFile = {
  source: string;
  license: string;
  url: string;
  countries: Record<string, { F?: NameList; M?: NameList; S?: NameList }>;
};

const names = rawNames as unknown as NameFile;

export type DrawnName = {
  given: string;
  surname: string | null;
  givenFrom: string;
  surnameFrom: string | null;
  givenFallback: boolean;
  surnameFallback: boolean;
  givenWeight: "rank" | "count";
  surnameWeight: "rank" | "count" | null;
  givenShare: number;
  surnameShare: number | null;
  years: string;
};

function draw(rng: Rng, list: NameList): { name: string; share: number } {
  const total = list.n.reduce((sum, [, w]) => sum + w, 0);
  const pickIndex = weighted(rng, list.n.map(([, w], index) => ({ item: index, weight: w })));
  const [name, w] = list.n[pickIndex]!;
  return { name, share: total > 0 ? w / total : 0 };
}

/** Country first. If it has no list, a population-weighted country from the same World Bank region. */
function source(rng: Rng, country: CountryRecord, key: "F" | "M" | "S"): { iso2: string; list: NameList; fallback: boolean } | null {
  const own = names.countries[country.iso2]?.[key];
  if (own && own.n.length > 0) return { iso2: country.iso2, list: own, fallback: false };
  const pool = Object.values(dataset.countries).filter(
    (other) => other.regionId === country.regionId && other.pop > 0 && (names.countries[other.iso2]?.[key]?.n.length ?? 0) > 0,
  );
  if (pool.length === 0) return null;
  const chosen = weighted(rng, pool.map((item) => ({ item, weight: item.pop })));
  return { iso2: chosen.iso2, list: names.countries[chosen.iso2]![key]!, fallback: true };
}

function nameOf(iso2: string): string {
  return Object.values(dataset.countries).find((item) => item.iso2 === iso2)?.name ?? iso2;
}

export function sampleName(rng: Rng, country: CountryRecord, sex: Sex): DrawnName | null {
  const givenSource = source(rng, country, sex === "female" ? "F" : "M");
  if (!givenSource) return null;
  const given = draw(rng, givenSource.list);
  const surnameSource = source(rng, country, "S");
  const surname = surnameSource ? draw(rng, surnameSource.list) : null;
  return {
    given: given.name,
    surname: surname?.name ?? null,
    givenFrom: nameOf(givenSource.iso2),
    surnameFrom: surnameSource ? nameOf(surnameSource.iso2) : null,
    givenFallback: givenSource.fallback,
    surnameFallback: surnameSource?.fallback ?? false,
    givenWeight: givenSource.list.w,
    surnameWeight: surnameSource?.list.w ?? null,
    givenShare: given.share,
    surnameShare: surname?.share ?? null,
    years: givenSource.list.years ?? "",
  };
}

export function nameCitation(name: DrawnName, country: CountryRecord): SheetCitation {
  const fallback = name.givenFallback || name.surnameFallback;
  const geography = fallback
    ? `${country.regionName} (regional fallback: no list for ${country.name}; given name from ${name.givenFrom}${name.surnameFrom ? `, surname from ${name.surnameFrom}` : ""})`
    : country.name;
  return {
    source: names.source,
    indicator: `Most common given names by sex${name.surname ? " and most common surnames" : ""} (${names.license})`,
    year: name.years || "latest list",
    geography,
    url: names.url,
    retrieved: dataset.retrieved,
  };
}
