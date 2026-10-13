"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { localDay } from "@/lib/format";
import {
  MIN_SHEET_LENGTH,
  dumpLength,
  getJournalSnapshot,
  getUserSheetSnapshot,
  saveJournalEntry,
  saveUserSheet,
  subscribeStore,
} from "@/lib/storage";
import { emptyGratitudes, type SheetStep, type UserSheet } from "@/lib/types";
import { cn } from "cn";

const EMPTY: UserSheet = {
  financial: "",
  health: "",
  emotional: "",
  vent: "",
  gratitudes: emptyGratitudes(),
  ageBand: null,
  mood: null,
  weighing: "",
  checkedOn: null,
  step: "checkin",
  updatedAt: "",
};

const MOODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function visibleStep(sheet: UserSheet): SheetStep {
  if (sheet.step === "sort" || sheet.step === "thanks") return "thanks";
  if (sheet.step === "checkin") return "checkin";
  if (sheet.mood === null && dumpLength(sheet) < MIN_SHEET_LENGTH) return "checkin";
  return "dump";
}

export function SheetEditor() {
  const stored = useSyncExternalStore(subscribeStore, getUserSheetSnapshot, () => null);
  const journalCount = useSyncExternalStore(subscribeStore, () => getJournalSnapshot().length, () => 0);
  const sheet = stored ?? EMPTY;
  const step = visibleStep(sheet);
  const dumped = dumpLength(sheet);
  const remaining = Math.max(0, MIN_SHEET_LENGTH - dumped);
  const [saveNote, setSaveNote] = useState<"saved" | "failed" | null>(null);

  function commit(next: UserSheet) {
    saveUserSheet({ ...next, updatedAt: new Date().toISOString() });
  }

  function setGratitude(index: number, value: string) {
    const gratitudes = [...sheet.gratitudes] as UserSheet["gratitudes"];
    gratitudes[index] = value;
    commit({ ...sheet, gratitudes });
  }

  function keepEntry() {
    const body = sheet.vent.trim();
    if (!body) return;
    const id = crypto.randomUUID();
    saveJournalEntry({
      id,
      savedAt: new Date().toISOString(),
      mood: sheet.mood,
      weighing: sheet.weighing.trim(),
      body,
    });
    setSaveNote(getJournalSnapshot().some((entry) => entry.id === id) ? "saved" : "failed");
  }

  return (
    <div className="pb-6">
      {step === "checkin" ? (
        <>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Step 1 of 3</p>
          <h1 id="mood-label" className="mt-2 font-serif text-4xl tracking-tight">
            How are you today?
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">1 is a hard day. 10 is a good one.</p>
          <div role="radiogroup" aria-labelledby="mood-label" className="mt-5 grid grid-cols-5 gap-2">
            {MOODS.map((n) => {
              const selected = sheet.mood === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border text-base font-medium",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                  )}
                  onClick={() => commit({ ...sheet, mood: n, step: "checkin" })}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Saved on this phone only. Never sent.</p>
          <div className="mt-4">
            <Button
              type="button"
              size="touch"
              className="w-full"
              disabled={sheet.mood === null}
              onClick={() => commit({ ...sheet, checkedOn: localDay(), step: "dump" })}
            >
              Dump it on the pile
            </Button>
            {sheet.mood === null ? (
              <p className="mt-2 text-sm text-muted-foreground">Choose a number from 1 to 10 to continue.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {step === "dump" ? (
        <>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Step 2 of 3</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Dump it on the pile</h1>
          {sheet.mood !== null ? (
            <p className="mt-3 text-sm text-muted-foreground">Today you marked {sheet.mood} of 10.</p>
          ) : null}
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Pour out whatever is bothering you. You can save a copy on this phone. Saving is optional, and the draft stays either way.
          </p>
          <label htmlFor="sheet-vent" className="mt-6 block text-sm font-medium">
            Everything on your mind
          </label>
          <Textarea
            id="sheet-vent"
            value={sheet.vent}
            onChange={(event) => commit({ ...sheet, vent: event.target.value })}
            placeholder="Start anywhere. The loudest thing is enough."
            className="mt-2 font-serif text-lg"
            style={{ minHeight: "42vh" }}
            aria-describedby="sheet-status"
          />
          <p id="sheet-status" className="mt-2 text-sm text-muted-foreground">
            Saved on this phone only. Never sent.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Button type="button" size="touch" variant="outline" className="w-full" disabled={dumped === 0} onClick={keepEntry}>
              Save this entry on this phone
            </Button>
            {dumped === 0 ? <p className="text-sm text-muted-foreground">Write something first if you want a saved entry.</p> : null}
            {saveNote === "saved" ? (
              <p className="text-sm text-foreground">
                Saved. Only this phone has it.{" "}
                <Link href="/journal" className="font-medium text-primary underline-offset-4 hover:underline">
                  Read your journal
                </Link>
              </p>
            ) : null}
            {saveNote === "failed" ? (
              <p className="text-sm text-muted-foreground">This browser did not keep the entry. The draft is still on the page.</p>
            ) : null}
            {journalCount > 0 && saveNote !== "saved" ? (
              <Link href="/journal" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Read saved entries
              </Link>
            ) : null}
            {remaining === 0 ? (
              <Button type="button" size="touch" className="w-full" onClick={() => commit({ ...sheet, step: "thanks" })}>
                Three things I’m grateful for
              </Button>
            ) : (
              <>
                <Button type="button" size="touch" className="w-full" disabled>
                  Three things I’m grateful for
                </Button>
                <p className="text-sm text-muted-foreground">
                  Write a little more first. {remaining} more character{remaining === 1 ? "" : "s"}.
                </p>
              </>
            )}
            <Button type="button" size="touch" variant="ghost" className="w-full" onClick={() => commit({ ...sheet, step: "checkin" })}>
              Back to how you feel
            </Button>
          </div>
        </>
      ) : null}

      {step === "thanks" ? (
        <>
          <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Step 3 of 3</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Three things, today</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The three things you feel grateful for today. Then you draw one person from the world.
          </p>
          <div className="mt-6 space-y-2">
            {sheet.gratitudes.map((line, index) => (
              <Textarea
                key={index}
                value={line}
                aria-label={`Grateful for, ${index + 1}`}
                onChange={(event) => setGratitude(index, event.target.value)}
                placeholder={`${index + 1}.`}
                rows={2}
                className="font-serif"
                style={{ minHeight: "4.25rem" }}
              />
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/draw" className={cn(buttonVariants({ size: "touch" }), "w-full")}>
              Draw from the pile
            </Link>
            <Button type="button" size="touch" variant="outline" className="w-full" onClick={() => commit({ ...sheet, step: "dump" })}>
              Back to the pile
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => commit({ ...sheet, step: "checkin" })}
            >
              Check in again
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
