/**
 * Shared types for The Pile.
 *
 * A sheet is what someone would write if asked to put their problems,
 * health, and the shape of their life on paper. The user's sheet stays on
 * device. A drawn sheet is a factual profile sampled from public statistics,
 * never a record of an identified person.
 */

export type LifeBand = "ease" | "ordinary" | "hard" | "very-hard";

export type SheetSource = "bundled";

export type Sex = "female" | "male";

export type Setting = "urban" | "rural";

export type FactSection = "where" | "income" | "savings" | "household" | "health" | "mental" | "other";

export type SheetCitation = {
  source: string;
  indicator: string;
  year: number | string;
  geography: string;
  url: string;
  retrieved: string;
};

/** One sourced line on a drawn sheet. */
export type SheetFact = {
  id: string;
  section: FactSection;
  label: string;
  value: string;
  figure: number | null;
  citation: SheetCitation;
  howDrawn: string;
};

/** Within-country household income fifth. 1 is the lowest fifth, 5 the highest. */
export type IncomeQuintile = 1 | 2 | 3 | 4 | 5;

/**
 * Where per-person consumption sits against World Bank international lines
 * (2017 PPP dollars per day): 2.15, 3.65, 6.85, then 20 and 50.
 */
export type GlobalBand = "subsistence" | "poor" | "modest" | "middle" | "comfortable" | "high";

export type EducationLevel = "none" | "primary" | "secondary" | "tertiary";

export type Livelihood =
  | "subsistence-farm"
  | "informal"
  | "wage"
  | "skilled"
  | "professional"
  | "student"
  | "retired"
  | "unemployed";

/**
 * Rare or private weights on a sheet. Each flag is a Bernoulli draw at a
 * documented rate. Narratives may mention a flag only when it is true, and
 * only without graphic detail.
 */
export type PrivateBurdens = {
  /** Past-year physical or sexual violence by a partner. */
  ongoingPartnerViolence: boolean;
  /** Earlier partner violence that still weighs, and is not past-year. */
  carriedPartnerViolence: boolean;
  /** Severe childhood maltreatment that still weighs. The type is not specified. */
  childhoodHarm: boolean;
  /** Non-partner sexual violence as an adult that still weighs. */
  adultSexualViolence: boolean;
  /** Past-year abuse of an older adult in their own household. */
  elderHarm: boolean;
  cancer: boolean;
  kidneyFailure: boolean;
  stroke: boolean;
  severePain: boolean;
  psychosis: boolean;
  /** Past-year suicidal ideation. No method is ever stored. */
  suicidalIdeation: boolean;
  caregiver: boolean;
  householdAlcohol: boolean;
  infertility: boolean;
  familyIncarcerated: boolean;
  /**
   * UNICEF-prevalence flag for women in countries where female genital
   * cutting is common. Narratives stay non-graphic.
   */
  cutting: boolean;
};

export type Gratitudes = [string, string, string];

/**
 * The four parts of a sheet, in the same order for the user and for a draw.
 * Comparison is meant to be section against section.
 */
export type SheetSections = {
  financial: string;
  health: string;
  emotional: string;
  vent: string;
};

/** A public rate tied to this sampled life. Not part of the journal voice. */
export type StatNote = {
  topic: string;
  text: string;
  source: string;
};

/** A generated profile. Facts are cited statistics, not a first-person narrative. */
export type GeneratedSheet = {
  id: string;
  displayName: string;
  age: number;
  sex: Sex;
  setting: Setting | null;
  /** "Urban Nigeria" or the country name when urban or rural was not drawn. */
  place: string;
  region: string;
  iso3: string;
  facts: SheetFact[];
  /** Likely name, drawn from national name-frequency lists. Older saved sheets do not have it. */
  name?: { text: string; citation: SheetCitation; howDrawn: string } | null;
  /** Annual income headline. */
  headlineIncome?: { usd: string; local: string | null; label: string; citation: SheetCitation; howDrawn: string } | null;
  /** Problems this person was drawn to have. */
  problems?: SheetProblem[];
};

export type SheetProblem = {
  id: string;
  statement: string;
  probability: string;
  citation: SheetCitation;
};

export type DrawnSheet = GeneratedSheet & {
  source: SheetSource;
};

