import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateSheet } from "@/lib/generator";
import { dataset, geographyLabel } from "@/lib/profile/data";
import { resolveIncome } from "@/lib/profile/lookup";
import { expectedBirths, sampleProfile } from "@/lib/profile/sample";
import { sheetFromProfile } from "@/lib/profile/sheet";
import { mulberry32 } from "@/lib/random";
import { isDrawnSheet, isGeneratedSheet, type SheetFact } from "@/lib/types";

const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|me|my|mine|we|we're|we've|our|ours)\b/;

const REQUIRED: SheetFact["section"][] = ["where", "income", "savings", "household", "health", "mental", "other"];

function assertCited(fact: SheetFact): void {
  assert.ok(fact.citation.source.trim().length >= 2, fact.id);
  assert.ok(fact.citation.indicator.trim().length >= 2, fact.id);
  assert.ok(String(fact.citation.year).trim().length >= 4, `${fact.id} year`);
  assert.ok(fact.citation.geography.trim().length >= 2, fact.id);
  assert.match(fact.citation.url, /^https:\/\/\S+$/, fact.id);
  assert.match(fact.citation.retrieved, /^\d{4}-\d{2}-\d{2}$/, fact.id);
  assert.ok(fact.howDrawn.trim().length >= 8, fact.id);
  assert.doesNotMatch(`${fact.label} ${fact.value} ${fact.howDrawn}`, FIRST_PERSON, fact.id);
  if (fact.figure != null) assert.ok(Number.isFinite(fact.figure), fact.id);
}

describe("bundled dataset", () => {
  it("covers population pyramids and named anchors", () => {
    assert.ok(Object.keys(dataset.countries).length >= 180);
    assert.equal(dataset.retrieved, "2026-10-13");
    for (const country of Object.values(dataset.countries)) {
      assert.equal(country.ageMale.length, dataset.ageStarts.length, country.iso3);
      assert.equal(country.ageFemale.length, dataset.ageStarts.length, country.iso3);
      assert.ok(country.pop > 0, country.iso3);
    }
    const nigeria = dataset.countries.NGA;
    const india = dataset.countries.IND;
    const china = dataset.countries.CHN;
    const australia = dataset.countries.AUS;
    const unitedStates = dataset.countries.USA;
    assert.ok(nigeria && india && china && australia && unitedStates);
    assert.ok(india.pop > australia.pop * 20);
    assert.ok(china.pop > australia.pop * 20);
    assert.equal(nigeria.income?.decileDaily.length, 10);
    assert.ok(nigeria.income && nigeria.income.year >= 2015);
    assert.ok(nigeria.income && nigeria.income.mean > 0);
    assert.ok(nigeria.findex && nigeria.findex.account.all != null && nigeria.findex.account.all > 0 && nigeria.findex.account.all < 1);
    assert.ok(unitedStates.incomeId === "HIC" || unitedStates.incomeName.toLowerCase().includes("high"));
    assert.ok(nigeria.lex && nigeria.lex.birthF != null && nigeria.lex.birthM != null);
    assert.notEqual(nigeria.lex?.birthF, nigeria.lex?.birthM);
  });
});

