// pages/main.tsx (TEMP) - Bisecting imports: Group 2 (Icons)
import { useState, useEffect, startTransition } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

import { 
  Shield, 
  TrendingUp, 
  Clock, 
  Trophy, 
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Crown,
  Users,
  Zap,
  Target,
  Star,
  Flame,
  Gift,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  DollarSign,
  Bell,
  User,
  ExternalLink,
  ChevronLeft,
  Play,
  Globe,
  FileText,
  Monitor,
  Newspaper
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TeamLogo } from "@/components/team-logo";
import mokSportsLogoWhite from "@assets/MokSports_White_1755068930869.png";
import mokSportsLogo from "@assets/moksports logo_1755069436420.png";
import { useAuth } from "@/features/auth/useAuth";

// Group 6: Add query logic (likely TDZ source)
export default function Main() { 
  const { user } = useAuth();
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  
  // Fetch user's leagues
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  // Get current week from scoring API
  const { data: currentWeekData } = useQuery({
    queryKey: ['/api/scoring/current-week'],
    enabled: !!user,
  });

  // Set first league as default selection
  useEffect(() => {
    if ((leagues as any[]).length > 0 && !selectedLeague) {
      setSelectedLeague((leagues as any[])[0].id);
    }
  }, [leagues, selectedLeague]);
  
  if (!user || leaguesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">Welcome {user.name}</h1>
        <p>main probe - group 6 (+ query logic)</p>
        <p>Leagues: {leagues.length}, Selected: {selectedLeague}</p>
      </div>
      <BottomNav />
    </div>
  ); 
}