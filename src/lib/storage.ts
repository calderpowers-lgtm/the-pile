/**
 * On-device persistence. Mood, journal, profile, sheet, and history stay in
 * this browser. Draws are computed on this phone, and there is no account.
 *
 * React views should read through `useSyncExternalStore` with the snapshot
 * helpers below so server render and the first client render match.
 */

import {
  isDrawnSheet,
  normalizeGratitudes,
  type DrawnSheet,
  type HistoryEntry,
  type JournalEntry,
  type LocalProfile,
  type SheetStep,
  type UserSheet,
} from "@/lib/types";

export const USER_SHEET_KEY = "pile.userSheet.v1";
export const HISTORY_KEY = "pile.history.v1";
export const PROFILE_KEY = "pile.profile.v1";
export const JOURNAL_KEY = "pile.journal.v1";

const STORE_KEYS = new Set([USER_SHEET_KEY, HISTORY_KEY, PROFILE_KEY, JOURNAL_KEY]);

export const EMPTY_PROFILE: LocalProfile = {
  name: "",
  ageBand: null,
  privacyAcknowledgedAt: null,
};

const HISTORY_LIMIT = 100;

export const MIN_SHEET_LENGTH = 12;

export function dumpLength(sheet: UserSheet | null | undefined): number {
  return sheet?.vent.trim().length ?? 0;
}

/** The swap opens after the dump and the gratitude step. */
export function sheetIsReady(sheet: UserSheet | null | undefined): boolean {
  return dumpLength(sheet) >= MIN_SHEET_LENGTH && (sheet?.step === "thanks" || sheet?.step === "sort");
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseUserSheet(value: unknown): UserSheet | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<UserSheet> & { body?: unknown };
  const legacyBody = textField(record.body);
  const financial = textField(record.financial);
  const health = textField(record.health);
  const emotional = textField(record.emotional);
  const vent = textField(record.vent) || legacyBody;
  if (
    typeof record.financial !== "string" &&
    typeof record.health !== "string" &&
    typeof record.emotional !== "string" &&
    typeof record.vent !== "string" &&
    typeof record.body !== "string"
  ) {
    return null;
  }
  const gratitudes = normalizeGratitudes(record.gratitudes);
  return {
    financial,
    health,
    emotional,
    vent,
    gratitudes,
    ageBand: typeof record.ageBand === "string" ? record.ageBand : null,
    mood: parseMood(record.mood),
    weighing: textField(record.weighing),
    checkedOn: typeof record.checkedOn === "string" ? record.checkedOn : null,
    step: parseStep(record.step, vent, financial, health, emotional, gratitudes),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  };
}

function parseMood(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) return null;
  return value;
}

function parseStep(
  value: unknown,
  vent: string,
  financial: string,
  health: string,
  emotional: string,
  gratitudes: readonly string[],
): SheetStep {
  if (value === "checkin" || value === "dump" || value === "sort" || value === "thanks") return value;
  const sorted = [financial, health, emotional, ...gratitudes].some((line) => line.trim().length > 0);
  if (sorted || vent.trim().length >= MIN_SHEET_LENGTH) return "thanks";
  return "dump";
}

function parseGratitudes(record: { gratitudes?: unknown; gratitudeNote?: unknown }): string[] {
  if (Array.isArray(record.gratitudes)) {
    return record.gratitudes.filter((line): line is string => typeof line === "string").slice(0, 3);
  }
  return typeof record.gratitudeNote === "string" && record.gratitudeNote.trim() ? [record.gratitudeNote] : [];
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<HistoryEntry> & { gratitudeNote?: unknown };
  if (typeof record.id !== "string" || typeof record.drawnAt !== "string") return false;
  const sheet = coerceStoredSheet(record.sheet);
  if (!sheet) return false;
  record.sheet = sheet;
  record.gratitudes = parseGratitudes(record);
  return true;
}

/** Older saves were first-person composites. Those are not shown. */
function coerceStoredSheet(value: unknown): DrawnSheet | null {
  if (isDrawnSheet(value)) return value;
  return null;
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isHistoryEntry).slice(0, HISTORY_LIMIT);
}

const listeners = new Set<() => void>();

let userRaw: string | null | undefined;
let userSnapshot: UserSheet | null = null;
let historyRaw: string | null | undefined;
let historySnapshot: HistoryEntry[] = [];
let bootstrapKey = "";
let bootstrapSnapshot: { sheet: UserSheet | null; open: HistoryEntry | null } = {
  sheet: null,
  open: null,
};

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key && !STORE_KEYS.has(event.key)) return;
    userRaw = undefined;
    historyRaw = undefined;
    profileRaw = undefined;
    journalRaw = undefined;
    bootstrapKey = "";
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getUserSheetSnapshot(): UserSheet | null {
  if (!canStore()) return null;
  const raw = window.localStorage.getItem(USER_SHEET_KEY);
  if (raw === userRaw) return userSnapshot;
  userRaw = raw;
  if (!raw) {
    userSnapshot = null;
    return userSnapshot;
  }
  try {
    userSnapshot = parseUserSheet(JSON.parse(raw) as unknown);
  } catch {
    userSnapshot = null;
  }
  return userSnapshot;
}

export function getHistorySnapshot(): HistoryEntry[] {
  if (!canStore()) return historySnapshot;
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (raw === historyRaw) return historySnapshot;
  historyRaw = raw;
  if (!raw) {
    historySnapshot = [];
    return historySnapshot;
  }
  try {
    historySnapshot = parseHistory(JSON.parse(raw) as unknown);
  } catch {
    historySnapshot = [];
  }
  return historySnapshot;
}

