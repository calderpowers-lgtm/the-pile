/**
 * Draw on this phone from the bundled dataset. Nothing is requested from a server.
 */

import { generateSheet } from "@/lib/generator";
import type { DrawnSheet } from "@/lib/types";

export type DrawResult = {
  sheet: DrawnSheet;
  notice: string | null;
};

export function requestDraw(): DrawResult {
  return {
    sheet: { ...generateSheet(), source: "bundled" },
    notice: null,
  };
}
