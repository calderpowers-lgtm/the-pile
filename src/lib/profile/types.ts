/**
 * Shape of the bundled dataset written by scripts/fetch_dataset.py.
 * Figures are copied from those downloads. The sampler does not invent them.
 */

export type SeriesPoint = {
  v: number;
  y: number;
};

export type CatalogEntry = {
  source: string;
  name: string;
  url: string;
  unit?: string;
  note?: string;
};

export type IncomeBlock = {
  year: number;
  welfare: string;
  mean: number;
  median: number | null;
  gini: number | null;
  ppp: number | null;
  decileShare: number[];
  decileDaily: number[];
  survey: string;
  kind: "survey" | "interpolated" | "filled-gap" | "region-average" | "income-average";
  interpolated: boolean;
  headcount: Record<string, number>;
  headcountYear: Record<string, number>;
  countries?: number;
};

export type FindexRates = {
  all: number | null;
  women: number | null;
  men: number | null;
  poor40: number | null;
  rich60: number | null;
};

export type FindexBlock = {
  year: number;
  name?: string;
  account: FindexRates;
  saved: FindexRates;
  emergency: FindexRates;
};

export type SuicideBand = {
  label: string;
  min: number;
  max: number;
  all: boolean;
  v: number;
};

export type WhoBlock = {
  hypertension?: {
    y: number;
    female: number | null;
    male: number | null;
    both: number | null;
  };
  depression?: { y: number; v: number };
  suicide?: {
    y: number;
    female: SuicideBand[];
    male: SuicideBand[];
    both: SuicideBand[];
  };
};

export type WealthBlock = {
  year: number;
  ppp: number;
  decileLcu: number[];
  decilePpp: number[];
  region2: string;
  regionAveragePpp?: number[];
  regionAverageName?: string;
};

export type LexBlock = {
  y: number;
  birthM: number | null;
  birthF: number | null;
  a15M: number | null;
  a15F: number | null;
  a65M: number | null;
  a65F: number | null;
};

export type CountryRecord = {
  iso3: string;
  iso2: string;
  name: string;
  regionId: string;
  regionName: string;
  incomeId: string;
  incomeName: string;
  currency: string;
  currencyName: string;
  pop: number;
  wppYear: number;
  ageMale: number[];
  ageFemale: number[];
  asfr: Record<string, number>;
  tfr: number | null;
  lex: LexBlock | null;
  series: Record<string, SeriesPoint>;
  income: IncomeBlock | null;
  findex: FindexBlock | null;
  who: WhoBlock;
  unhcr: { y: number; refugees: number; asylum: number; idps: number } | null;
  negativeAffect: { v: number; y: number; period: string } | null;
  wealth: WealthBlock | null;
  widRegion2: string;
};

export type AggregateRecord = {
  name: string;
  kind: string;
  series: Record<string, SeriesPoint>;
};

export type Dataset = {
  version: string;
  retrieved: string;
  ageStarts: number[];
  catalog: Record<string, CatalogEntry>;
  findexAggregates: Record<string, FindexBlock>;
  findexRegion: Record<string, string>;
  incomeByRegion: Record<string, IncomeBlock>;
  incomeByIncome: Record<string, IncomeBlock>;
  widRegionWealth: Record<string, { decilePpp: number[]; countries: number }>;
  aggregates: Record<string, AggregateRecord>;
  countries: Record<string, CountryRecord>;
  gaps: { item: string; detail: string }[];
};

export type ResolvedKind =
  | "country"
  | "region"
  | "income"
  | "survey"
  | "interpolated"
  | "filled-gap"
  | "region-average"
  | "income-average";

export type ResolvedNumber = {
  v: number;
  y: number;
  i: string;
  g: string;
  gname: string;
  kind: ResolvedKind;
};
