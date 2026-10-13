"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { PrivacyNote } from "@/components/privacy-note";
import { publicPath } from "@/lib/base-path";
import { Button, buttonVariants } from "@/components/ui/button";
import { excerpt } from "@/lib/format";
import {
  acknowledgePrivacy,
  getHistorySnapshot,
  getJournalSnapshot,
  getProfileSnapshot,
  getUserSheetSnapshot,
  saveUserSheet,
  sheetIsReady,
  subscribeStore,
} from "@/lib/storage";
import { sectionBlob } from "@/lib/types";
import { cn } from "cn";

const STEPS = [
  {
    title: "How are you today?",
    body: "A number from 1 to 10.",
  },
  {
    title: "Dump it on the pile",
    body: "One page for what’s bothering you. Save it on this phone if you want it later.",
  },
  {
    title: "Three things you’re grateful for",
    body: "The three that matter today.",
  },
  {
    title: "Draw one person",
    body: "A factual profile, chosen from eight billion. Then decide if you take your own sheet back.",
  },
];

type HomeSnapshot = {
  sheetBody: string | null;
  ready: boolean;
  draws: number;
  privateOnDevice: boolean;
  journalCount: number;
  hasSheet: boolean;
};

let homeKey = "";
let homeSnapshot: HomeSnapshot = {
  sheetBody: null,
  ready: false,
  draws: 0,
  privateOnDevice: false,
  journalCount: 0,
  hasSheet: false,
};

function getHomeSnapshot(): HomeSnapshot {
  const sheet = getUserSheetSnapshot();
  const profile = getProfileSnapshot();
  const draws = getHistorySnapshot().length;
  const journalCount = getJournalSnapshot().length;
  const body = sheet?.vent.trim() || (sheet ? sectionBlob(sheet) : "");
  const ready = sheetIsReady(sheet);
  const privateOnDevice = Boolean(profile.privacyAcknowledgedAt);
  const key = `${sheet?.updatedAt ?? ""}:${sheet?.step ?? ""}:${body}:${draws}:${privateOnDevice}:${journalCount}`;
  if (key === homeKey) return homeSnapshot;
  homeKey = key;
  homeSnapshot = {
    sheetBody: body.length > 0 ? body : null,
    ready,
    draws,
    privateOnDevice,
    journalCount,
    hasSheet: sheet !== null,
  };
  return homeSnapshot;
}

export function HomeView() {
  const data = useSyncExternalStore(subscribeStore, getHomeSnapshot, () => null);

  function openCheckin() {
    const sheet = getUserSheetSnapshot();
    if (sheet && sheet.step !== "checkin") {
      saveUserSheet({ ...sheet, step: "checkin", updatedAt: new Date().toISOString() });
    }
  }

  return (
    <div className="pb-4">
      <h1 className="sr-only">The Pile</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={publicPath("/brand/logo.png")} alt="" className="mx-auto -mt-2 w-full max-w-[340px]" />
      <p className="text-center text-xs font-medium tracking-[0.18em] text-primary uppercase">Gratitude practice</p>
      <p className="mt-5 font-serif text-xl leading-snug text-foreground/90 italic">
        If we each put our problems on a sheet of paper and made one pile, most of us would choose our own sheet back.
      </p>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        This is a quiet place to try that. Say how you are, dump what’s on you, name three gratitudes, and draw one other life.
      </p>

      {data && !data.privateOnDevice ? (
        <section className="pile-shadow mt-6 rounded-3xl border border-primary/20 bg-card px-4 py-4">
          <h2 className="font-serif text-2xl tracking-tight">Private on this phone</h2>
          <div className="mt-3">
            <PrivacyNote />
          </div>
          <Button type="button" size="touch" className="mt-4 w-full" onClick={() => acknowledgePrivacy()}>
            I understand — keep it on this phone
          </Button>
        </section>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your words stay in this browser on this phone. They are never uploaded, and a draw does not include them.{" "}
          <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
            Privacy
          </Link>
        </p>
      )}

      {data?.sheetBody ? (
        <blockquote className="mt-6 border-l-2 border-primary/50 pl-4">
          <p className="font-serif text-lg leading-relaxed italic">{excerpt(data.sheetBody, 180)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Your sheet is on this phone only.</p>
        </blockquote>
      ) : null}

      <div className="mt-8 flex min-h-12 flex-col gap-3">
        {data?.ready ? (
          <>
            <Link href="/draw" className={cn(buttonVariants({ size: "touch" }), "w-full")}>
              Draw from the pile
            </Link>
            <Link href="/sheet" className={cn(buttonVariants({ size: "touch", variant: "outline" }), "w-full")}>
              Edit your sheet
            </Link>
          </>
        ) : (
          <Link href="/sheet" className={cn(buttonVariants({ size: "touch" }), "w-full")}>
            {data?.sheetBody ? "Continue your sheet" : "How are you today?"}
          </Link>
        )}
        {data?.hasSheet ? (
          <Link
            href="/sheet"
            onClick={openCheckin}
            className={cn(buttonVariants({ size: "touch", variant: "ghost" }), "w-full")}
          >
            Check in and journal
          </Link>
        ) : null}
        {data && data.journalCount > 0 ? (
          <Link href="/journal" className={cn(buttonVariants({ size: "touch", variant: "ghost" }), "w-full")}>
            Journal · {data.journalCount}
          </Link>
        ) : null}
        {data && data.draws > 0 ? (
          <Link href="/history" className={cn(buttonVariants({ size: "touch", variant: "ghost" }), "w-full")}>
            History · {data.draws}
          </Link>
        ) : null}
      </div>

      <ol className="mt-10 space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <details className="pile-shadow mt-10 rounded-3xl border border-border bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Add The Pile to your home screen</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>On iPhone: open the Share menu, then Add to Home Screen.</p>
          <p>On Android: open the browser menu, then Install app or Add to Home screen.</p>
        </div>
      </details>
    </div>
  );
}
