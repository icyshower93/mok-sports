import { useLocation } from "wouter";
import { 
  Home, 
  Shield, 
  Trophy, 
  Activity, 
  Star, 
  User,
  MoreHorizontal 
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
    path: "/main",
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === "/main" || pathname === "/"
  },
  {
    path: "/stable",
    label: "Stable",
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
    icon: MoreHorizontal
  }
];

export function BottomNav() {
  const [location, setLocation] = useLocation();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 border-t border-border">
      <div className="grid grid-cols-5 h-20 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.isActive ? item.isActive(location) : location === item.path;
          const IconComponent = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 text-xs font-medium transition-colors",
                "min-h-[60px] px-2", // Enhanced PWA touch target
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconComponent 
                className={cn(
                  "w-7 h-7 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
              <span className={cn(
                "text-[10px] leading-none transition-colors",
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