import { useLocation } from "wouter";
import { startTransition } from "react";
import { 
  Home, 
  Shield, 
  Trophy, 
  Activity, 
  Star, 
  User,
  MoreHorizontal,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    path: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === "/" || pathname === "/main"
  },
  {
    path: "/teams",
    label: "Teams",
    icon: Shield
  },
  {
    path: "/league", 
    label: "League",
    icon: Trophy
  },
  {
    path: "/scores",
    label: "Scores",
    icon: Activity
  },
  {
    path: "/more",
    label: "More",
    icon: Menu,
    isActive: (pathname) => pathname.startsWith("/more")
  }
];

export function BottomNav() {
  const [location, setLocation] = useLocation();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/95 border-t border-border">
      <div className="grid grid-cols-5 h-20 max-w-[420px] sm:max-w-[560px] md:max-w-[680px] mx-auto px-2">
        {navItems.map((item) => {
          const isActive = item.isActive ? item.isActive(location) : location === item.path;
          const IconComponent = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => startTransition(() => setLocation(item.path))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                "min-h-[60px] px-1 py-2", // Enhanced PWA touch target with better padding
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconComponent 
                className={cn(
                  "w-6 h-6 transition-colors flex-shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
              <span className={cn(
                "text-[10px] leading-tight transition-colors text-center max-w-full",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}