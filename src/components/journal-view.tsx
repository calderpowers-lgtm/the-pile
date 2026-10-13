"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { excerpt, formatWhen } from "@/lib/format";
import { getJournalSnapshot, removeJournalEntry, subscribeStore } from "@/lib/storage";
import type { JournalEntry } from "@/lib/types";
import { cn } from "cn";

export function JournalView() {
  const entries = useSyncExternalStore(subscribeStore, getJournalSnapshot, () => null as JournalEntry[] | null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!entries) {
    return <p className="pt-16 text-center text-muted-foreground">Opening your journal…</p>;
  }

  return (
    <div className="pb-6">
      <h1 className="font-serif text-4xl tracking-tight">Journal</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Entries you chose to keep. They stay in this browser on this phone, and they are never uploaded.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
          Privacy
        </Link>
      </p>

      {entries.length === 0 ? (
        <div className="mt-8">
          <p className="text-base leading-relaxed text-muted-foreground">
            Nothing saved yet. After you write on your sheet, you can keep a copy here.
          </p>
          <Link href="/sheet" className={cn(buttonVariants({ size: "touch" }), "mt-6 w-full")}>
            How are you feeling today?
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="pile-shadow rounded-3xl border border-border bg-card px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {formatWhen(entry.savedAt)}
                {entry.mood !== null ? ` · Feeling ${entry.mood} of 10` : ""}
              </p>
              {entry.weighing ? <p className="mt-2 text-sm leading-relaxed">{entry.weighing}</p> : null}
              <details className="mt-2">
                <summary className="cursor-pointer font-serif text-lg leading-relaxed">{excerpt(entry.body, 140)}</summary>
                <p className="mt-3 font-serif text-lg leading-relaxed whitespace-pre-wrap">{entry.body}</p>
              </details>
              <div className="mt-3">
                {pendingId === entry.id ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 flex-1"
                      onClick={() => {
                        removeJournalEntry(entry.id);
                        setPendingId(null);
                      }}
                    >
                      Remove
                    </Button>
                    <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setPendingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setPendingId(entry.id)}
                  >
                    Remove this entry from this phone
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
