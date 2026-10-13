import type { Metadata } from "next";

import { DrawFlow } from "@/components/draw-flow";

export const metadata: Metadata = {
  title: "Draw",
};

export default function DrawPage() {
  return <DrawFlow />;
}
