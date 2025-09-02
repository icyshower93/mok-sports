import { useLocation } from "wouter";
import { useEffect } from "react";

export default function NavigationTracer() {
  const [loc] = useLocation();
  useEffect(() => {
    console.debug("[Nav] location =>", loc);
  }, [loc]);
  return null;
}