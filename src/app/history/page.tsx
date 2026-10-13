import type { Metadata } from "next";

import { HistoryList } from "@/components/history-list";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return <HistoryList />;
}