describe("sampling", () => {
  it("repeats a seed exactly", () => {
    const first = generateSheet({ rng: mulberry32(42) });
    const second = generateSheet({ rng: mulberry32(42) });
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, generateSheet({ rng: mulberry32(43) }));
  });

  it("keeps later draws consistent with earlier ones", () => {
    let menWithCount = 0;
    let youngNonzero = 0;
    let overCap = 0;
    let wealthMismatch = 0;
    let savedMismatch = 0;
    let india = 0;
    let china = 0;
    let australia = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const profile = sampleProfile(mulberry32(seed));
      if (profile.country.iso3 === "IND") india += 1;
      if (profile.country.iso3 === "CHN") china += 1;
      if (profile.country.iso3 === "AUS") australia += 1;
      if (profile.sex === "male") {
        assert.equal(profile.children.estimated, false);
        assert.equal(profile.children.n, null);
        if (profile.children.n != null) menWithCount += 1;
      }
      if (profile.age < 10 && profile.sex === "female") {
        assert.equal(profile.children.n, 0);
        if (profile.children.n !== 0) youngNonzero += 1;
      }
      if (profile.sex === "female" && profile.children.n != null && profile.children.n > Math.max(0, profile.age - 10)) {
        overCap += 1;
      }
      if (profile.income && profile.decile != null && profile.dailyPpp != null) {
        assert.equal(profile.dailyPpp, profile.income.block.decileDaily[profile.decile - 1]);
        assert.equal(profile.annualPpp, profile.dailyPpp * 365);
        assert.equal(profile.decile, Math.min(10, Math.ceil((profile.percentile ?? 0) / 10)));
      }
      if (profile.age >= 20 && profile.wealth && profile.decile != null && profile.wealth.decile !== profile.decile) {
        wealthMismatch += 1;
      }
      if (profile.age >= 15 && profile.percentile != null && profile.saved) {
        const expected = profile.percentile <= 40 ? "poorest 40%" : "richest 60%";
        if (profile.saved.group !== expected) savedMismatch += 1;
      }
      if (profile.sex === "female" && profile.age >= 15 && profile.lex && profile.country.lex?.a15F != null) {
        if (profile.age >= 65 && profile.country.lex.a65F != null) {
          assert.equal(profile.lex.value, profile.country.lex.a65F);
        } else if (profile.age < 65) {
          assert.equal(profile.lex.value, profile.country.lex.a15F);
        }
      }
    }
    assert.equal(menWithCount, 0);
    assert.equal(youngNonzero, 0);
    assert.equal(overCap, 0);
    assert.equal(wealthMismatch, 0);
    assert.equal(savedMismatch, 0);
    assert.ok(india > 30, `india ${india}`);
    assert.ok(china > 30, `china ${china}`);
    assert.ok(india + china > australia * 8, `india ${india} china ${china} australia ${australia}`);
  });

  it("matches the published fertility exposure", () => {
    const nigeria = dataset.countries.NGA!;
    const at10 = expectedBirths(10, nigeria.asfr);
    const older = expectedBirths(40, nigeria.asfr);
    assert.ok(at10 >= 0);
    assert.ok(older > at10);
    assert.equal(expectedBirths(9, nigeria.asfr) >= 0, true);
  });
});

