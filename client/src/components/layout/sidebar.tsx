import { Home, Users, Zap, User, Trophy, Settings, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Users, label: "My Leagues", href: "/leagues" },
  { icon: Zap, label: "Draft Center", href: "/draft" },
  { icon: User, label: "Profile", href: "/profile" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 md:bg-white md:border-r md:border-gray-200 md:z-40">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-fantasy-green to-trust-blue rounded-lg mr-3">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-fantasy-green to-trust-blue bg-clip-text text-transparent">
          Mok Sports
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          
          return (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-fantasy-green to-fantasy-green/80 text-white shadow-lg" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}>
                <Icon className={cn(
                  "w-5 h-5 mr-3 transition-colors",
                  isActive && "text-white"
                )} />
                <span className="font-medium">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}