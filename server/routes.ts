import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { generateJWT, authenticateJWT, isOAuthConfigured } from "./auth";
import "./auth"; // Initialize passport strategies

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize passport
  app.use(passport.initialize());

  // Google OAuth routes - only if OAuth is configured
  if (isOAuthConfigured) {
    app.get("/api/auth/google", 
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { session: false }),
      (req, res) => {
        try {
          const user = req.user as any;
          if (!user) {
            return res.redirect("/?error=auth_failed");
          }

          const token = generateJWT(user);
          
          // Set JWT as httpOnly cookie and redirect
          res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          res.redirect("/?auth=success");
        } catch (error) {
          console.error("Auth callback error:", error);
          res.redirect("/?error=auth_failed");
        }
      }
    );
  } else {
    // Fallback routes when OAuth is not configured
    app.get("/api/auth/google", (req, res) => {
      res.status(503).json({ 
        error: "OAuth not configured", 
        message: "Google authentication is currently unavailable. Please contact the administrator." 
      });
    });

    app.get("/api/auth/google/callback", (req, res) => {
      res.redirect("/?error=oauth_not_configured");
    });
  }

  // Check OAuth configuration status
  app.get("/api/auth/config", (req, res) => {
    res.json({ 
      oauthConfigured: isOAuthConfigured,
      provider: "google" 
    });
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies?.auth_token;
    console.log("🍪 Auth check - Cookie present:", !!token);
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { verifyJWT } = require("./auth");
    const user = verifyJWT(token);
    
    if (!user) {
      console.log("❌ Auth check - Invalid token");
      return res.status(401).json({ message: "Invalid token" });
    }

    console.log("✅ Auth check - User authenticated:", user.email);
    res.json(user);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out successfully" });
  });

  // Protected route example
  app.get("/api/user/profile", authenticateJWT, (req, res) => {
    res.json(req.user);
  });

  const httpServer = createServer(app);
  return httpServer;
}
