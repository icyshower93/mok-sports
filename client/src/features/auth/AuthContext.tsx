import { createContext, useContext } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  oauthConfigured: boolean;
  oauthLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  oauthConfigured: false,
  oauthLoading: false,
  login: () => {},
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};