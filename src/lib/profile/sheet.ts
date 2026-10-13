import { dataset, geographyLabel } from "@/lib/profile/data";
import type { Profile } from "@/lib/profile/sample";
import type { ResolvedNumber } from "@/lib/profile/types";
import rawCurrencies from "@/data/pile-currencies.json";
import { nameCitation } from "@/lib/profile/names";

const currencies = rawCurrencies as unknown as { source: string; url: string; countries: Record<string, [string, string]> };
import type { Draw } from "@/lib/profile/sample";
import type { FactSection, GeneratedSheet, SheetCitation, SheetFact, SheetProblem } from "@/lib/types";

const SECTION_TITLES: Record<FactSection, string> = {
  where: "Where they live",
  income: "Income",
  savings: "Savings and money in the bank",
  household: "Household and kids",
  health: "Health",
  mental: "Emotional and mental health",
  other: "Other life factors",
};

export { SECTION_TITLES };

function catalogCitation(indicator: string, year: number | string, geography: string): SheetCitation {
  const entry = dataset.catalog[indicator];
  return {
    source: entry?.source ?? indicator,
    indicator: entry ? `${entry.name} (${indicator})` : indicator,
    year,
    geography,
    url: entry?.url ?? "",
    retrieved: dataset.retrieved,
  };
}

const FINDEX_COLUMNS: Record<string, string> = {
  account_t_d: "Account ownership (account_t_d)",
  save_any_t_d: "Saved any money in the past year (save_any_t_d)",
  fin24aP: "Could come up with emergency funds (fin24aP)",
};

function fromResolved(resolved: ResolvedNumber, year?: number): SheetCitation {
  const column = FINDEX_COLUMNS[resolved.i];
  if (column) {
    const citation = catalogCitation("FINDEX2025", year ?? resolved.y, geographyLabel(resolved.kind, resolved.gname));
    return { ...citation, indicator: column };
  }
  return catalogCitation(resolved.i, year ?? resolved.y, geographyLabel(resolved.kind, resolved.gname));
}

function fact(
  facts: SheetFact[],
  section: FactSection,
  id: string,
  label: string,
  value: string,
  figure: number | null,
  citation: SheetCitation,
  howDrawn: string,
): void {
  facts.push({ id, section, label, value, figure, citation, howDrawn });
}

function percentText(value: number, indicator: string): string {
  const share = ["account_t_d", "save_any_t_d", "fin24aP", "UNHCR2024", "WHR2026_NEGATIVE_AFFECT"].includes(indicator);
  const points = share ? value * 100 : value;
  return `${points.toFixed(1)}%`;
}

function yesNo(present: boolean | null, rate: ResolvedNumber, group: string): string {
  const rateText = percentText(rate.v, rate.i);
  if (present == null) return `Not assigned. The published figure is ${rateText} (${group}).`;
  return `${present ? "Yes" : "No"}. The published figure is ${rateText} (${group}).`;
}

function howRate(present: boolean | null, rate: ResolvedNumber, group: string, scaleNote: string): string {
  const where = geographyLabel(rate.kind, rate.gname);
  const choice =
    present == null
      ? "No yes-or-no was drawn, because the figure is not a share of people."
      : `Drawn as ${present ? "yes" : "no"} with probability equal to that figure.`;
  return `${choice} ${scaleNote} Group: ${group}. ${where}, ${rate.i}, ${rate.y}.`;
}

