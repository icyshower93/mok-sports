import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Settings, HelpCircle, Info, LogOut, Users, TestTube } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function MorePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch user's leagues for testing navigation
  const { data: leagues = [] } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  const handleBackToLeague = () => {
    const userLeagues = leagues as any[];
    console.log('Back to League button clicked:', {
      leagues: userLeagues,
      leaguesLength: userLeagues?.length || 0
    });
    
    if (userLeagues && userLeagues.length > 0) {
      // Find the EEW2YU league specifically, or fall back to first league
      const eewLeague = userLeagues.find((league: any) => league.joinCode === 'EEW2YU');
      const targetLeague = eewLeague || userLeagues[0];
      const targetPath = `/league/waiting?id=${targetLeague.id}`;
      console.log('Navigating to:', targetPath, 'League:', targetLeague.joinCode);
      navigate(targetPath);
    } else {
      // If no leagues, go to leagues page
      console.log('No leagues found, going to leagues page');
      navigate('/leagues');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <MoreHorizontal className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">More</h1>
        </div>
        
        <div className="space-y-4">
          {/* Testing Section */}
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-orange-800 dark:text-orange-200 flex items-center space-x-2">
                <TestTube className="w-5 h-5" />
                <span>Testing Tools</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleBackToLeague}
              >
                <Users className="w-4 h-4 mr-3" />
                Back to League Waiting Room
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/admin')}
              >
                <Settings className="w-4 h-4 mr-3" />
                Admin Panel
              </Button>
              <p className="text-sm text-muted-foreground">
                Navigate back to league waiting room to start another draft and test team population. Use the Admin Panel to control time and simulate games.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Settings</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Help & Support</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Info className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">About Mok Sports</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <LogOut className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Sign Out</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}