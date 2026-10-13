"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { PaperMark } from "@/components/paper-mark";
import { SectionStack } from "@/components/section-stack";
import { SheetCard } from "@/components/sheet-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestDraw } from "@/lib/draw";
import { EMPTY_PROFILE, getDrawBootstrap, getProfileSnapshot, saveUserSheet, sheetIsReady, subscribeStore, upsertHistory } from "@/lib/storage";
import { AGE_BANDS, emptyGratitudes, filledGratitudes, normalizeGratitudes, type Gratitudes, type HistoryEntry } from "@/lib/types";
import { cn } from "cn";

const LOADING_LINES = [
  "One person, chosen from eight billion.",
  "A life, drawn at random from the world.",
];

type Phase =
  | { name: "boot" }
  | { name: "need-sheet" }
  | { name: "ready" }
  | { name: "loading" }
  | { name: "error" }
  | { name: "sheet"; entry: HistoryEntry }
  | { name: "gratitude"; entry: HistoryEntry; draft: Gratitudes }
  | { name: "done"; entry: HistoryEntry };

export function DrawFlow() {
  const boot = useSyncExternalStore(subscribeStore, getDrawBootstrap, () => null);
  const profile = useSyncExternalStore(subscribeStore, getProfileSnapshot, () => EMPTY_PROFILE);
  const [override, setOverride] = useState<Exclude<Phase, { name: "boot" }> | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const drawing = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const userSheet = boot?.sheet ?? null;

  let phase: Phase;
  if (override) {
    phase = override;
  } else if (!boot) {
    phase = { name: "boot" };
  } else if (!sheetIsReady(boot.sheet)) {
    phase = { name: "need-sheet" };
  } else if (boot.open?.decision === "pending") {
    phase = { name: "sheet", entry: boot.open };
  } else if (boot.open?.decision === "took-back") {
    phase = { name: "done", entry: boot.open };
  } else {
    phase = { name: "ready" };
  }

  useEffect(() => {
    if (phase.name !== "loading") return;
    const timer = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [phase.name]);

  const focusKey =
    phase.name === "sheet" || phase.name === "gratitude" || phase.name === "done"
      ? `${phase.name}:${phase.entry.id}`
      : phase.name;

  useEffect(() => {
    if (focusKey.startsWith("sheet:") || focusKey.startsWith("gratitude:") || focusKey.startsWith("done:")) {
      headingRef.current?.focus();
    }
  }, [focusKey]);

  async function draw() {
    if (drawing.current) return;
    drawing.current = true;
    setOverride({ name: "loading" });
    const started = Date.now();
    try {
      const result = await requestDraw();
      const wait = 1100 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
      const entry: HistoryEntry = {
        id: result.sheet.id,
        drawnAt: new Date().toISOString(),
        sheet: result.sheet,
        decision: "pending",
        gratitudes: [],
        gratitudeResolved: false,
        decidedAt: null,
        notice: result.notice,
      };
      upsertHistory(entry);
      setOverride({ name: "sheet", entry });
    } catch {
      setOverride({ name: "error" });
    } finally {
      drawing.current = false;
    }
  }

  function takeBack(entry: HistoryEntry) {
    const gratitudes = filledGratitudes(userSheet?.gratitudes ?? emptyGratitudes());
    const next: HistoryEntry = {
      ...entry,
      decision: "took-back",
      decidedAt: new Date().toISOString(),
      gratitudes,
      gratitudeResolved: true,
    };
    upsertHistory(next);
    setOverride({ name: "done", entry: next });
  }

  function keepLooking(entry: HistoryEntry) {
    const next: HistoryEntry = {
      ...entry,
      decision: "kept-looking",
      decidedAt: new Date().toISOString(),
      gratitudeResolved: true,
    };
    setOverride({ name: "loading" });
    upsertHistory(next);
    void draw();
  }

  function finish(entry: HistoryEntry, draft: Gratitudes | null) {
    const gratitudes = draft ? filledGratitudes(draft) : [];
    const next: HistoryEntry = {
      ...entry,
      gratitudes,
      gratitudeResolved: true,
    };
    upsertHistory(next);
    if (userSheet && draft) {
      saveUserSheet({ ...userSheet, gratitudes: normalizeGratitudes(draft), updatedAt: new Date().toISOString() });
    }
    setOverride({ name: "done", entry: next });
  }

  if (phase.name === "boot") {
    return <p className="pt-16 text-center text-muted-foreground">Opening the pile…</p>;
  }

  if (phase.name === "need-sheet") {
    return (
      <div className="pt-8">
        <h1 className="font-serif text-4xl tracking-tight">Write yours first</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          The choice only means something if your sheet is on the table. A few honest lines are enough.
        </p>
        <Link href="/sheet" className={cn(buttonVariants({ size: "touch" }), "mt-8 w-full")}>
          Write your sheet
        </Link>
      </div>
    );
  }

  if (phase.name === "ready") {
    return (
      <div className="pt-6">
        <h1 className="font-serif text-4xl tracking-tight">Draw one sheet</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          One person, chosen from eight billion. The sheet is a factual profile, with the statistic behind each line.
        </p>
        <Button type="button" size="touch" className="mt-8 w-full" onClick={() => void draw()}>
          Draw from the pile
        </Button>
      </div>
    );
  }

  if (phase.name === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[62vh] flex-col items-center justify-center text-center">
        <PaperMark animated />
        <h1 className="mt-8 font-serif text-3xl tracking-tight">Drawing from the pile…</h1>
        <p className="mt-3 max-w-xs text-base text-muted-foreground">{LOADING_LINES[lineIndex]}</p>
      </div>
    );
  }

  if (phase.name === "error") {
    return (
      <div role="alert" className="pt-8">
        <h1 className="font-serif text-4xl tracking-tight">The sheet didn’t come up</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">Something went quiet on the way to the pile. You can try again.</p>
        <Button type="button" size="touch" className="mt-8 w-full" onClick={() => void draw()}>
          Try again
        </Button>
      </div>
    );
  }

  if (phase.name === "done") {
    return (
      <div className="pt-6">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <h1 className="font-serif text-4xl tracking-tight">You took yours back.</h1>
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {phase.entry.gratitudes.length > 0
            ? "Those three lines are on this phone, with the rest of your history."
            : "That’s enough for today. The draw is in your history if you want to read it again."}
        </p>
        {phase.entry.gratitudes.length > 0 ? (
          <ol className="pile-shadow mt-6 space-y-3 rounded-3xl border border-border bg-card px-5 py-5 font-serif text-lg leading-relaxed italic">
            {phase.entry.gratitudes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : null}
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/" className={cn(buttonVariants({ size: "touch" }), "w-full")}>
            Back home
          </Link>
          <Link href="/history" className={cn(buttonVariants({ size: "touch", variant: "outline" }), "w-full")}>
            See history
          </Link>
        </div>
      </div>
    );
  }

  const entry = phase.entry;
  const ageLabel = AGE_BANDS.find((band) => band.id === (profile.ageBand ?? userSheet?.ageBand))?.label;

  return (
    <div>
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        {phase.name === "gratitude" ? (
          <h1 className="font-serif text-4xl tracking-tight">You took yours back.</h1>
        ) : (
          <h1 className="sr-only">A sheet from the pile</h1>
        )}
      </div>

      {phase.name === "gratitude" ? (
        <div className="mt-3 mb-6">
          <p className="text-base leading-relaxed text-muted-foreground">
            Name the three things you are most grateful for today. The profile you drew is below. You can also leave this blank.
          </p>
          <p className="mt-4 text-sm font-medium">Three things you are most grateful for today</p>
          <div className="mt-2 space-y-2">
            {(phase.name === "gratitude" ? phase.draft : emptyGratitudes()).map((line, index) => (
              <Textarea
                key={index}
                id={index === 0 ? "gratitude-note" : undefined}
                value={line}
                aria-label={`Grateful for, ${index + 1}`}
                onChange={(event) => {
                  if (phase.name !== "gratitude") return;
                  const draft = [...phase.draft] as Gratitudes;
                  draft[index] = event.target.value;
                  setOverride({ name: "gratitude", entry, draft });
                }}
                maxLength={240}
                rows={2}
                placeholder={`${index + 1}.`}
                className="font-serif"
                style={{ minHeight: "4.25rem" }}
              />
            ))}
          </div>
          <Button
            type="button"
            size="touch"
            className="mt-3 w-full"
            onClick={() => finish(entry, phase.name === "gratitude" ? phase.draft : null)}
          >
            {phase.name === "gratitude" && filledGratitudes(phase.draft).length > 0 ? "Save these" : "That’s enough"}
          </Button>
          {phase.name === "gratitude" && filledGratitudes(phase.draft).length > 0 ? (
            <Button type="button" size="touch" variant="ghost" className="mt-1 w-full" onClick={() => finish(entry, null)}>
              Skip for now
            </Button>
          ) : null}
        </div>
      ) : null}

      {entry.notice ? (
        <p className="pile-shadow mb-4 rounded-3xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {entry.notice}
        </p>
      ) : null}

      <SheetCard sheet={entry.sheet} />

      {userSheet && sheetIsReady(userSheet) ? (
        <details className="pile-shadow mt-4 rounded-3xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">Your sheet, for the comparison</summary>
          <div className="mt-3">
            {ageLabel ? <p className="mb-3 text-sm text-muted-foreground">{ageLabel}</p> : null}
            <SectionStack sections={userSheet} gratitudes={userSheet.gratitudes} />
          </div>
        </details>
      ) : null}

      {phase.name === "sheet" ? (
        <>
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-4">
            <div className="pile-shadow mx-auto max-w-md rounded-3xl border border-border bg-card/95 p-3 backdrop-blur-md">
              <Button type="button" size="touch" className="w-full" onClick={() => takeBack(entry)}>
                Take mine back
              </Button>
              <Button type="button" size="touch" variant="ghost" className="mt-1 w-full" onClick={() => keepLooking(entry)}>
                Keep looking
              </Button>
            </div>
          </div>
          <div className="h-40" aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}
