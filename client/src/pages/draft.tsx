import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Calendar, Users } from "lucide-react";

export default function DraftPage() {
  return (
    <MainLayout>
      <div className="py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Draft Center</h1>
            <p className="text-gray-600 mt-1">Participate in live drafts and manage your team</p>
          </div>
        </div>

        {/* Coming Soon placeholder */}
        <Card className="fantasy-card">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-fantasy-purple/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-fantasy-purple" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Live Draft Experience</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              The live draft feature is coming soon! You'll be able to draft teams in real-time with your league members.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}