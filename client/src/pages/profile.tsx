import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Trophy, Calendar, LogOut } from "lucide-react";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <MainLayout>
      <div className="py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-600 mt-1">Manage your account and fantasy preferences</p>
          </div>
        </div>

        {/* User Profile Card */}
        <Card className="fantasy-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2 text-fantasy-green" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-6 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{user.name}</h2>
                <p className="text-gray-600 mb-2">{user.email}</p>
                <p className="text-sm text-gray-500">
                  Mok Sports member
                </p>
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-200">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats placeholder */}
        <Card className="fantasy-card">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-accent-gold" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Fantasy Stats & Achievements</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Your fantasy sports history and achievements will be displayed here once you start playing in leagues.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}