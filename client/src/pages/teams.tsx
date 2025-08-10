import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Wrench } from "lucide-react";

export default function StablePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Stable</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wrench className="w-5 h-5" />
              <span>Coming Soon</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Stable page is currently under development. This will be where you can view and manage your 5 NFL teams, track performance stats, and handle free agent trades.
            </p>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}