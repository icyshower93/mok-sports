import { useAuth } from "@/hooks/use-auth";
import { getFirstName } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Medal,
  Flame,
  TrendingUp,
  Users,
  Star,
  Zap,
  Plus,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const firstName = getFirstName(user.name);

  const handleLogout = async () => {
    await logout();
  };

  const stats = [
    {
      icon: Trophy,
      value: "3",
      label: "Active Leagues",
      bgColor: "bg-fantasy-green/10",
      iconColor: "text-fantasy-green",
      period: "THIS SEASON",
    },
    {
      icon: Medal,
      value: "#2",
      label: "Best Position",
      bgColor: "bg-trust-blue/10",
      iconColor: "text-trust-blue",
      period: "RANKING",
    },
    {
      icon: Flame,
      value: "5W",
      label: "Win Streak",
      bgColor: "bg-accent-gold/10",
      iconColor: "text-accent-gold",
      period: "STREAK",
    },
    {
      icon: TrendingUp,
      value: "1,247",
      label: "Total Points",
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      period: "POINTS",
    },
  ];

  const leagues = [
    {
      name: "Champions League",
      teams: 12,
      week: 8,
      position: "#2",
      icon: Users,
      gradient: "from-fantasy-green to-trust-blue",
    },
    {
      name: "Elite Fantasy",
      teams: 8,
      week: 8,
      position: "#1",
      icon: Star,
      gradient: "from-accent-gold to-orange-500",
    },
    {
      name: "Quick Draft Pro",
      teams: 16,
      week: 8,
      position: "#5",
      icon: Zap,
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  const activities = [
    {
      text: 'Team "Thunder" won this week',
      time: "2 hours ago",
      color: "bg-fantasy-green",
    },
    {
      text: "New message in Champions League",
      time: "5 hours ago",
      color: "bg-trust-blue",
    },
    {
      text: "Draft completed for Elite Fantasy",
      time: "1 day ago",
      color: "bg-accent-gold",
    },
  ];

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-fantasy-green rounded-lg">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-dark-gray">Mok Sports</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="w-4 h-4 text-muted-gray" />
              </Button>
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-dark-gray hidden sm:block">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-gray hover:text-error-red transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-dark-gray mb-2">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="text-muted-gray">Ready to dominate your leagues?</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 ${stat.bgColor} rounded-lg`}>
                      <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                    </div>
                    <span className="text-xs text-muted-gray font-medium">
                      {stat.period}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-dark-gray mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-gray">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Leagues */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-dark-gray">My Leagues</h3>
                  <Button variant="ghost" className="text-fantasy-green hover:text-fantasy-green/80">
                    View All
                  </Button>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {leagues.map((league, index) => {
                    const Icon = league.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 bg-gradient-to-br ${league.gradient} rounded-lg flex items-center justify-center`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium text-dark-gray">{league.name}</h4>
                            <p className="text-sm text-muted-gray">
                              {league.teams} teams • Week {league.week}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-dark-gray">
                            {league.position}
                          </div>
                          <div className="text-xs text-muted-gray">Position</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-dark-gray mb-4">
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <Button className="w-full bg-fantasy-green hover:bg-fantasy-green/90 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Join League
                  </Button>
                  <Button className="w-full bg-trust-blue hover:bg-trust-blue/90 text-white">
                    <Users className="w-4 h-4 mr-2" />
                    Create League
                  </Button>
                  <Button variant="secondary" className="w-full">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Stats
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-dark-gray mb-4">
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {activities.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 ${activity.color} rounded-full mt-2`} />
                      <div>
                        <p className="text-sm text-dark-gray">{activity.text}</p>
                        <p className="text-xs text-muted-gray">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