describe("sheets", () => {
  const samples = ["NGA", "USA", "IND", "DEU", "NER", "CHN"].filter((iso3) => dataset.countries[iso3]);

  it("cites every figure and stays in the third person", () => {
    assert.ok(samples.length >= 5);
    for (const iso3 of samples) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const sheet = generateSheet({ rng: mulberry32(seed * 17 + iso3.length), iso3 });
        const drawn = { ...sheet, source: "bundled" as const };
        assert.equal(isGeneratedSheet(sheet), true, iso3);
        assert.equal(isDrawnSheet(drawn), true, iso3);
        assert.equal(sheet.iso3, iso3);
        assert.ok(["Girl", "Boy", "Woman", "Man"].includes(sheet.displayName));
        assert.doesNotMatch(sheet.displayName, /\d/);
        const sections = new Set(sheet.facts.map((fact) => fact.section));
        for (const section of REQUIRED) {
          assert.ok(sections.has(section), `${iso3} missing ${section}`);
        }
        for (const fact of sheet.facts) assertCited(fact);
        const percentile = sheet.facts.find((fact) => fact.id === "percentile");
        if (percentile) {
          const match = percentile.value.match(/^(\d+)(st|nd|rd|th) percentile, decile (\d+)$/);
          assert.ok(match, percentile.value);
          const n = Number(match[1]);
          const mod100 = n % 100;
          const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
          assert.equal(match[2], suffix, percentile.value);
          assert.equal(Number(match[3]), Math.min(10, Math.ceil(n / 10)));
        }
        const anxiety = sheet.facts.find((fact) => fact.id === "anxiety");
        assert.equal(anxiety?.value, "Not shown");
        assert.equal(sheet.facts.find((fact) => fact.id === "household-size")?.value, "Not estimated");
        assert.equal(sheet.facts.find((fact) => fact.id === "marital")?.value, "Not estimated");
      }
    }
  });

  it("classifies poverty from the decile average and labels fallbacks", () => {
    const sheet = generateSheet({ rng: mulberry32(9), iso3: "NGA" });
    const lines = sheet.facts.find((fact) => fact.id === "poverty-lines");
    const profile = sampleProfile(mulberry32(9), { iso3: "NGA" });
    assert.ok(lines && profile.dailyPpp != null);
    assert.match(lines.value, profile.dailyPpp < 3 ? /\$3\/day: decile average is below/ : /\$3\/day: decile average is above/);
    assert.match(lines.value, profile.dailyPpp < 4.2 ? /\$4\.2\/day: decile average is below/ : /\$4\.2\/day: decile average is above/);
    assert.match(lines.value, profile.dailyPpp < 8.3 ? /\$8\.3\/day: decile average is below/ : /\$8\.3\/day: decile average is above/);

    const missing = Object.values(dataset.countries).find((country) => !country.income && resolveIncome(country));
    if (missing) {
      const fallback = generateSheet({ rng: mulberry32(3), iso3: missing.iso3 });
      const percentile = fallback.facts.find((fact) => fact.id === "percentile");
      assert.ok(percentile);
      assert.match(percentile.citation.geography, /fallback/);
      assert.match(geographyLabel("region-average", missing.regionName), /regional fallback/);
    }
  });

  it("drops a first-person sheet that has no cited facts", () => {
    assert.equal(
      isGeneratedSheet({
        id: "old",
        displayName: "Elena",
        age: 34,
        sex: "female",
        setting: "urban",
        place: "Lagos",
        region: "West Africa",
        iso3: "NGA",
        vent: "I can't pay rent.",
      }),
      false,
    );
  });
});

describe("name, income headline, and problems", () => {
  it("draws a cited name, a headline income, and only consistent problems", () => {
    const rng = mulberry32(4242);
    let named = 0;
    for (let i = 0; i < 400; i += 1) {
      const profile = sampleProfile(rng);
      const sheet = sheetFromProfile(profile);
      if (sheet.name) {
        named += 1;
        assert.ok(sheet.name.text.length >= 2);
        assert.match(sheet.name.citation.url, /^https:\/\//);
        assert.equal(sheet.facts[0]!.id, "name");
      }
      if (profile.annualPpp != null) assert.ok(sheet.headlineIncome?.usd.startsWith("$"));
      if (profile.age < 18 && sheet.headlineIncome) assert.match(sheet.headlineIncome.label, /Household income per person/);
      const ids = new Set((sheet.problems ?? []).map((p) => p.id));
      if (profile.age < 15) {
        for (const id of ["unemployed", "informal", "hypertension", "diabetes", "ipv", "account", "saved", "emergency", "literacy"]) assert.ok(!ids.has(id), `${id} at age ${profile.age}`);
      }
      if (profile.sex === "male") assert.ok(!ids.has("ipv"));
      if (ids.has("unemployed")) assert.ok(!ids.has("informal"));
      for (const problem of sheet.problems ?? []) {
        assert.doesNotMatch(problem.statement, FIRST_PERSON);
        assert.match(problem.probability, /\d/);
        assert.match(problem.citation.url, /^https:\/\//);
      }
      if (profile.conditions.hypertension?.present === false) assert.ok(!ids.has("hypertension"));
    }
    assert.ok(named > 380, `named ${named}`);
  });

  it("falls back to the region when a country has no name list", () => {
    const profile = sampleProfile(mulberry32(7), { iso3: "NGA" });
    const sheet = sheetFromProfile(profile);
    assert.ok(sheet.name);
    assert.match(sheet.name.citation.geography, /regional fallback/);
  });
});
