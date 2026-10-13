import { dataset } from "@/lib/profile/data";
import {
  depressionFor,
  hypertensionFor,
  negativeAffectFor,
  rateForIncome,
  rateForSex,
  resolveFindex,
  resolveIncome,
  resolveSeries,
  suicideFor,
  wealthFor,
  type ResolvedFindex,
  type ResolvedIncome,
} from "@/lib/profile/lookup";
import { sampleName, type DrawnName } from "@/lib/profile/names";
import type { CountryRecord, ResolvedNumber, SuicideBand } from "@/lib/profile/types";
import { chance, integer, makeId, weighted, type Rng } from "@/lib/random";
import type { Sex, Setting } from "@/lib/types";

export type Draw = {
  present: boolean | null;
  rate: ResolvedNumber | null;
  group: string;
};

export type Profile = {
  id: string;
  country: CountryRecord;
  age: number;
  sex: Sex;
  setting: Setting | null;
  urban: ResolvedNumber | null;
  percentile: number | null;
  decile: number | null;
  income: ResolvedIncome | null;
  dailyPpp: number | null;
  annualPpp: number | null;
  dailyLocal: number | null;
  annualLocal: number | null;
  findex: ResolvedFindex | null;
  account: Draw | null;
  saved: Draw | null;
  emergency: Draw | null;
  wealth: ReturnType<typeof wealthFor> & { decile: number } | null;
  children: { estimated: boolean; n: number | null; mean: number | null };
  conditions: Record<string, Draw>;
  suicide: { band: SuicideBand; y: number; gname: string; kind: string } | null;
  depression: Draw | null;
  affect: (ResolvedNumber & { period: string }) | null;
  displaced: Draw | null;
  employment: {
    laborForce: Draw | null;
    unemployed: Draw | null;
    informal: Draw | null;
    agriculture: ResolvedNumber | null;
  };
  education: { level: string | null; rates: ResolvedNumber[] } | null;
  literacy: Draw | null;
  inSchool: Draw | null;
  food: Draw | null;
  internet: Draw | null;
  mobile: ResolvedNumber | null;
  water: Draw | null;
  sanitation: Draw | null;
  uhc: ResolvedNumber | null;
  oop: ResolvedNumber | null;
  ipv: Draw | null;
  maternal: ResolvedNumber | null;
  malaria: ResolvedNumber | null;
  tb: ResolvedNumber | null;
  lex: { value: number; at: string; sex: Sex } | null;
  name: DrawnName | null;
};

type EducationLevel = "less than primary" | "primary" | "upper secondary" | "bachelor or higher";

export function expectedBirths(age: number, asfr: Record<string, number>): number {
  let total = 0;
  for (const [startText, rate] of Object.entries(asfr)) {
    const start = Number(startText);
    if (!Number.isFinite(start) || !Number.isFinite(rate)) continue;
    const exposure = Math.min(5, Math.max(0, age - start));
    total += rate * exposure;
  }
  return total;
}

function poisson(rng: Rng, mean: number): number {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let draw = 0;
  let product = 1;
  do {
    draw += 1;
    product *= rng();
  } while (product > limit && draw < 40);
  return draw - 1;
}

function sampleAgeSex(rng: Rng, country: CountryRecord): { age: number; sex: Sex } {
  const bands: { item: { index: number; sex: Sex }; weight: number }[] = [];
  dataset.ageStarts.forEach((start, index) => {
    bands.push({ item: { index, sex: "male" }, weight: country.ageMale[index] ?? 0 });
    bands.push({ item: { index, sex: "female" }, weight: country.ageFemale[index] ?? 0 });
  });
  const picked = weighted(rng, bands);
  const start = dataset.ageStarts[picked.index] ?? 0;
  const next = dataset.ageStarts[picked.index + 1];
  const end = next == null ? start : next - 1;
  const age = start >= 100 ? 100 : integer(rng, start, Math.min(end, 100));
  return { age, sex: picked.sex };
}

function bernoulli(rng: Rng, rate: ResolvedNumber | null, group: string, scale: "percent" | "share"): Draw | null {
  if (!rate || !Number.isFinite(rate.v)) return null;
  const probability = scale === "percent" ? rate.v / 100 : rate.v;
  if (probability < 0 || probability > 1) return { present: null, rate, group };
  return { present: chance(rng, probability), rate, group };
}