/** check-in → dump / journal → three gratitudes → swap. Older saves may still say "sort". */
export type SheetStep = "checkin" | "dump" | "sort" | "thanks";

export type UserSheet = SheetSections & {
  gratitudes: Gratitudes;
  ageBand: string | null;
  /** 1 is a hard day, 10 is a good one. Null until they answer today. */
  mood: number | null;
  /** Optional short note from the check-in. */
  weighing: string;
  /** Local calendar day (YYYY-MM-DD) of the latest mood answer. */
  checkedOn: string | null;
  /** Which writing step they are on. Saved so a refresh keeps their place. */
  step: SheetStep;
  updatedAt: string;
};

/** Name and age band for the practice. Never sent off the device. */
export type LocalProfile = {
  name: string;
  ageBand: string | null;
  privacyAcknowledgedAt: string | null;
};

/** A journal entry the person chose to keep for later. On-device only. */
export type JournalEntry = {
  id: string;
  savedAt: string;
  mood: number | null;
  weighing: string;
  body: string;
};

export type HistoryDecision = "pending" | "took-back" | "kept-looking";

export type HistoryEntry = {
  id: string;
  drawnAt: string;
  sheet: DrawnSheet;
  decision: HistoryDecision;
  /** Up to three things the user named after taking their sheet back. */
  gratitudes: string[];
  /** Set once the person saves the three lines or chooses to skip, so a refresh does not reopen the prompt. */
  gratitudeResolved: boolean;
  decidedAt: string | null;
  notice: string | null;
};

export type Rng = () => number;

export type HouseholdKind =
  | "alone"
  | "partner"
  | "parents"
  | "roommates"
  | "partner-kids"
  | "single-kids"
  | "adult-child";

export type Kids = {
  n: number;
  youngest: number;
  oldest: number;
};

/** Facts the sketch and the problem list both have to agree with. */
export type LifeContext = {
  rng: Rng;
  band: LifeBand;
  age: number;
  name: string;
  place: string;
  country: string;
  regionId: string;
  sex: Sex;
  setting: Setting;
  incomeUsd: number;
  incomeQuintile: IncomeQuintile;
  /** Household income divided by the region's illustrative median. */
  incomeRatio: number;
  household: HouseholdKind;
  kids: Kids | null;
  widowed: boolean;
  separated: boolean;
  livesWithParents: boolean;
  crowdedFamily: boolean;
  renting: boolean;
  owns: boolean;
  unstableHousing: boolean;
  workShort: string;
  workLine: string;
  studying: boolean;
  retired: boolean;
  jobInsecure: boolean;
  housingLine: string;
  healthLine: string;
  healthTags: string[];
  seriousHealth: boolean;
  unsettledPapers: boolean;
  leftSchoolEarly: boolean;
  education: EducationLevel;
  /** Per-person consumption, 2017 PPP dollars per day. */
  dailyPpp: number;
  livelihood: Livelihood;
  globalBand: GlobalBand;
  displaced: boolean;
  conflict: boolean;
  burdens: PrivateBurdens;
};

export const AGE_BANDS = [
  { id: "under-18", label: "Under 18" },
  { id: "18-24", label: "18–24" },
  { id: "25-34", label: "25–34" },
  { id: "35-44", label: "35–44" },
  { id: "45-54", label: "45–54" },
  { id: "55-64", label: "55–64" },
  { id: "65-plus", label: "65+" },
] as const;

export const SECTION_FIELDS = [
  {
    id: "vent",
    title: "On the sheet",
    hint: "Whatever is actually bothering you. No categories yet.",
  },
  {
    id: "financial",
    title: "Financial problems",
    hint: "Work, rent, debt, school fees, the money that does or does not last.",
  },
  {
    id: "health",
    title: "Health problems",
    hint: "The body, sleep, pain, illness, or the care someone needs.",
  },
  {
    id: "emotional",
    title: "Emotional problems",
    hint: "Worry, grief, loneliness, pressure, the feeling of the days.",
  },
] as const;

export const PROBLEM_FIELDS = SECTION_FIELDS.filter((field) => field.id !== "vent");

export type SectionId = (typeof SECTION_FIELDS)[number]["id"];

