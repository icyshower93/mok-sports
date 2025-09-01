import { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full px-3 sm:px-4
                       max-w-[420px] sm:max-w-[560px] md:max-w-[680px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}