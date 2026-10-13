import type { Rng } from "@/lib/types";

export type { Rng };

/** Deterministic RNG for tests and reproducible samples. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index]!;
}

export function weighted<T>(
  rng: Rng,
  items: readonly { item: T; weight: number }[],
): T {
  if (items.length === 0) {
    throw new Error("Cannot weight an empty list");
  }
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return items[items.length - 1]!.item;
  let roll = rng() * total;
  for (const entry of items) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry.item;
  }
  return items[items.length - 1]!.item;
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function integer(rng: Rng, min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + Math.floor(rng() * (high - low + 1));
}

/** Standard normal via Box–Muller. */
export function gaussian(rng: Rng): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function makeId(rng: Rng): string {
  let id = "";
  for (let i = 0; i < 20; i += 1) {
    id += Math.floor(rng() * 36).toString(36);
  }
  return id;
}
