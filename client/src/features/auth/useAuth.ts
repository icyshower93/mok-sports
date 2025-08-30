import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import { markModule } from '@/lib/dup-guard';

markModule('features/auth/useAuth');

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}