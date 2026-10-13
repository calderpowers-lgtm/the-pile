"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { decisionLabel, excerpt, formatWhen } from "@/lib/format";
import { filledGratitudes } from "@/lib/types";
import { getHistorySnapshot, saveHistory, subscribeStore } from "@/lib/storage";
import type { HistoryEntry } from "@/lib/types";
import { cn } from "cn";

export function HistoryList() {
  const entries = useSyncExternalStore(subscribeStore, getHistorySnapshot, () => null as HistoryEntry[] | null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!entries) {
    return <p className="pt-16 text-center text-muted-foreground">Opening your history…</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="pt-6">
        <h1 className="font-serif text-4xl tracking-tight">History</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Nothing drawn yet. When you swap a sheet, it will wait here, on this phone.
        </p>
        <Link href="/journal" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          Journal on this phone
        </Link>
        <Link href="/draw" className={cn(buttonVariants({ size: "touch" }), "mt-8 w-full")}>
          Draw from the pile
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <h1 className="font-serif text-4xl tracking-tight">History</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Past draws and any notes you left yourself. They stay on this device.
      </p>
      <Link href="/journal" className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
        Journal on this phone
      </Link>
      <ul className="mt-6 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link href={`/history/entry?id=${encodeURIComponent(entry.id)}`} className="pile-shadow block rounded-3xl border border-border bg-card px-4 py-4">
              <p className="font-serif text-xl tracking-tight">
                {entry.sheet.displayName}, {entry.sheet.age}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{entry.sheet.place}</p>
              <p className="mt-2 text-sm">
                {decisionLabel(entry.decision)} · {formatWhen(entry.drawnAt)}
              </p>
              {filledGratitudes(entry.gratitudes).length > 0 ? (
                <p className="mt-2 line-clamp-2 font-serif text-base leading-relaxed italic">
                  {excerpt(filledGratitudes(entry.gratitudes).join(" · "), 140)}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        {confirmClear ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="text-sm leading-relaxed">Remove every draw and note from this phone?</p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1"
                onClick={() => {
                  saveHistory([]);
                  setConfirmClear(false);
                }}
              >
                Remove all
              </Button>
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setConfirmClear(true)}
          >
            Clear history on this phone
          </button>
        )}
      </div>
    </div>
  );
}
