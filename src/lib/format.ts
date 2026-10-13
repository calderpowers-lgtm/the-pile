/** Round an illustrative income to a human-looking figure. */
export function roundIncome(amount: number): number {
  if (amount < 1000) return Math.max(200, Math.round(amount / 50) * 50);
  if (amount < 5000) return Math.round(amount / 100) * 100;
  if (amount < 20000) return Math.round(amount / 500) * 500;
  if (amount < 100000) return Math.round(amount / 1000) * 1000;
  return Math.round(amount / 5000) * 5000;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function incomeLabel(amount: number): string {
  return `About ${formatUsd(amount)} a year`;
}

export function excerpt(text: string, max = 96): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** Calendar day in the device's local timezone, YYYY-MM-DD. */
export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function decisionLabel(decision: "pending" | "took-back" | "kept-looking"): string {
  if (decision === "took-back") return "Took mine back";
  if (decision === "kept-looking") return "Kept looking";
  return "Still open";
}
