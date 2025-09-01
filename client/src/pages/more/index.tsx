import { startTransition } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/features/auth/useAuth";
import { Shield, LogOut, Settings, User, TrendingUp, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MoreRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

const MoreRow = ({ icon: Icon, label, description, onClick, disabled = false }: MoreRowProps) => (
  <button
    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
      disabled 
        ? "opacity-50 cursor-not-allowed" 
        : "hover:bg-muted active:bg-muted/80"
    }`}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    data-testid={`button-${label.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <div className="flex-shrink-0">
      <Icon className="w-5 h-5 opacity-80" />
    </div>
    <div className="flex-1 text-left">
      <div className="text-sm font-medium">{label}</div>
      {description && (
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      )}
    </div>
  </button>
);

export default function MoreHub() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();

  // Determine admin access based on environment  
  const isAdmin = import.meta.env.DEV || 
                  window.location.hostname.includes('replit') ||
                  window.location.hostname === 'localhost';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Account & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <MoreRow
            icon={User}
            label="Profile"
            description="View and edit your profile"
            onClick={() => startTransition(() => navigate("/profile"))}
          />
          <MoreRow
            icon={Settings}
            label="Settings"
            description="App preferences and notifications"
            onClick={() => startTransition(() => navigate("/settings"))}
            disabled
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">League Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <MoreRow
            icon={TrendingUp}
            label="Trades Center"
            description="Manage team trades and free agents"
            onClick={() => startTransition(() => navigate("/more/trades"))}
          />
          {isAdmin && (
            <MoreRow
              icon={Shield}
              label="Admin Panel"
              description="League administration and scoring"
              onClick={() => startTransition(() => navigate("/admin"))}
            />
          )}
          {isAdmin && (
            <MoreRow
              icon={Database}
              label="Database Viewer"
              description="View database tables and data"
              onClick={() => startTransition(() => navigate("/database"))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <MoreRow
            icon={LogOut}
            label="Log out"
            description="Sign out of your account"
            onClick={() => {
              startTransition(() => {
                logout();
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}