export function getDrawBootstrap(): { sheet: UserSheet | null; open: HistoryEntry | null } {
  const sheet = getUserSheetSnapshot();
  const history = getHistorySnapshot();
  const key = `${userRaw ?? ""}::${historyRaw ?? ""}`;
  if (key === bootstrapKey) return bootstrapSnapshot;
  bootstrapKey = key;
  const open =
    history.find(
      (entry) => entry.decision === "pending" || (entry.decision === "took-back" && !entry.gratitudeResolved),
    ) ?? null;
  bootstrapSnapshot = { sheet, open };
  return bootstrapSnapshot;
}

export function loadUserSheet(): UserSheet | null {
  return getUserSheetSnapshot();
}

export function saveUserSheet(sheet: UserSheet): void {
  if (!canStore()) return;
  try {
    const raw = JSON.stringify(sheet);
    window.localStorage.setItem(USER_SHEET_KEY, raw);
    userRaw = raw;
    userSnapshot = sheet;
    bootstrapKey = "";
    emit();
  } catch {
    // Private mode and full storage should not crash the practice.
  }
}

export function loadHistory(): HistoryEntry[] {
  return getHistorySnapshot();
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (!canStore()) return;
  try {
    const trimmed = entries.slice(0, HISTORY_LIMIT);
    const raw = JSON.stringify(trimmed);
    window.localStorage.setItem(HISTORY_KEY, raw);
    historyRaw = raw;
    historySnapshot = trimmed;
    bootstrapKey = "";
    emit();
  } catch {
    // Ignore quota and private-mode failures.
  }
}

export function upsertHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
  saveHistory(next);
  return next;
}

export function removeHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((item) => item.id !== id);
  saveHistory(next);
  return next;
}

let profileRaw: string | null | undefined;
let profileSnapshot: LocalProfile = EMPTY_PROFILE;
let journalRaw: string | null | undefined;
let journalSnapshot: JournalEntry[] = [];

function parseProfile(value: unknown): LocalProfile {
  if (typeof value !== "object" || value === null) return EMPTY_PROFILE;
  const record = value as Partial<LocalProfile>;
  const ageBand = typeof record.ageBand === "string" ? record.ageBand : null;
  return {
    name: textField(record.name).slice(0, 40),
    ageBand,
    privacyAcknowledgedAt: typeof record.privacyAcknowledgedAt === "string" ? record.privacyAcknowledgedAt : null,
  };
}

function parseJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: JournalEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Partial<JournalEntry>;
    if (typeof record.id !== "string" || typeof record.savedAt !== "string") continue;
    const body = textField(record.body).trim();
    if (!body) continue;
    entries.push({
      id: record.id,
      savedAt: record.savedAt,
      mood: parseMood(record.mood),
      weighing: textField(record.weighing),
      body,
    });
    if (entries.length >= HISTORY_LIMIT) break;
  }
  return entries;
}

export function getProfileSnapshot(): LocalProfile {
  if (!canStore()) return EMPTY_PROFILE;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (raw === profileRaw) return profileSnapshot;
  profileRaw = raw;
  if (!raw) {
    profileSnapshot = EMPTY_PROFILE;
    return profileSnapshot;
  }
  try {
    profileSnapshot = parseProfile(JSON.parse(raw) as unknown);
  } catch {
    profileSnapshot = EMPTY_PROFILE;
  }
  return profileSnapshot;
}

export function saveProfile(profile: LocalProfile): void {
  if (!canStore()) return;
  const next: LocalProfile = {
    name: profile.name.trim().slice(0, 40),
    ageBand: profile.ageBand,
    privacyAcknowledgedAt: profile.privacyAcknowledgedAt,
  };
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(PROFILE_KEY, raw);
    profileRaw = raw;
    profileSnapshot = next;
    emit();
  } catch {
    // Private mode and full storage should not crash the practice.
  }
}

export function acknowledgePrivacy(): void {
  const current = getProfileSnapshot();
  saveProfile({ ...current, privacyAcknowledgedAt: new Date().toISOString() });
}

export function getJournalSnapshot(): JournalEntry[] {
  if (!canStore()) return journalSnapshot;
  const raw = window.localStorage.getItem(JOURNAL_KEY);
  if (raw === journalRaw) return journalSnapshot;
  journalRaw = raw;
  if (!raw) {
    journalSnapshot = [];
    return journalSnapshot;
  }
  try {
    journalSnapshot = parseJournal(JSON.parse(raw) as unknown);
  } catch {
    journalSnapshot = [];
  }
  return journalSnapshot;
}

export function saveJournalEntry(entry: JournalEntry): JournalEntry[] {
  const next = [entry, ...getJournalSnapshot().filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
  writeJournal(next);
  return next;
}

export function removeJournalEntry(id: string): JournalEntry[] {
  const next = getJournalSnapshot().filter((item) => item.id !== id);
  writeJournal(next);
  return next;
}

function writeJournal(entries: JournalEntry[]): void {
  if (!canStore()) return;
  try {
    const raw = JSON.stringify(entries);
    window.localStorage.setItem(JOURNAL_KEY, raw);
    journalRaw = raw;
    journalSnapshot = entries;
    emit();
  } catch {
    // Ignore quota and private-mode failures.
  }
}
