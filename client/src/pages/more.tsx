import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreHorizontal, Settings, HelpCircle, Info, LogOut } from "lucide-react";

export default function MorePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <MoreHorizontal className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">More</h1>
        </div>
        
        <div className="space-y-4">
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