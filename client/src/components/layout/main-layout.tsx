import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const { user } = useAuth();

  if (!user) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar />
      <main className={cn("desktop-sidebar-spacing", className)}>
        <div className="mobile-container min-h-screen">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}