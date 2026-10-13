"use client";

import { useSyncExternalStore } from "react";

import { PrivacyNote } from "@/components/privacy-note";
import { Button } from "@/components/ui/button";
import {
  acknowledgePrivacy,
  getProfileSnapshot,
  getUserSheetSnapshot,
  saveProfile,
  saveUserSheet,
  subscribeStore,
} from "@/lib/storage";
import { AGE_BANDS, type LocalProfile } from "@/lib/types";
import { cn } from "cn";

export function SettingsView() {
  const profile = useSyncExternalStore(subscribeStore, getProfileSnapshot, (): LocalProfile | null => null);

  if (!profile) {
    return <p className="pt-16 text-center text-muted-foreground">Opening what stays on this phone…</p>;
  }

  function setAge(id: string) {
    const current = getProfileSnapshot();
    const next = current.ageBand === id ? null : id;
    saveProfile({ ...current, ageBand: next });
    const sheet = getUserSheetSnapshot();
    if (sheet) saveUserSheet({ ...sheet, ageBand: next, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="pb-6">
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">On this phone</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Private</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        A name and an age band are enough for the practice. Both stay here.
      </p>

      <section className="pile-shadow mt-6 rounded-3xl border border-primary/20 bg-card px-4 py-4">
        <h2 className="font-serif text-2xl tracking-tight">Nothing leaves this device</h2>
        <div className="mt-3">
          <PrivacyNote />
        </div>
        {profile.privacyAcknowledgedAt ? (
          <p className="mt-4 text-sm text-muted-foreground">You already confirmed this on this phone.</p>
        ) : (
          <Button type="button" size="touch" className="mt-4 w-full" onClick={() => acknowledgePrivacy()}>
            I understand — keep it on this phone
          </Button>
        )}
      </section>

      <label htmlFor="profile-name" className="mt-8 block text-sm font-medium">
        Name
      </label>
      <p className="mt-1 text-sm text-muted-foreground">Optional. It is not sent with a draw.</p>
      <input
        id="profile-name"
        value={profile.name}
        maxLength={40}
        autoComplete="nickname"
        placeholder="Optional. Stays on this phone."
        onChange={(event) => saveProfile({ ...getProfileSnapshot(), name: event.target.value })}
        className="mt-2 h-12 w-full rounded-xl border border-input bg-card px-3.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">Age band</legend>
        <p className="mt-1 text-sm text-muted-foreground">Used only so your sheet can sit beside a drawn life. Optional.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => {
            const selected = profile.ageBand === band.id;
            return (
              <Button
                key={band.id}
                type="button"
                size="chip"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                className={cn(selected && "border-primary")}
                onClick={() => setAge(band.id)}
              >
                {band.label}
              </Button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
