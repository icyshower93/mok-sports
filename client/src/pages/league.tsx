import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function LeaguePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">League</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              League standings, activity feed, and member profiles will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}