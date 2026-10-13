import { cn } from "cn";

import { publicPath } from "@/lib/base-path";

export function PaperMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <span className={cn("relative block size-20", animated && "pile-lift", className)} aria-hidden="true">
      {/* Stones from the logo. The photographed cream is cleared so the mark sits on the page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={publicPath("/brand/mark.png")} alt="" className="size-full object-contain" />
    </span>
  );
}
