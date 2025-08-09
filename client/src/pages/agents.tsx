import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Star className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Free Agents</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Available teams for trading and the trade market will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}