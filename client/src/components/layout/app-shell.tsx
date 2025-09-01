import { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useHasLeague } from "@/features/leagues/useHasLeague";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { hasLeague } = useHasLeague();

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full px-3 sm:px-4
                       max-w-[420px] sm:max-w-[560px] md:max-w-[680px]">
        {children}
      </main>
      {hasLeague ? <BottomNav /> : null}
    </div>
  );
}