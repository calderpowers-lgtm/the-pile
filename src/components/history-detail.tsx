"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { SheetCard } from "@/components/sheet-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { decisionLabel, formatWhen } from "@/lib/format";
import { filledGratitudes } from "@/lib/types";
import { getHistorySnapshot, removeHistory, subscribeStore } from "@/lib/storage";
import type { HistoryEntry } from "@/lib/types";
import { cn } from "cn";

export function HistoryDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const entries = useSyncExternalStore(subscribeStore, getHistorySnapshot, () => null as HistoryEntry[] | null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!entries) {
    return <p className="pt-16 text-center text-muted-foreground">Opening this sheet…</p>;
  }

  const entry = entries.find((item) => item.id === params.get("id")) ?? null;

  if (!entry) {
    return (
      <div className="pt-6">
        <h1 className="font-serif text-4xl tracking-tight">That sheet isn’t here</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">It may have been cleared from this phone.</p>
        <Link href="/history" className={cn(buttonVariants({ size: "touch" }), "mt-8 w-full")}>
          Back to history
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <p className="text-sm text-muted-foreground">
        {decisionLabel(entry.decision)} · {formatWhen(entry.drawnAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">From your history</h1>
      {entry.notice ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{entry.notice}</p> : null}
      <div className="mt-5">
        <SheetCard sheet={entry.sheet} />
      </div>
      {filledGratitudes(entry.gratitudes).length > 0 ? (
        <blockquote className="mt-4 rounded-3xl border border-border bg-card px-5 py-5">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Grateful for</p>
          <ol className="mt-2 space-y-2">
            {filledGratitudes(entry.gratitudes).map((line) => (
              <li key={line} className="font-serif text-lg leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        </blockquote>
      ) : null}
      {entry.decision === "pending" || (entry.decision === "took-back" && !entry.gratitudeResolved) ? (
        <Link href="/draw" className={cn(buttonVariants({ size: "touch" }), "mt-6 w-full")}>
          Continue this draw
        </Link>
      ) : null}
      <div className="mt-8">
        {confirmRemove ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-4">
            <p className="text-sm leading-relaxed">Remove this draw from this phone?</p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1"
                onClick={() => {
                  removeHistory(entry.id);
                  router.push("/history");
                }}
              >
                Remove
              </Button>
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from this phone
          </button>
        )}
      </div>
    </div>
  );
}
