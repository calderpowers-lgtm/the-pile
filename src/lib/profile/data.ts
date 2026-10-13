import raw from "@/data/pile-dataset.json";

import type { Dataset } from "@/lib/profile/types";

export const dataset = raw as unknown as Dataset;

export function geographyLabel(kind: string, name: string): string {
  if (kind === "country" || kind === "survey") return name;
  if (kind === "interpolated") return `${name} (PIP interpolated series)`;
  if (kind === "filled-gap") return `${name} (World Bank PIP filled gap, not a direct survey)`;
  if (kind === "region" || kind === "region-average") return `${name} (regional fallback)`;
  if (kind === "income" || kind === "income-average") return `${name} (income-group fallback)`;
  return name;
}
