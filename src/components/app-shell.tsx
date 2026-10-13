import { BottomNav } from "@/components/bottom-nav";
import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <Header />
      <main id="content" className="flex-1 px-5 pt-2 pb-32">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
