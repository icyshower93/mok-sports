import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { generateJWT, authenticateJWT, isOAuthConfigured } from "./auth";
import { storage } from "./storage";
import { generateJoinCode } from "./utils";
import { insertLeagueSchema } from "@shared/schema";
import { z } from "zod";
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

  // League routes
  app.post("/api/leagues", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Validate request body
      const createLeagueSchema = insertLeagueSchema.extend({
        name: z.string().min(1, "League name is required").max(50, "League name too long"),
        maxTeams: z.number().min(2, "Must have at least 2 teams").max(20, "Maximum 20 teams allowed"),
      });

      const validatedData = createLeagueSchema.parse(req.body);
      
      // Generate unique join code
      let joinCode: string;
      let isUnique = false;
      let attempts = 0;
      
      do {
        joinCode = generateJoinCode();
        const existing = await storage.getLeagueByJoinCode(joinCode);
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < 10);

      if (!isUnique) {
        return res.status(500).json({ message: "Failed to generate unique join code" });
      }

      const league = await storage.createLeague({
        ...validatedData,
        creatorId: user.id,
        joinCode: joinCode!,
      });

      res.status(201).json(league);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Create league error:", error);
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  app.get("/api/leagues/user", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const leagues = await storage.getUserLeagues(user.id);
      res.json(leagues);
    } catch (error) {
      console.error("Get user leagues error:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  app.post("/api/leagues/join", async (req, res) => {
    try {
      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { verifyJWT } = require("./auth");
      const user = verifyJWT(token);
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const { joinCode } = req.body;
      if (!joinCode) {
        return res.status(400).json({ message: "Join code is required" });
      }

      // Find league by join code
      const league = await storage.getLeagueByJoinCode(joinCode.toUpperCase());
      if (!league) {
        return res.status(404).json({ message: "That code doesn't exist" });
      }

      // Check if user is already in league
      const isAlreadyMember = await storage.isUserInLeague(user.id, league.id);
      if (isAlreadyMember) {
        return res.status(400).json({ message: "You're already in this league" });
      }

      // Check if league is full
      const memberCount = await storage.getLeagueMemberCount(league.id);
      if (memberCount >= league.maxTeams) {
        return res.status(400).json({ message: "League is full" });
      }

      // Add user to league
      await storage.joinLeague({
        leagueId: league.id,
        userId: user.id,
      });

      res.json({ message: "Successfully joined league", league });
    } catch (error) {
      console.error("Join league error:", error);
      res.status(500).json({ message: "Failed to join league" });
    }
  });

  // NFL Teams routes
  app.get("/api/nfl-teams", async (req, res) => {
    try {
      // Direct SQL query using execute_sql_tool functionality
      const teams = await storage.getAllNflTeams();
      
      // Add logo URLs to each team
      const teamsWithLogos = teams.map((team: any) => ({
        ...team,
        logoSmall: `https://www.fantasynerds.com/images/nfl/teams/${team.code}.gif`,
        logoLarge: `https://www.fantasynerds.com/images/nfl/team_logos/${team.code}.png`
      }));
      
      res.json(teamsWithLogos);
    } catch (error) {
      console.error("Get NFL teams error:", error);
      res.status(500).json({ message: "Failed to fetch NFL teams" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
