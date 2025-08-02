import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Crown, Trophy, Calendar, Settings } from "lucide-react";

export default function LeaguesPage() {
  return (
    <MainLayout>
      <div className="py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Leagues</h1>
            <p className="text-gray-600 mt-1">Manage all your fantasy leagues in one place</p>
          </div>
        </div>

        {/* Coming Soon placeholder */}
        <Card className="fantasy-card">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-fantasy-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-fantasy-green" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Detailed League Management</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Advanced league management features are coming soon. For now, you can view and manage your leagues from the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}