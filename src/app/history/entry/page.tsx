import type { Metadata } from "next";
import { Suspense } from "react";

import { HistoryDetail } from "@/components/history-detail";

export const metadata: Metadata = {
  title: "A sheet",
};

export default function HistoryEntryPage() {
  return (
    <Suspense fallback={<p className="pt-16 text-center text-muted-foreground">Opening this sheet…</p>}>
      <HistoryDetail />
    </Suspense>
  );
}
