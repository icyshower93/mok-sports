import { useState, useEffect } from "react";
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
import { useAuth } from "@/hooks/use-auth";

// Helper function to get news source icon
const getNewsSourceIcon = (source: string) => {
  const sourceLower = source.toLowerCase();
  
  if (sourceLower.includes('espn')) {
    return <Monitor className="w-4 h-4 text-red-600" />;
  } else if (sourceLower.includes('nfl') || sourceLower.includes('nfl.com')) {
    return <Shield className="w-4 h-4 text-blue-600" />;
  } else if (sourceLower.includes('twitter') || sourceLower.includes('x.com')) {
    return <FileText className="w-4 h-4 text-black dark:text-white" />;
  } else if (sourceLower.includes('cnn') || sourceLower.includes('fox') || sourceLower.includes('abc') || sourceLower.includes('nbc')) {
    return <Monitor className="w-4 h-4 text-blue-600" />;
  } else if (sourceLower.includes('times') || sourceLower.includes('post') || sourceLower.includes('news')) {
    return <Newspaper className="w-4 h-4 text-gray-700 dark:text-gray-300" />;
  } else if (sourceLower.includes('yahoo')) {
    return <Globe className="w-4 h-4 text-purple-600" />;
  } else {
    return <Bell className="w-4 h-4 text-blue-600" />;
  }
};

interface League {
  id: string;
  name: string;
}

