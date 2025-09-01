// pages/main.tsx (TEMP) - Bisecting imports: Group 1 (React + UI)
import { useState, useEffect, startTransition } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Main() { 
  return <div>main probe - group 1 (React + UI)</div>; 
}