export const INCOME_NOTE =
  "Modeled household consumption in 2017 PPP dollars, drawn from population-weighted distributions. Not a paycheck and not a real person's record.";

export const GLOBAL_BAND_NOTE: Record<GlobalBand, string> = {
  subsistence:
    "Globally, this is around or under the $2.15 a day extreme-poverty line (2017 PPP, per person).",
  poor: "Globally, this is above extreme poverty and under the $3.65 a day line (2017 PPP, per person).",
  modest: "Globally, this sits between the $3.65 and $6.85 a day lines (2017 PPP, per person).",
  middle:
    "Globally, this is above $6.85 a day and short of a high-income standard of living (2017 PPP, per person).",
  comfortable:
    "Globally, this is a comfortable consumption level, and still short of the very top (2017 PPP, per person).",
  high: "Globally, this is a high consumption level, uncommon in the world (2017 PPP, per person).",
};

export function standingFor(quintile: IncomeQuintile, globalBand: GlobalBand): string {
  return `${QUINTILE_STANDING[quintile]} ${GLOBAL_BAND_NOTE[globalBand]}`;
}

export const SOURCE_NOTES: Record<SheetSource, string> = {
  bundled:
    "A person drawn on this phone from bundled public statistics. Not a real identified person, and not a private diary.",
};

const SEXES: readonly Sex[] = ["female", "male"];
const SETTINGS: readonly Setting[] = ["urban", "rural"];
const SOURCES: readonly SheetSource[] = ["bundled"];
const FACT_SECTIONS: readonly FactSection[] = ["where", "income", "savings", "household", "health", "mental", "other"];

export const QUINTILE_STANDING: Record<IncomeQuintile, string> = {
  1: "Among the lower household incomes where they live.",
  2: "Below the middle of household incomes where they live.",
  3: "Around the middle of household incomes where they live.",
  4: "Above the middle of household incomes where they live.",
  5: "Among the higher household incomes where they live.",
};

export function emptyGratitudes(): Gratitudes {
  return ["", "", ""];
}

export function normalizeGratitudes(value: unknown): Gratitudes {
  const list = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => (typeof list[index] === "string" ? list[index] : "")) as Gratitudes;
}

export function filledGratitudes(value: readonly string[]): string[] {
  return value.map((line) => line.trim()).filter((line) => line.length > 0).slice(0, 3);
}

export function sectionBlob(sections: SheetSections): string {
  return [sections.financial, sections.health, sections.emotional, sections.vent].join("\n").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textOk(value: unknown, min: number): value is string {
  return typeof value === "string" && value.trim().length >= min;
}

function isCitation(value: unknown): value is SheetCitation {
  if (!isRecord(value)) return false;
  return (
    textOk(value.source, 2) &&
    textOk(value.indicator, 2) &&
    (typeof value.year === "number" || textOk(value.year, 4)) &&
    textOk(value.geography, 2) &&
    textOk(value.url, 8) &&
    textOk(value.retrieved, 8)
  );
}

function isSheetFact(value: unknown): value is SheetFact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.section === "string" &&
    FACT_SECTIONS.includes(value.section as FactSection) &&
    textOk(value.label, 2) &&
    textOk(value.value, 1) &&
    (value.figure === null || typeof value.figure === "number") &&
    isCitation(value.citation) &&
    textOk(value.howDrawn, 8)
  );
}

export function isGeneratedSheet(value: unknown): value is GeneratedSheet {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.displayName === "string" &&
    typeof value.age === "number" &&
    value.age >= 0 &&
    value.age <= 100 &&
    typeof value.sex === "string" &&
    SEXES.includes(value.sex as Sex) &&
    (value.setting === null || (typeof value.setting === "string" && SETTINGS.includes(value.setting as Setting))) &&
    typeof value.place === "string" &&
    typeof value.region === "string" &&
    typeof value.iso3 === "string" &&
    Array.isArray(value.facts) &&
    value.facts.length >= 8 &&
    value.facts.every(isSheetFact)
  );
}

export function isDrawnSheet(value: unknown): value is DrawnSheet {
  if (!isRecord(value) || typeof value.source !== "string" || !SOURCES.includes(value.source as SheetSource)) {
    return false;
  }
  return isGeneratedSheet(value);
}
