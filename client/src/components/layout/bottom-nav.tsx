import { Home, Users, Zap, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Users, label: "Leagues", href: "/leagues" },
  { icon: Zap, label: "Draft", href: "/draft" },
  { icon: User, label: "Profile", href: "/profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-1 py-2 z-50 md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          
          return (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex flex-col items-center px-3 py-2 rounded-lg transition-colors",
                isActive 
                  ? "text-fantasy-green" 
                  : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className={cn(
                  "w-6 h-6 mb-1",
                  isActive && "text-fantasy-green"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  isActive && "text-fantasy-green"
                )}>
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}