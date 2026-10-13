import type { Metadata } from "next";

import { SheetEditor } from "@/components/sheet-editor";

export const metadata: Metadata = {
  title: "Your sheet",
};

export default function SheetPage() {
  return <SheetEditor />;
}
