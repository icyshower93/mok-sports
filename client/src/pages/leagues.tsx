import React, { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, UserPlus, Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LeaguesPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"join" | "create">("join");
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const joinLeagueMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest(`/api/leagues/join`, {
        method: "POST",
        body: { joinCode: code }
      });
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've joined the league successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
      navigate('/'); // This will now show the main app since user has leagues
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join league",
        variant: "destructive",
      });
    }
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest(`/api/leagues`, {
        method: "POST",
        body: { name }
      });
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "League created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
      navigate('/'); // This will now show the main app since user has leagues
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create league",
        variant: "destructive",
      });
    }
  });

  const handleJoinLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      joinLeagueMutation.mutate(joinCode.trim().toUpperCase());
    }
  };

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (leagueName.trim()) {
      createLeagueMutation.mutate(leagueName.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Welcome to Mok Sports</h1>
          <p className="text-muted-foreground">Join or create your first league to get started</p>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-1 p-1 bg-muted rounded-lg">
          <Button
            variant={activeTab === "join" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setActiveTab("join")}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Join League
          </Button>
          <Button
            variant={activeTab === "create" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setActiveTab("create")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create League
          </Button>
        </div>

        {/* Join League Form */}
        {activeTab === "join" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5" />
                <span>Join Existing League</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinLeague} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">League Code</Label>
                  <Input
                    id="joinCode"
                    placeholder="Enter 6-character code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    maxLength={6}
                    className="uppercase"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!joinCode.trim() || joinLeagueMutation.isPending}
                >
                  {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Create League Form */}
        {activeTab === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>Create New League</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateLeague} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leagueName">League Name</Label>
                  <Input
                    id="leagueName"
                    placeholder="Enter league name"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!leagueName.trim() || createLeagueMutation.isPending}
                >
                  {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>6 players • 5 teams each • Snake draft</p>
        </div>
      </div>
    </div>
  );
}