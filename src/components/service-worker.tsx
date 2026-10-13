"use client";

import { useEffect } from "react";

import { BASE_PATH } from "@/lib/base-path";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const base = BASE_PATH;
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      // Install remains optional. The app still works as a normal site.
    });
  }, []);

  return null;
}