function nestedEducation(rng: Rng, primary: ResolvedNumber | null, upper: ResolvedNumber | null, bachelor: ResolvedNumber | null): Profile["education"] {
  const rates = [primary, upper, bachelor].filter((item): item is ResolvedNumber => Boolean(item));
  if (!primary || !upper || !bachelor) return { level: null, rates };
  const slack = 1.5;
  if (!(bachelor.v <= upper.v + slack && upper.v <= primary.v + slack)) return { level: null, rates };
  const roll = rng() * 100;
  let level: EducationLevel = "less than primary";
  if (roll < bachelor.v) level = "bachelor or higher";
  else if (roll < upper.v) level = "upper secondary";
  else if (roll < primary.v) level = "primary";
  return { level, rates };
}

export function sampleProfile(rng: Rng = Math.random, options: { iso3?: string } = {}): Profile {
  const countries = Object.values(dataset.countries).filter((country) => country.pop > 0);
  const country = options.iso3
    ? dataset.countries[options.iso3]
    : weighted(
        rng,
        countries.map((item) => ({ item, weight: item.pop })),
      );
  if (!country) throw new Error(`No population record for ${options.iso3 ?? "world"}`);

  const { age, sex } = sampleAgeSex(rng, country);
  const urban = resolveSeries(country, "SP.URB.TOTL.IN.ZS");
  const setting: Setting | null = urban && urban.v >= 0 && urban.v <= 100 ? (chance(rng, urban.v / 100) ? "urban" : "rural") : null;

  const income = resolveIncome(country);
  const percentile = income ? 1 + Math.floor(rng() * 100) : null;
  const decile = percentile == null ? null : Math.min(10, Math.ceil(percentile / 10));
  const dailyPpp = income && decile ? income.block.decileDaily[decile - 1]! : null;
  const annualPpp = dailyPpp == null ? null : dailyPpp * 365;
  const ppp = income?.block.ppp && income.block.ppp > 0 ? income.block.ppp : null;
  const dailyLocal = dailyPpp != null && ppp ? dailyPpp * ppp : null;
  const annualLocal = annualPpp != null && ppp ? annualPpp * ppp : null;

  const findex = age >= 15 ? resolveFindex(country) : null;
  const accountRate = findex ? rateForSex(findex.block.account, sex) : null;
  const savedRate = findex && percentile != null ? rateForIncome(findex.block.saved, percentile) : null;
  const emergencyRate = findex && percentile != null ? rateForIncome(findex.block.emergency, percentile) : null;
  const asResolved = (value: number | null, year: number, indicator: string): ResolvedNumber | null => {
    if (value == null || !findex) return null;
    return { v: value, y: year, i: indicator, g: findex.kind === "country" ? country.iso3 : findex.kind, gname: findex.gname, kind: findex.kind };
  };
  const account = bernoulli(
    rng,
    asResolved(accountRate, findex?.block.year ?? 0, "account_t_d"),
    sex === "female" ? "women" : "men",
    "share",
  );
  const saved = bernoulli(
    rng,
    asResolved(savedRate, findex?.block.year ?? 0, "save_any_t_d"),
    percentile != null && percentile <= 40 ? "poorest 40%" : "richest 60%",
    "share",
  );
  const emergency = bernoulli(
    rng,
    asResolved(emergencyRate, findex?.block.year ?? 0, "fin24aP"),
    percentile != null && percentile <= 40 ? "poorest 40%" : "richest 60%",
    "share",
  );

  const wealthBase = decile ? wealthFor(country, decile - 1) : null;
  const wealth = age >= 20 && wealthBase && decile ? { ...wealthBase, decile } : null;

  let children: Profile["children"];
  if (sex === "male") {
    children = { estimated: false, n: null, mean: null };
  } else if (age < 10) {
    children = { estimated: true, n: 0, mean: 0 };
  } else {
    const mean = expectedBirths(age, country.asfr);
    const cap = Math.max(0, age - 10);
    children = { estimated: true, n: Math.min(cap, poisson(rng, mean)), mean };
  }

  const conditions: Record<string, Draw> = {};
  const hyp = age >= 30 && age <= 79 ? hypertensionFor(country, sex) : null;
  if (hyp) conditions.hypertension = bernoulli(rng, hyp, sex === "female" ? "women 30–79" : "men 30–79", "percent")!;

  const diabetes = age >= 20 && age <= 79 ? resolveSeries(country, "SH.STA.DIAB.ZS") : null;
  if (diabetes) conditions.diabetes = bernoulli(rng, diabetes, "ages 20–79", "percent")!;

  // SH.DYN.AIDS.FE/MA.ZS are each sex's share of people living with HIV, not prevalence, so use the 15–49 prevalence.
  const hiv = age >= 15 && age <= 49 ? resolveSeries(country, "SH.DYN.AIDS.ZS") : null;
  if (hiv) conditions.hiv = bernoulli(rng, hiv, "ages 15–49", "percent")!;

  const stuntCode = sex === "female" ? "SH.STA.STNT.FE.ZS" : "SH.STA.STNT.MA.ZS";
  const stunt = age <= 4 ? resolveSeries(country, stuntCode) ?? resolveSeries(country, "SH.STA.STNT.ZS") : null;
  if (stunt) conditions.stunting = bernoulli(rng, stunt, "under 5", "percent")!;

  const anemia =
    sex === "female" && age >= 15 && age <= 49
      ? resolveSeries(country, "SH.ANM.ALLW.ZS")
      : age <= 4
        ? resolveSeries(country, "SH.ANM.CHLD.ZS")
        : null;
  if (anemia) conditions.anemia = bernoulli(rng, anemia, sex === "female" && age >= 15 ? "women 15–49" : "children", "percent")!;

  const depressionRate = depressionFor(country);
  const depression = depressionRate ? bernoulli(rng, depressionRate, "national, not age-specific", "percent") : null;
  const affect = negativeAffectFor(country);
  const suicide = suicideFor(country, sex, age);

  const malaria = resolveSeries(country, "SH.MLR.INCD.P3");
  const tb = resolveSeries(country, "SH.TBS.INCD");

  const waterCode =
    setting === "urban"
      ? "SH.H2O.SMDW.UR.ZS"
      : setting === "rural"
        ? "SH.H2O.SMDW.RU.ZS"
        : "SH.H2O.SMDW.ZS";
  const water =
    resolveSeries(country, waterCode) ??
    resolveSeries(country, "SH.H2O.SMDW.ZS") ??
    resolveSeries(country, setting === "rural" ? "SH.H2O.BASW.RU.ZS" : "SH.H2O.BASW.ZS") ??
    resolveSeries(country, "SH.H2O.BASW.ZS");
  const sanitationCode =
    setting === "urban" ? "SH.STA.BASS.UR.ZS" : setting === "rural" ? "SH.STA.BASS.RU.ZS" : "SH.STA.BASS.ZS";
  const sanitation =
    resolveSeries(country, sanitationCode) ??
    resolveSeries(country, "SH.STA.SMSS.ZS") ??
    resolveSeries(country, "SH.STA.BASS.ZS");

  const stock = country.unhcr;
  const displacedRate =
    stock && country.pop > 0 ? (stock.refugees + stock.asylum + stock.idps) / country.pop : null;
  const displacedDraw: Draw | null =
    displacedRate == null
      ? null
      : displacedRate > 1
        ? {
            present: null,
            rate: {
              v: displacedRate,
              y: stock!.y,
              i: "UNHCR2024",
              g: country.iso3,
              gname: country.name,
              kind: "country",
            },
            group: "stock exceeds population",
          }
        : bernoulli(
            rng,
            {
              v: displacedRate,
              y: stock!.y,
              i: "UNHCR2024",
              g: country.iso3,
              gname: country.name,
              kind: "country",
            },
            "refugees, asylum seekers, and IDPs in this country",
            "share",
          );

  const lfpr = age >= 15 ? resolveSeries(country, sex === "female" ? "SL.TLF.CACT.FE.ZS" : "SL.TLF.CACT.MA.ZS") ?? resolveSeries(country, "SL.TLF.CACT.ZS") : null;
  const laborForce = bernoulli(rng, lfpr, sex === "female" ? "women 15+" : "men 15+", "percent");
  const unemployment =
    laborForce?.present
      ? resolveSeries(country, sex === "female" ? "SL.UEM.TOTL.FE.ZS" : "SL.UEM.TOTL.MA.ZS") ?? resolveSeries(country, "SL.UEM.TOTL.ZS")
      : null;
  const unemployed = bernoulli(rng, unemployment, "labor force", "percent");
  const informalRate =
    laborForce?.present && unemployed?.present === false
      ? resolveSeries(country, sex === "female" ? "SL.ISV.IFRM.FE.ZS" : "SL.ISV.IFRM.MA.ZS") ?? resolveSeries(country, "SL.ISV.IFRM.ZS")
      : null;
  const informal = bernoulli(rng, informalRate, "employed", "percent");

  const education = age >= 25 ? nestedEducation(rng, resolveSeries(country, "SE.PRM.CUAT.ZS"), resolveSeries(country, "SE.SEC.CUAT.UP.ZS"), resolveSeries(country, "SE.TER.CUAT.BA.ZS")) : null;
  const literacyRate = age >= 15 ? resolveSeries(country, sex === "female" ? "SE.ADT.LITR.FE.ZS" : "SE.ADT.LITR.MA.ZS") ?? resolveSeries(country, "SE.ADT.LITR.ZS") : null;
  const literacy = bernoulli(rng, literacyRate, sex === "female" ? "women 15+" : "men 15+", "percent");
  const schoolRate = age >= 6 && age <= 11 ? resolveSeries(country, "SE.PRM.NENR") : age >= 12 && age <= 17 ? resolveSeries(country, "SE.SEC.NENR") : null;
  const inSchool = bernoulli(rng, schoolRate, age <= 11 ? "primary-age" : "secondary-age", "percent");

  const foodRate = resolveSeries(country, "SN.ITK.MSFI.ZS");
  const food = bernoulli(rng, foodRate, "population", "percent");
  const internetRate = age >= 15 ? resolveSeries(country, "IT.NET.USER.ZS") : null;
  const internet = bernoulli(rng, internetRate, "population, applied from age 15", "percent");

  const ipvRate = sex === "female" && age >= 15 && age <= 49 ? resolveSeries(country, "SG.VAW.1549.ZS") : null;
  const ipv = bernoulli(rng, ipvRate, "women 15–49", "percent");

  const lex = country.lex;
  let lexValue: Profile["lex"] = null;
  if (lex) {
    const pick = (birth: number | null, at15: number | null, at65: number | null) => {
      if (age >= 65 && at65 != null) return { value: at65, at: "at age 65" };
      if (age >= 15 && at15 != null) return { value: at15, at: "at age 15" };
      if (birth != null) return { value: birth, at: "at birth" };
      return null;
    };
    const chosen = sex === "female" ? pick(lex.birthF, lex.a15F, lex.a65F) : pick(lex.birthM, lex.a15M, lex.a65M);
    if (chosen) lexValue = { ...chosen, sex };
  }

  // Drawn last so earlier draws keep the same random stream.
  const name = sampleName(rng, country, sex);

  return {
    id: makeId(rng),
    country,
    age,
    sex,
    setting,
    urban,
    percentile,
    decile,
    income,
    dailyPpp,
    annualPpp,
    dailyLocal,
    annualLocal,
    findex,
    account,
    saved,
    emergency,
    wealth,
    children,
    conditions,
    suicide,
    depression,
    affect,
    displaced: displacedDraw,
    employment: {
      laborForce,
      unemployed,
      informal,
      agriculture: resolveSeries(country, "SL.AGR.EMPL.ZS"),
    },
    education,
    literacy,
    inSchool,
    food,
    internet,
    mobile: resolveSeries(country, "IT.CEL.SETS.P2"),
    water: bernoulli(rng, water, setting ?? "national", "percent"),
    sanitation: bernoulli(rng, sanitation, setting ?? "national", "percent"),
    uhc: resolveSeries(country, "SH.UHC.SRVS.CV.XD"),
    oop: resolveSeries(country, "SH.XPD.OOPC.CH.ZS"),
    ipv,
    maternal: sex === "female" && age >= 15 && age <= 49 ? resolveSeries(country, "SH.STA.MMRT") : null,
    malaria,
    tb,
    lex: lexValue,
    name,
  };
}
