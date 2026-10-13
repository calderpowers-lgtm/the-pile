/**
 * Draw one factual profile from the bundled dataset.
 * There is no first-person text and no network call.
 */

import { sheetFromProfile } from "@/lib/profile/sheet";
import { sampleProfile } from "@/lib/profile/sample";
import type { GeneratedSheet, Rng } from "@/lib/types";

export function generateSheet(options: { rng?: Rng; iso3?: string } = {}): GeneratedSheet {
  const rng = options.rng ?? Math.random;
  return sheetFromProfile(sampleProfile(rng, { iso3: options.iso3 }));
}
