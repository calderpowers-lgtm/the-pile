import Link from "next/link";

import { publicPath } from "@/lib/base-path";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={publicPath("/brand/mark.png")} alt="" className="size-8 object-contain" />
        <span className="font-display text-[1.35rem] leading-none tracking-tight">The Pile</span>
      </Link>
      <Link href="/settings" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground">
        Private
      </Link>
    </header>
  );
}
