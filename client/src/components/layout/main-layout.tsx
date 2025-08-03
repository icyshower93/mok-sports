import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const { user, logout } = useAuth();

  // Prevent swipe navigation
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      
      const diffX = Math.abs(currentX - startX);
      const diffY = Math.abs(currentY - startY);

      // If horizontal swipe is greater than vertical and starts from screen edge
      if (diffX > diffY && (startX < 50 || startX > window.innerWidth - 50)) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      startX = 0;
      startY = 0;
    };

    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  if (!user) {
    return <div className={className}>{children}</div>;
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div 
      className="min-h-screen bg-surface-bg"
      style={{
        touchAction: 'pan-y',
        overscrollBehaviorX: 'none',
        overflowX: 'hidden'
      }}
    >
      {/* Top header with logo and logout */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-fantasy-green to-trust-blue rounded-lg mr-3">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-fantasy-green to-trust-blue bg-clip-text text-transparent">
              Mok Sports
            </h1>
          </div>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main 
        className={cn("px-4 py-6", className)}
        style={{
          touchAction: 'pan-y',
          overscrollBehaviorX: 'none'
        }}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}