export default function MainPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [showAllWeeklyRankings, setShowAllWeeklyRankings] = useState(false);

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

  // Use current week or fallback to week 1
  const currentWeek = (currentWeekData as any)?.currentWeek || 1;

  // Set first league as default selection
  useEffect(() => {
    if ((leagues as any[]).length > 0 && !selectedLeague) {
      setSelectedLeague((leagues as any[])[0].id);
    }
  }, [leagues, selectedLeague]);

  // Fetch league standings data (same as league tab)
  const { data: leagueData } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/standings`],
    enabled: !!selectedLeague && !!user,
  });

  // Fetch weekly rankings - fixed endpoint  
  const { data: weeklyRankingsData, isLoading: weeklyLoading } = useQuery({
    queryKey: [`/api/scoring/leagues/${selectedLeague}/week-scores/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Extract rankings and week-end results with proper fallbacks
  const weeklyRankings = Array.isArray((weeklyRankingsData as any)?.rankings) ? (weeklyRankingsData as any)?.rankings : [];
  const weekEndResults = (weeklyRankingsData as any)?.weekEndResults || null;

  // Fetch teams left to play for current week
  const { data: teamsLeftData } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/teams-left-to-play/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Fetch NFL news
  const { data: nflNewsData, isLoading: newsLoading } = useQuery({
    queryKey: ['/api/nfl-news'],
    queryFn: async () => {
      const response = await fetch('/api/nfl-news?fantasyNews=true&maxItems=5');
      if (!response.ok) {
        throw new Error('Failed to fetch NFL news');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });

  // Extract current user's data from league standings
  const currentUserStanding = (leagueData as any)?.standings?.find((member: any) => member.isCurrentUser);
  const userTotalPoints = currentUserStanding?.points || 0;
  const userRank = currentUserStanding?.rank || 0;
  const userSkinsWon = currentUserStanding?.skinsWon || 0;
  const leagueName = (leagueData as any)?.league?.name || 'My Season';
  const weeklyPrize = 30; // Static $30 per week as per Mok rules
  const teamsLeftToPlay = Array.isArray((teamsLeftData as any)?.teamsLeftToPlay) ? (teamsLeftData as any)?.teamsLeftToPlay : [];

  // Debug logging
  console.log('Main page debug:', {
    user: user?.name,
    leagues: (leagues as any[])?.length || 0,
    selectedLeague,
    currentWeek,
    leagueData: leagueData ? 'loaded' : 'null',
    currentUserStanding,
    userStats: {
      totalPoints: userTotalPoints,
      rank: userRank,
      skinsWon: userSkinsWon
    },
    weeklyRankings: weeklyRankings?.length || 0,
    teamsLeftToPlay: teamsLeftToPlay?.length || 0
  });

  if (!user) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
      <div>Loading...</div>
    </div>;
  }

  if (leaguesLoading) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
      <div className="w-6 h-6 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
    </div>;
  }

  if (!selectedLeague || !(leagues as any[])?.length) {
    return <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">No Leagues Found</h3>
          <p className="text-sm text-muted-foreground mb-4">Join a league to view your dashboard</p>
          <Button onClick={() => navigate('/league')} size="sm">
            Browse Leagues
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/10 pb-20">
      <div className="max-w-4xl mx-auto">
        
        {/* Standardized Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 h-16">
          <div className="flex items-center justify-between h-full px-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Welcome, {user.name.split(' ')[0]}!</h1>
              <p className="text-sm text-muted-foreground">Week {currentWeek} • 2024 Season</p>
            </div>
            <Avatar className="w-10 h-10 border-2 border-primary/20">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="px-4 space-y-6 pt-6">
          
          {/* Season Stats Card - Modern Professional Design */}
          <Card className="overflow-hidden bg-gradient-to-br from-card via-card/95 to-card/90 border-border/40 shadow-lg rounded-2xl">
            <CardContent className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{leagueName}</h2>
                  <p className="text-xs text-muted-foreground">Current standings</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
              </div>
              
              {/* Stats Layout - Asymmetric Design */}
              <div className="flex items-center justify-between">
                {/* Total Season Points - Hero Stat */}
                <div className="flex-1">
                  <div className="text-5xl font-black text-foreground leading-none mb-1">{userTotalPoints}</div>
                  <div className="text-sm font-medium text-muted-foreground">Season Points</div>
                </div>
                
                {/* Divider */}
                <div className="w-px h-16 bg-border/40 mx-4"></div>
                
                {/* Secondary Stats */}
                <div className="flex flex-col space-y-3">
                  {/* League Rank */}
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                      {userRank === 1 ? (
                        <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        {userRank === 1 ? '1st' : userRank === 2 ? '2nd' : userRank === 3 ? '3rd' : `${userRank}th`}
                      </div>
                      <div className="text-xs text-muted-foreground">League Rank</div>
                    </div>
                  </div>
                  
                  {/* Skins Won */}
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground">{userSkinsWon}</div>
                      <div className="text-xs text-muted-foreground">Skins Won</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Skins Ranking - Horizontal Scroll */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-bold">Weekly Skins Game</h3>
              </div>
              <div className="text-lg font-semibold text-primary">$30</div>
            </div>
            
            <div className="overflow-x-auto scrollbar-hide horizontal-scroll">
              <div className="flex space-x-3 pb-4 min-w-max">
                {Array.isArray(weeklyRankings) && weeklyRankings.length > 0 ? (
                  weeklyRankings.map((member: any, index: number) => (
                    <Card key={member.name} className="flex-shrink-0 w-32 bg-gradient-to-br from-card to-card/50 border-border/50 rounded-2xl">
                      <CardContent className="p-4 text-center">
                        <div className="relative mb-3">
                          <Avatar className="w-12 h-12 mx-auto border-2 border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                              {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {index === 0 && (
                            <Crown className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1 bg-background rounded-full p-0.5" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate">{member.name}</p>
                        <p className="text-lg font-bold text-primary">{member.weeklyPoints || 0}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="flex-shrink-0 w-full bg-muted/20 rounded-2xl">
                    <CardContent className="p-6 text-center">
                      <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Week {currentWeek} rankings coming soon</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* Games Today */}
          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg font-bold">Games Today</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mock games for today - replace with actual API data */}
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground py-6">
                  No games scheduled today
                </p>
              </div>
            </CardContent>
          </Card>

          {/* News Section */}
          <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg font-bold">NFL News</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  View All <ExternalLink className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {newsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="p-3 bg-muted/20 rounded-xl animate-pulse">
                      <div className="flex space-x-3">
                        <div className="w-12 h-12 bg-muted/40 rounded-lg flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-4 bg-muted/40 rounded w-3/4" />
                          <div className="h-3 bg-muted/30 rounded w-full" />
                          <div className="h-3 bg-muted/30 rounded w-1/2" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Weekly Skins Card First */}

                  
                  {/* Real NFL News */}
                  {(nflNewsData as any)?.articles?.slice(0, 3).map((article: any) => (
                    <Card key={article.id} className="p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          {getNewsSourceIcon(article.source || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground truncate">{article.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {article.description || article.summary || article.content || 'No description available'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(article.publishedAt).toLocaleDateString()} • {article.source}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {/* Fallback if no news */}
                  {!(nflNewsData as any)?.articles?.length && (
                    <Card className="p-3 bg-muted/20 rounded-xl">
                      <div className="flex space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-500/20 to-gray-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Bell className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground truncate">NFL News</h4>
                          <p className="text-xs text-muted-foreground mt-1">Latest news updates coming soon</p>
                          <p className="text-xs text-muted-foreground">Check back later</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}