function money(amount: number, digits: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

function localMoney(amount: number, code: string): string {
  const digits = Math.abs(amount) >= 100 ? 0 : 2;
  if (code) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    } catch {
      return `${code} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(amount)}`;
    }
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(amount);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function personWord(age: number, sex: Profile["sex"]): string {
  if (age < 18) return sex === "female" ? "Girl" : "Boy";
  return sex === "female" ? "Woman" : "Man";
}

function welfarePhrase(welfare: string): string {
  if (welfare === "consumption") return "per-person household consumption";
  if (welfare === "income") return "per-person income";
  return "per-person welfare (surveys in this fallback mix consumption and income)";
}

export function factsFromProfile(profile: Profile): SheetFact[] {
  const facts: SheetFact[] = [];
  const country = profile.country;

  fact(
    facts,
    "where",
    "country",
    "Country",
    country.name,
    null,
    catalogCitation("WPP2024_POP_AGE_SEX", country.wppYear, country.name),
    `Country drawn with probability proportional to population. ${country.name} population ${country.pop.toLocaleString("en-US")} on 1 January ${country.wppYear}, UN WPP 2024 medium variant.`,
  );
  if (profile.setting && profile.urban) {
    fact(
      facts,
      "where",
      "setting",
      "Rural or urban",
      profile.setting === "urban" ? "Urban" : "Rural",
      profile.urban.v,
      fromResolved(profile.urban),
      `Drawn as ${profile.setting} with probability ${profile.urban.v.toFixed(1)}% urban. ${geographyLabel(profile.urban.kind, profile.urban.gname)}. The share is national, not specific to this age.`,
    );
  }
  fact(
    facts,
    "where",
    "age",
    "Age",
    `${profile.age}`,
    profile.age,
    catalogCitation("WPP2024_POP_AGE_SEX", country.wppYear, country.name),
    `Age and sex were drawn together from the UN WPP 2024 five-year population pyramid for ${country.name}. The five-year group was chosen in proportion to its population, then a single year of age was drawn uniformly inside that group.`,
  );
  fact(
    facts,
    "where",
    "sex",
    "Sex",
    profile.sex === "female" ? "Female" : "Male",
    null,
    catalogCitation("WPP2024_POP_AGE_SEX", country.wppYear, country.name),
    `Sex was drawn jointly with age from the same UN WPP 2024 pyramid, so the sex ratio follows the age group rather than a single national average.`,
  );

  if (profile.income && profile.percentile != null && profile.decile != null && profile.dailyPpp != null && profile.annualPpp != null) {
    const block = profile.income.block;
    const where = geographyLabel(profile.income.kind, profile.income.gname);
    const welfare = welfarePhrase(block.welfare);
    const citation = catalogCitation("PIP", block.year, where);
    fact(
      facts,
      "income",
      "percentile",
      "Place in the distribution",
      `${ordinal(profile.percentile)} percentile, decile ${profile.decile}`,
      profile.percentile,
      citation,
      `Sampled from the ${profile.percentile}th percentile of ${where}. The percentile is a uniform draw from 1 to 100. The amount below is the average ${welfare} of decile ${profile.decile}, computed as published decile share × mean / 0.1. World Bank PIP, ${block.year}${block.survey ? `, survey ${block.survey}` : ""}, 2021 PPP.`,
    );
    fact(
      facts,
      "income",
      "daily",
      "Per day, USD PPP",
      money(profile.dailyPpp, profile.dailyPpp >= 100 ? 0 : 2),
      profile.dailyPpp,
      citation,
      `Decile ${profile.decile} average ${welfare} in 2021 PPP dollars per person per day. Not a paycheck and not a market exchange rate.`,
    );
    fact(
      facts,
      "income",
      "annual",
      "Per year, USD PPP",
      money(profile.annualPpp, 0),
      profile.annualPpp,
      citation,
      `Daily figure × 365. Same PIP decile average, 2021 PPP, per person.`,
    );
    if (profile.dailyLocal != null && profile.annualLocal != null && block.ppp) {
      const code = country.currency;
      const localWhere = `${where}, ${code || "local currency"}`;
      fact(
        facts,
        "income",
        "daily-local",
        "Per day, local currency",
        localMoney(profile.dailyLocal, code),
        profile.dailyLocal,
        { ...citation, geography: localWhere },
        `PPP dollars × ${block.ppp}, the PIP PPP conversion factor (local currency units per 2021 international dollar) for this series. ${country.currencyName || "Local currency"}. Not a market exchange rate.`,
      );
      fact(
        facts,
        "income",
        "annual-local",
        "Per year, local currency",
        localMoney(profile.annualLocal, code),
        profile.annualLocal,
        { ...citation, geography: localWhere },
        `Daily local amount × 365, using the same PIP PPP factor.`,
      );
    }
    const lineText = (line: string, below: boolean | null) => {
      const head = block.headcount[line];
      const year = block.headcountYear[line] ?? block.year;
      const personal = below == null ? "not compared" : below ? "below" : "above";
      const national = head == null ? "national headcount not in the extract" : `national headcount ${(head * 100).toFixed(1)}% in ${year}`;
      return `$${line}/day: decile average is ${personal} the line (${national}).`;
    };
    fact(
      facts,
      "income",
      "poverty-lines",
      "International poverty lines",
      [lineText("3", profile.dailyPpp < 3), lineText("4.2", profile.dailyPpp < 4.2), lineText("8.3", profile.dailyPpp < 8.3)].join(" "),
      profile.dailyPpp,
      citation,
      "The $3.00, $4.20, and $8.30 lines are the World Bank international poverty lines in 2021 PPP. This person is classified by whether the decile average is below the line. That is not the same as the national headcount, which is shown in the same line.",
    );
  }

  const addFindex = (id: string, label: string, draw: Profile["account"], note: string) => {
    if (!draw?.rate) return;
    fact(
      facts,
      "savings",
      id,
      label,
      yesNo(draw.present, draw.rate, draw.group),
      draw.rate.v,
      fromResolved(draw.rate),
      `${howRate(draw.present, draw.rate, draw.group, note)} Global Findex covers adults age 15+ only.`,
    );
  };
  if (profile.age < 15) {
    fact(
      facts,
      "savings",
      "findex-age",
      "Account, savings, emergency funds",
      "Not applied. Global Findex covers adults age 15+.",
      null,
      catalogCitation("FINDEX2025", 2024, country.name),
      "Age was drawn before these items. Under 15, the adult rates are not used.",
    );
  } else {
    addFindex("account", "Account ownership", profile.account, "Sex-specific account rate (account_t_d), because sex was already drawn.");
    addFindex(
      "saved",
      "Saved any money in the past year",
      profile.saved,
      "Conditioned on the income percentile already drawn: poorest 40% if percentile 1–40, otherwise richest 60% (save_any_t_d).",
    );
    addFindex(
      "emergency",
      "Could come up with emergency funds",
      profile.emergency,
      "Same income split as savings. fin24aP is the share who say coming up with emergency funds in 30 days is possible.",
    );
  }
  if (profile.age < 20) {
    fact(
      facts,
      "savings",
      "wealth-age",
      "Estimated wealth",
      "Not applied. WID wealth is for adults age 20+.",
      null,
      catalogCitation("WID_AHWEAL", profile.country.wealth?.year ?? 2024, country.name),
      "The WID series ahwealj992 is equal-split adults age 20 and older. It is not applied under age 20.",
    );
  } else if (profile.wealth) {
    const where = geographyLabel(profile.wealth.kind, profile.wealth.gname);
    fact(
      facts,
      "savings",
      "wealth",
      "Estimated net wealth",
      profile.wealth.lcu != null && country.currency
        ? `${money(profile.wealth.ppp, 0)} PPP · ${localMoney(profile.wealth.lcu, country.currency)}`
        : `${money(profile.wealth.ppp, 0)} PPP`,
      profile.wealth.ppp,
      catalogCitation("WID_AHWEAL", profile.wealth.year ?? "mixed years", where),
      `Estimate, not a bank balance. The income decile (${profile.wealth.decile}) was reused as the wealth decile, which assumes rank correlation of 1 between income and wealth and overstates how tightly they move together. The amount is average net personal wealth of equal-split adults in that decile (WID ahwealj992${profile.wealth.pppFactor ? `, converted with xlcuspi999 = ${profile.wealth.pppFactor}` : ""}). ${profile.wealth.kind === "country" ? "Country series." : "Country file missing, so this is a population-weighted average of WID deciles in " + profile.wealth.gname + "."}`,
    );
  }

  if (!profile.children.estimated) {
    fact(
      facts,
      "household",
      "children",
      "Children ever born",
      "Not estimated",
      null,
      catalogCitation("WPP2024_ASFR", country.wppYear, country.name),
      "UN WPP 2024 publishes age-specific fertility for women only. No male schedule was applied, so a man is not assigned a child count.",
    );
  } else {
    fact(
      facts,
      "household",
      "children",
      "Children ever born",
      String(profile.children.n ?? 0),
      profile.children.n,
      catalogCitation("WPP2024_ASFR", country.wppYear, country.name),
      profile.age < 10
        ? "Age is under 10, so the count is 0. Age was drawn before children."
        : `Age and sex were already drawn. Mean children ever born is the sum of UN WPP age-specific fertility (births per woman per year) times years of exposure in each five-year age group, ${profile.children.mean?.toFixed(2)} at this age. The count is a Poisson draw around that mean, capped at age minus 10.`,
    );
  }
  if (country.tfr != null) {
    fact(
      facts,
      "household",
      "tfr",
      "Total fertility rate",
      `${country.tfr.toFixed(2)} births per woman`,
      country.tfr,
      catalogCitation("WPP2024_LEX", country.wppYear, country.name),
      "National total fertility rate from UN WPP 2024 demographic indicators, medium variant. This is the country rate, not this person's child count.",
    );
  }
  fact(
    facts,
    "household",
    "household-size",
    "Household size",
    "Not estimated",
    null,
    {
      source: "UN World Population Prospects 2024",
      indicator: "Average household size (not published)",
      year: country.wppYear,
      geography: country.name,
      url: "https://population.un.org/wpp/",
      retrieved: dataset.retrieved,
    },
    "UN WPP and World Bank WDI do not publish average household size. A DHS household-size request returned no records for this extract. The item is omitted rather than filled with a guessed number.",
  );
  fact(
    facts,
    "household",
    "marital",
    "Marital status",
    "Not estimated",
    null,
    {
      source: "UN World Population Prospects 2024",
      indicator: "Marital status by age (not in this extract)",
      year: country.wppYear,
      geography: country.name,
      url: "https://population.un.org/dataportal/",
      retrieved: dataset.retrieved,
    },
    "UN WPP does not publish marital status. The UN Data Portal data endpoint returned HTTP 401 for the currently-married series, so no status was drawn.",
  );

  if (profile.lex) {
    fact(
      facts,
      "health",
      "lex",
      `Life expectancy ${profile.lex.at}`,
      `${profile.lex.value.toFixed(1)} years`,
      profile.lex.value,
      catalogCitation("WPP2024_LEX", country.wppYear, `${country.name}, ${profile.sex}`),
      `Period life expectancy for ${profile.sex === "female" ? "females" : "males"} ${profile.lex.at}, UN WPP 2024 medium variant. It is not remaining life expectancy calculated as a personal forecast.`,
    );
  }

  const conditionCopy: Record<string, { label: string; note: string }> = {
    hypertension: {
      label: "Hypertension",
      note: "WHO age-standardized prevalence for adults 30–79. Applied only inside that age span, using the sex-specific rate. It is not this single year of age.",
    },
    diabetes: {
      label: "Diabetes",
      note: "World Bank series for ages 20–79. Not sex-specific. Applied only inside that age span.",
    },
    hiv: {
      label: "HIV",
      note: "Prevalence for ages 15–49. Applied only inside that age span. Sex-specific series used when the country has one.",
    },
    stunting: {
      label: "Stunting",
      note: "Prevalence among children under 5. Applied only when age is 0–4.",
    },
    anemia: {
      label: "Anemia",
      note: "The series is anemia among women 15–49, or among children when that series is the one resolved. It is not applied outside those groups.",
    },
  };
  for (const [id, copy] of Object.entries(conditionCopy)) {
    const draw = profile.conditions[id];
    if (!draw?.rate) continue;
    fact(
      facts,
      "health",
      id,
      copy.label,
      yesNo(draw.present, draw.rate, draw.group),
      draw.rate.v,
      fromResolved(draw.rate),
      `${howRate(draw.present, draw.rate, draw.group, copy.note)}`,
    );
  }
  if (profile.malaria) {
    fact(
      facts,
      "health",
      "malaria",
      "Malaria incidence",
      `${profile.malaria.v.toFixed(1)} per 1,000 population at risk per year`,
      profile.malaria.v,
      fromResolved(profile.malaria),
      "Shown as incidence, not as a person who has malaria today. An incidence is not a prevalence, so no individual case was drawn.",
    );
  }
  if (profile.tb) {
    fact(
      facts,
      "health",
      "tb",
      "Tuberculosis incidence",
      `${profile.tb.v.toFixed(1)} per 100,000 per year`,
      profile.tb.v,
      fromResolved(profile.tb),
      "Shown as incidence. No individual case was drawn from an incidence rate.",
    );
  }
  if (profile.water?.rate) {
    fact(
      facts,
      "health",
      "water",
      "Drinking water",
      yesNo(profile.water.present, profile.water.rate, profile.water.group),
      profile.water.rate.v,
      fromResolved(profile.water.rate),
      howRate(profile.water.present, profile.water.rate, profile.water.group, "Safely managed drinking water when that series exists, otherwise at least basic. Urban or rural series used when the draw already set the setting and the series exists."),
    );
  }
  if (profile.sanitation?.rate) {
    fact(
      facts,
      "health",
      "sanitation",
      "Sanitation",
      yesNo(profile.sanitation.present, profile.sanitation.rate, profile.sanitation.group),
      profile.sanitation.rate.v,
      fromResolved(profile.sanitation.rate),
      howRate(profile.sanitation.present, profile.sanitation.rate, profile.sanitation.group, "Safely managed sanitation when present, otherwise at least basic."),
    );
  }
  if (profile.uhc) {
    fact(
      facts,
      "health",
      "uhc",
      "Health service coverage",
      `Index ${profile.uhc.v.toFixed(0)} of 100`,
      profile.uhc.v,
      fromResolved(profile.uhc),
      "UHC service coverage index for the country. It is not an individual insurance status.",
    );
  }
  if (profile.oop) {
    fact(
      facts,
      "health",
      "oop",
      "Out-of-pocket health spending",
      `${profile.oop.v.toFixed(1)}% of current health expenditure`,
      profile.oop.v,
      fromResolved(profile.oop),
      "National share of health spending paid out of pocket. Not this person's bill.",
    );
  }

  if (profile.depression?.rate) {
    fact(
      facts,
      "mental",
      "depression",
      "Depression",
      yesNo(profile.depression.present, profile.depression.rate, profile.depression.group),
      profile.depression.rate.v,
      fromResolved(profile.depression.rate),
      howRate(
        profile.depression.present,
        profile.depression.rate,
        profile.depression.group,
        "WHO GHO GDO_q35 is a national estimate. It is not broken out by age or sex in this extract, so the same rate is used across ages and the limitation is part of the draw.",
      ),
    );
  }
  fact(
    facts,
    "mental",
    "anxiety",
    "Anxiety",
    "Not shown",
    null,
    {
      source: "WHO Global Health Observatory",
      indicator: "No anxiety prevalence series in the GHO extract",
      year: dataset.retrieved.slice(0, 4),
      geography: "Not published in the bundled extract",
      url: "https://ghoapi.azureedge.net/api/Indicator",
      retrieved: dataset.retrieved,
    },
    "An indicator search for anxiety on WHO GHO returned no prevalence series, and IHME age-sex anxiety prevalence was not available as an open download. The item is omitted rather than filled with an invented rate.",
  );
  if (profile.affect) {
    fact(
      facts,
      "mental",
      "affect",
      "Negative affect",
      percentText(profile.affect.v, profile.affect.i),
      profile.affect.v,
      catalogCitation("WHR2026_NEGATIVE_AFFECT", profile.affect.period, geographyLabel(profile.affect.kind, profile.affect.gname)),
      "World Happiness Report 2026 statistical appendix, negative affect for 2023–2025. It is the average of three Gallup World Poll shares: worry, sadness, and anger during a lot of the previous day. Stress is not in this index and was not published as a separate open data file, so it is not shown on its own. This is a country share, not a yes-or-no for this person.",
    );
  }
  if (profile.suicide) {
    fact(
      facts,
      "mental",
      "suicide",
      "Suicide rate",
      `${profile.suicide.band.v.toFixed(1)} per 100,000 per year (${profile.suicide.band.label})`,
      profile.suicide.band.v,
      catalogCitation("SDGSUICIDE", profile.suicide.y, `${geographyLabel(profile.suicide.kind, profile.suicide.gname)}, ${profile.sex}, ${profile.suicide.band.label}`),
      "WHO GHO SDGSUICIDE for this sex and the narrowest published age band that contains the drawn age. A mortality rate is not a prevalence, so the sheet does not assign a death.",
    );
  }

  if (profile.education) {
    if (profile.education.level) {
      const bachelor = profile.education.rates.find((rate) => rate.i === "SE.TER.CUAT.BA.ZS");
      fact(
        facts,
        "other",
        "education",
        "Education",
        profile.education.level,
        null,
        fromResolved(bachelor ?? profile.education.rates[0]!),
        "Drawn for ages 25 and older from UNESCO attainment via World Bank WDI. Less than primary, primary, upper secondary, and bachelor or higher use the nested shares (at least primary, at least upper secondary, bachelor or higher) when those shares line up. The series are for ages 25+.",
      );
    } else if (profile.education.rates.length > 0) {
      fact(
        facts,
        "other",
        "education",
        "Education",
        profile.education.rates.map((rate) => `${rate.i} ${rate.v.toFixed(1)}% (${rate.y})`).join("; "),
        null,
        fromResolved(profile.education.rates[0]!),
        "Attainment shares were not nested across indicators or years, so no single level was drawn. The published rates are listed instead.",
      );
    }
  }
  if (profile.inSchool?.rate) {
    fact(
      facts,
      "other",
      "school",
      "In school",
      yesNo(profile.inSchool.present, profile.inSchool.rate, profile.inSchool.group),
      profile.inSchool.rate.v,
      fromResolved(profile.inSchool.rate),
      howRate(profile.inSchool.present, profile.inSchool.rate, profile.inSchool.group, "Net enrollment for the matching school-age band. National rate, not this exact age."),
    );
  }
  if (profile.literacy?.rate) {
    fact(
      facts,
      "other",
      "literacy",
      "Literate",
      yesNo(profile.literacy.present, profile.literacy.rate, profile.literacy.group),
      profile.literacy.rate.v,
      fromResolved(profile.literacy.rate),
      howRate(profile.literacy.present, profile.literacy.rate, profile.literacy.group, "Adult literacy rate. Applied from age 15. Not further split by age."),
    );
  }
  const laborForce = profile.employment.laborForce;
  const laborRate = laborForce?.rate;
  if (laborForce && laborRate) {
    let status = "Not in the labor force";
    if (laborForce.present && profile.employment.unemployed?.present) status = "Unemployed";
    else if (laborForce.present && profile.employment.unemployed?.present === false) {
      status = profile.employment.informal?.present ? "Employed, informal" : profile.employment.informal?.present === false ? "Employed, not informal" : "Employed";
    } else if (laborForce.present) status = "In the labor force";
    fact(
      facts,
      "other",
      "work",
      "Work",
      status,
      laborRate.v,
      fromResolved(laborRate),
      `Labor-force participation was drawn first from the sex-specific ILO rate via World Bank WDI (${percentText(laborRate.v, laborRate.i)}). ${profile.employment.unemployed?.rate ? `Unemployment, among those in the labor force, uses ${profile.employment.unemployed.rate.i} at ${profile.employment.unemployed.rate.v.toFixed(1)}%.` : ""} ${profile.employment.informal?.rate ? `Informal employment, among those employed, uses ${profile.employment.informal.rate.i} at ${profile.employment.informal.rate.v.toFixed(1)}%.` : ""} Applied only from age 15.`,
    );
  }
  if (profile.employment.agriculture) {
    fact(
      facts,
      "other",
      "agriculture",
      "Employment in agriculture",
      `${profile.employment.agriculture.v.toFixed(1)}% of employment`,
      profile.employment.agriculture.v,
      fromResolved(profile.employment.agriculture),
      "National ILO share of employment in agriculture. Shown as context. It was not used as a second job draw on top of informal work.",
    );
  }
  if (profile.food?.rate) {
    fact(
      facts,
      "other",
      "food",
      "Food insecurity",
      yesNo(profile.food.present, profile.food.rate, profile.food.group),
      profile.food.rate.v,
      fromResolved(profile.food.rate),
      howRate(profile.food.present, profile.food.rate, profile.food.group, "FAO FIES prevalence of moderate or severe food insecurity in the population, via World Bank WDI."),
    );
  }
  if (profile.displaced?.rate) {
    fact(
      facts,
      "other",
      "displacement",
      "Displacement",
      yesNo(profile.displaced.present, profile.displaced.rate, profile.displaced.group),
      profile.displaced.rate.v,
      fromResolved(profile.displaced.rate),
      "UNHCR 2024 stocks of refugees, asylum seekers, and internally displaced people in the country of asylum, divided by the UN WPP population. Stocks can overlap, and the population total may already include some of these people. Returned refugees are not included.",
    );
  }
  if (profile.internet?.rate) {
    fact(
      facts,
      "other",
      "internet",
      "Internet use",
      yesNo(profile.internet.present, profile.internet.rate, profile.internet.group),
      profile.internet.rate.v,
      fromResolved(profile.internet.rate),
      howRate(profile.internet.present, profile.internet.rate, profile.internet.group, "ITU individuals using the internet, via World Bank WDI. National rate, applied from age 15."),
    );
  }
  if (profile.mobile) {
    fact(
      facts,
      "other",
      "mobile",
      "Mobile subscriptions",
      `${profile.mobile.v.toFixed(1)} per 100 people`,
      profile.mobile.v,
      fromResolved(profile.mobile),
      "ITU mobile-cellular subscriptions per 100 people. This can exceed 100, so it is not treated as the probability that this person owns a phone.",
    );
  }
  if (profile.ipv?.rate) {
    fact(
      facts,
      "other",
      "ipv",
      "Intimate-partner violence",
      yesNo(profile.ipv.present, profile.ipv.rate, profile.ipv.group),
      profile.ipv.rate.v,
      fromResolved(profile.ipv.rate),
      howRate(
        profile.ipv.present,
        profile.ipv.rate,
        profile.ipv.group,
        "Past-year physical or sexual violence by an intimate partner, women 15–49. The sheet records only the draw and the rate. No act is described.",
      ),
    );
  }
  if (profile.maternal) {
    fact(
      facts,
      "other",
      "maternal",
      "Maternal mortality",
      `${profile.maternal.v.toFixed(0)} deaths per 100,000 live births`,
      profile.maternal.v,
      fromResolved(profile.maternal),
      "Shown for women 15–49 as the national ratio. It is not an individual probability, so no death was drawn.",
    );
  }

  return facts.map((item) => ({ ...item, value: item.value.replace(/\s+/g, " ").trim() }));
}

const SHARE_INDICATORS = ["account_t_d", "save_any_t_d", "fin24aP", "UNHCR2024", "WHR2026_NEGATIVE_AFFECT"];

function probabilityOf(rate: ResolvedNumber): number {
  return SHARE_INDICATORS.includes(rate.i) ? rate.v : rate.v / 100;
}

function pct(p: number): string {
  if (p > 0 && p < 0.001) return "under 0.1%";
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * Only outcomes this person was actually drawn to have. Each one shows the
 * probability of that outcome, which is the published rate (or 1 − rate for a
 * missing service), for the group the draw used.
 */
export function problemsFromProfile(profile: Profile): SheetProblem[] {
  const problems: SheetProblem[] = [];
  const add = (id: string, draw: Draw | null, when: boolean, statement: string, invert = false) => {
    if (!draw || !draw.rate || draw.present !== when) return;
    const p = probabilityOf(draw.rate);
    const prob = invert ? 1 - p : p;
    const rateText = pct(p);
    problems.push({
      id,
      statement,
      probability: invert
        ? `Drawn with probability ${pct(prob)}, which is 100% minus the ${rateText} who do (${draw.group}).`
        : `Drawn with probability ${pct(prob)}, the published rate for ${draw.group}.`,
      citation: fromResolved(draw.rate),
    });
  };

  if (profile.income && profile.dailyPpp != null) {
    const block = profile.income.block;
    const line = profile.dailyPpp < 3 ? "3" : profile.dailyPpp < 4.2 ? "4.2" : null;
    if (line) {
      const head = block.headcount[line];
      problems.push({
        id: "poverty",
        statement:
          line === "3"
            ? "Lives below the $3.00-a-day extreme poverty line."
            : "Lives below the $4.20-a-day poverty line.",
        probability: `Follows from the income draw above (decile ${profile.decile}). ${head != null ? `${pct(head)} of people in ${profile.income.gname} live below this line.` : "National headcount not in the extract."}`,
        citation: catalogCitation("PIP", block.headcountYear[line] ?? block.year, geographyLabel(profile.income.kind, profile.income.gname)),
      });
    }
  }
  const c = profile.conditions;
  add("hypertension", c.hypertension ?? null, true, "Has high blood pressure (hypertension).");
  add("diabetes", c.diabetes ?? null, true, "Has diabetes.");
  add("hiv", c.hiv ?? null, true, "Is living with HIV.");
  add("stunting", c.stunting ?? null, true, "Is stunted: too short for their age from long-term undernutrition.");
  add("anemia", c.anemia ?? null, true, "Has anemia.");
  add("depression", profile.depression, true, "Has depression.");
  add("food", profile.food, true, "Faces moderate or severe food insecurity: not always able to get enough food.");
  add("water", profile.water, false,
    profile.water?.rate?.i.includes("SMDW")
      ? "Does not have safely managed drinking water (clean, on the premises, available when needed)."
      : "Does not have even basic drinking water.", true);
  add("sanitation", profile.sanitation, false,
    profile.sanitation?.rate?.i.includes("SMSS")
      ? "Does not have a safely managed toilet."
      : "Does not have even a basic private, hygienic toilet.", true);
  add("account", profile.account, false, "Has no bank or mobile-money account.", true);
  add("saved", profile.saved, false, "Saved no money in the past year.", true);
  add("emergency", profile.emergency, false, "Could not come up with emergency money if it were needed.", true);
  add("unemployed", profile.employment.unemployed, true, "Is unemployed and looking for work.");
  add("informal", profile.employment.informal, true, "Works an informal job, usually without a contract, sick pay, or pension.");
  add("displaced", profile.displaced, true, "Has been forced from home: a refugee, asylum seeker, or internally displaced person.");
  add("literacy", profile.literacy, false, "Cannot read and write.", true);
  add("school", profile.inSchool, false, "Is not enrolled in school.", true);
  add("ipv", profile.ipv, true, "Was physically or sexually abused by a partner in the past 12 months.");
  return problems;
}

export function sheetFromProfile(profile: Profile): GeneratedSheet {
  const facts = factsFromProfile(profile);
  const settingLabel = profile.setting === "urban" ? "Urban" : profile.setting === "rural" ? "Rural" : "";
  let name: GeneratedSheet["name"] = null;
  if (profile.name) {
    const n = profile.name;
    const text = n.surname ? `${n.given} ${n.surname}` : n.given;
    const citation = nameCitation(n, profile.country);
    const weightNote = (w: string | null) =>
      w === "count" ? "weighted by the published number of people with each name" : "weighted by 1/rank (a Zipf approximation, because the list gives ranks, not counts)";
    const howDrawn = `Given name drawn from the most common ${profile.sex === "female" ? "girls'/women's" : "boys'/men's"} names listed for ${n.givenFrom}${n.years ? ` (${n.years} list)` : ""}, ${weightNote(n.givenWeight)}; about ${pct(n.givenShare)} of that list's weight.${n.surname ? ` Surname drawn from the most common surnames in ${n.surnameFrom}, ${weightNote(n.surnameWeight)}.` : " No surname list was available, so only a given name is shown."}${n.givenFallback || n.surnameFallback ? ` ${profile.country.name} has no list in the dataset, so a population-weighted country from ${profile.country.regionName} was used.` : ""} Many lists rank names given to babies in one year, so older people may be less likely to carry them.`;
    name = { text, citation, howDrawn };
    facts.unshift({ id: "name", section: "where", label: "Likely name", value: text, figure: null, citation, howDrawn });
  }
  let headlineIncome: GeneratedSheet["headlineIncome"] = null;
  const annual = facts.find((item) => item.id === "annual");
  if (profile.income && profile.annualPpp != null && annual) {
    const child = profile.age < 18;
    const per = welfarePhrase(profile.income.block.welfare);
    const code = profile.country.currency || currencies.countries[profile.country.iso3]?.[0] || "";
    const gdpPpp = profile.country.series["PA.NUS.PPP"];
    let local: string | null = null;
    let localNote = "";
    if (code && profile.annualLocal != null && profile.annualLocal > 0) {
      local = localMoney(profile.annualLocal, code);
      localNote = ` Local currency (${code}) uses the 2021 PPP factor from World Bank PIP, so it reflects buying power, not the market exchange rate.`;
    } else if (code && gdpPpp && gdpPpp.v > 0) {
      local = localMoney(profile.annualPpp * gdpPpp.v, code);
      localNote = ` PIP has no consumption PPP factor here, so local currency (${code}) uses the World Bank GDP PPP conversion factor (PA.NUS.PPP, ${gdpPpp.y}: ${gdpPpp.v.toFixed(2)} per international $). It reflects buying power, not the market exchange rate, and is approximate.`;
    }
    headlineIncome = {
      usd: money(profile.annualPpp, 0),
      local,
      label: child ? "Household income per person, per year" : "Income per year",
      citation: annual.citation,
      howDrawn: `Decile ${profile.decile} average ${per} per day × 365, in 2021 USD PPP.${localNote} Currency code: ${currencies.source}.${child ? " A child has no income of their own; this is the household's income divided per person." : ""}`,
    };
  }
  return {
    id: profile.id,
    displayName: personWord(profile.age, profile.sex),
    age: profile.age,
    sex: profile.sex,
    setting: profile.setting,
    place: settingLabel ? `${settingLabel} ${profile.country.name}` : profile.country.name,
    region: profile.country.name,
    facts,
    iso3: profile.country.iso3,
    name,
    headlineIncome,
    problems: problemsFromProfile(profile),
  };
}

export function sourcesFromFacts(facts: readonly SheetFact[]): SheetCitation[] {
  const seen = new Set<string>();
  const sources: SheetCitation[] = [];
  for (const item of facts) {
    const key = `${item.citation.source}|${item.citation.url}|${item.citation.indicator}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(item.citation);
  }
  return sources;
}
