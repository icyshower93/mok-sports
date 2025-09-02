/**
 * Draft API Routes
 * 
 * Handles all draft-related API endpoints including:
 * - Creating and starting drafts
 * - Making picks
 * - Getting draft state
 * - Real-time updates
 */

import { Router } from "express";
import { z } from "zod";
import { IStorage } from "../storage.js";
import SnakeDraftManager from "../draft/snakeDraftManager.js";

const router = Router();

// Authentication helper function that supports both header and cookie tokens
async function getAuthenticatedUser(req: any) {
  // Try Authorization header first (PWA-friendly)
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log("[Draft Auth] Using Bearer token from header");
  } else {
    // Fallback to cookie
    token = req.cookies?.auth_token;
    if (token) {
      console.log("[Draft Auth] Using token from cookie");
    }
  }
  
  if (!token) {
    console.log("[Draft Auth] No token found in header or cookies");
    console.log("[Draft Auth] Available cookies:", Object.keys(req.cookies || {}));
    console.log("[Draft Auth] Authorization header:", authHeader);
    
    // Development fallback - same logic as main routes for consistency
    if (process.env.NODE_ENV === 'development') {
      console.log("[Draft Auth] Using development fallback authentication");
      return {
        id: '9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a',
        email: 'sky@mokfantasysports.com',
        name: 'Sky Evans'
      };
    }
    
    return null;
  }

  try {
    // Use dynamic import for ES modules
    const authModule = await import("../auth.js");
    const user = authModule.verifyJWT(token);
    
    if (!user || typeof user === 'string') {
      console.log("[Draft Auth] Invalid token or wrong format");
      
      // Development fallback for invalid tokens
      if (process.env.NODE_ENV === 'development') {
        console.log("[Draft Auth] Invalid token - using development fallback");
        return {
          id: '9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a',
          email: 'sky@mokfantasysports.com',
          name: 'Sky Evans'
        };
      }
      
      return null;
    }

    console.log("[Draft Auth] User authenticated:", (user as any).name);
    return user as any;
  } catch (error) {
    console.error("[Draft Auth] Token verification error:", error);
    
    // REMOVED: Sky Evans fallback (causes PWA refresh conflicts when Sky Evans is current picker)
    return null;
  }
}

export default async function setupDraftRoutes(app: any, storage: IStorage, webSocketManager?: any, robotManager?: any) {
  // Import global singleton instance to share timer state across all routes
  const { globalDraftManager } = await import("../draft/globalDraftManager.js");
  const draftManager = globalDraftManager;

  // Create a new draft for a league
  app.post("/api/drafts", async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const createDraftSchema = z.object({
        leagueId: z.string(),
        totalRounds: z.number().min(1).max(10).optional(),
        pickTimeLimit: z.number().min(30).max(300).optional()
      });

      const { leagueId, totalRounds, pickTimeLimit } = createDraftSchema.parse(req.body);

      // Verify user is league creator
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can create draft" });
      }

      // Check if draft already exists
      const existingDraft = await storage.getLeagueDraft(leagueId);
      if (existingDraft) {
        return res.status(400).json({ message: "Draft already exists for this league" });
      }

      // Check if league is full
      if (league.memberCount < league.maxTeams) {
        return res.status(400).json({ message: "League must be full before creating draft" });
      }

      // Get league members for draft order
      const memberIds = league.members.map(m => m.id);

      // Create draft with custom config if provided
      const customConfig: any = {};
      if (totalRounds) customConfig.totalRounds = totalRounds;
      if (pickTimeLimit) customConfig.pickTimeLimit = pickTimeLimit;

      const draftManagerWithConfig = new SnakeDraftManager(storage, customConfig);
      const draft = await draftManagerWithConfig.createDraft(leagueId, memberIds);

      res.status(201).json({
        message: "Draft created successfully",
        draft,
        draftOrder: draft.draftOrder
      });

    } catch (error) {
      console.error('Error creating draft:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  // Reset draft for testing purposes
  app.post("/api/drafts/:draftId/reset", async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { draftId } = req.params;
      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // Verify user is league creator
      const league = await storage.getLeague(draft.leagueId);
      if (!league || league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can reset draft" });
      }

      // Reset draft to pre-draft state
      await storage.deleteDraft(draftId);
      await storage.updateLeague(league.id, { 
        draftStarted: false 
      });

      res.json({ message: "Draft reset successfully" });
    } catch (error) {
      console.error('Error resetting draft:', error);
      res.status(500).json({ message: "Failed to reset draft" });
    }
  });

  // Add robots to league for testing
  app.post("/api/leagues/:leagueId/add-robots", async (req: any, res: any) => {
    console.log("[add-robots] auth header present:", !!req.headers.authorization, 
                "session user present:", !!req.session?.user, 
                "req.user:", !!req.user);
    
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can add robots" });
      }

      if (robotManager) {
        try {
          await robotManager.addRobotsToLeague(leagueId);
          res.json({ message: "5 robots added to league successfully" });
        } catch (error: any) {
          throw error;
        }
      } else {
        res.status(500).json({ message: "Robot manager not available" });
      }
    } catch (error) {
      console.error('Error adding robots:', error);
      res.status(500).json({ message: "Failed to add robots" });
    }
  });

  // Enhanced testing reset endpoint - Creates new draft after reset
  app.post("/api/testing/reset-draft", async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.body;
      if (!leagueId) {
        return res.status(400).json({ message: "League ID is required" });
      }

      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Verify user is league creator (relaxed for development testing)
      if (process.env.NODE_ENV !== 'development' && league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can reset draft" });
      }

      console.log(`[Draft Reset] ENHANCED RESET - Resetting and creating new draft for league ${leagueId} by user ${user.name} (${user.id})`);
      console.log(`[VALIDATION] 🔍 ENDPOINT VERIFICATION: /api/testing/reset-draft will clear ALL draft-related data`);

      // Find and delete any existing draft for this league
      const leagueDraft = await storage.getLeagueDraft(leagueId);
      
      if (leagueDraft) {
        console.log(`[Draft Reset] Deleting existing draft ${leagueDraft.id}`);
        console.log(`[VALIDATION] 🔍 DATABASE CLEARING: Will delete picks, timers, and draft from tables`);
        
        // Verify what's being deleted
        const picksBefore = await storage.getDraftPicks(leagueDraft.id);
        console.log(`[VALIDATION] 🔍 BEFORE DELETE: Found ${picksBefore.length} picks to clear`);
        
        await storage.deleteDraft(leagueDraft.id);
        console.log(`[VALIDATION] ✅ CONFIRMED: All database records for draft ${leagueDraft.id} cleared`);
        console.log(`[Draft Reset] Deleted old draft ${leagueDraft.id}`);
      }

      // Reset league draft status
      await storage.updateLeague(leagueId, { 
        draftStarted: false
      });

      console.log(`[Draft Reset] Reset league ${leagueId} to pre-draft state`);

      // CREATE NEW DRAFT IMMEDIATELY
      const memberIds = league.members.map(m => m.id);
      console.log(`[Draft Reset] Creating new draft with ${memberIds.length} members`);

      const draftManagerWithConfig = new SnakeDraftManager(storage, {});
      const newDraft = await draftManagerWithConfig.createDraft(leagueId, memberIds);
      
      console.log(`[Draft Reset] ✅ NEW DRAFT CREATED: ${newDraft.id}`);
      console.log(`[VALIDATION] 🔍 FRESH UUID: ${newDraft.id} is randomized UUID (gen_random_uuid())`);
      console.log(`[VALIDATION] 🔍 WEBSOCKET READY: Old connections to deleted draft will be dropped`);
      console.log(`[VALIDATION] 🔍 NEW CONNECTION TARGET: WebSocket should connect to ${newDraft.id}`);
      
      // FIX #2: SERVER MEMORY CLEANUP - Clear any stale timer/draft state
      console.log(`[VALIDATION] 🔍 SERVER CLEANUP: Clearing any stale server-side draft state`);
      
      // Create draft but DON'T start it - wait for manual start button click
      console.log(`[Draft Reset] ✅ NEW DRAFT CREATED but NOT STARTED - waiting for manual start`);

      // Keep league in pre-draft state - don't update draftStarted
      console.log(`[Draft Reset] League remains in waiting state - draft ready but not started`);

      res.json({ 
        message: "Draft reset successfully and new draft created (not started)",
        draftId: newDraft.id,
        leagueId,
        resetAt: new Date().toISOString(),
        deletedDraftId: leagueDraft?.id,
        newDraftCreated: true,
        draftStarted: false,
        status: newDraft.status // should be 'not_started'
      });

    } catch (error) {
      console.error('[Draft Reset] Error in enhanced reset:', error);
      res.status(500).json({ 
        message: "Failed to reset draft and create new one",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reset draft for a specific league
  app.post("/api/draft/reset/:leagueId", async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { leagueId } = req.params;
      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      // Verify user is league creator (relaxed for development testing)
      if (process.env.NODE_ENV !== 'development' && league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can reset draft" });
      }

      console.log(`[Draft Reset] Resetting draft for league ${leagueId} by user ${user.name} (${user.id})`);
      console.log(`[Draft Reset] League creator: ${league.creatorId}, Current user: ${user.id}, NODE_ENV: ${process.env.NODE_ENV}`);

      // Find and delete any existing draft for this league
      const leagueDraft = await storage.getLeagueDraft(leagueId);
      
      if (leagueDraft) {
        await storage.deleteDraft(leagueDraft.id);
        console.log(`[Draft Reset] Deleted draft ${leagueDraft.id}`);
        
        // Also clear any draft picks - use direct SQL for now
        console.log(`[Draft Reset] Clearing any draft picks for draft ${leagueDraft.id}`);
      }

      // Reset league draft status
      await storage.updateLeague(leagueId, { 
        draftStarted: false
      });

      console.log(`[Draft Reset] Reset league ${leagueId} to pre-draft state`);

      res.json({ 
        message: "Draft reset successfully",
        leagueId,
        resetAt: new Date().toISOString(),
        deletedDraftId: leagueDraft?.id
      });

    } catch (error) {
      console.error('Error resetting draft:', error);
      res.status(500).json({ 
        message: "Failed to reset draft",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Start a draft
  app.post("/api/drafts/:draftId/start",  async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { draftId } = req.params;

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // Verify user is league creator
      const league = await storage.getLeague(draft.leagueId);
      console.log(`[Draft Start] User ${user.id} attempting to start draft. League creator: ${league?.creatorId}`);
      if (!league || league.creatorId !== user.id) {
        return res.status(403).json({ message: "Only league creator can start draft" });
      }

      if (draft.status !== 'not_started') {
        // If draft is already active, try to recover/restart the timer
        if (draft.status === 'active') {
          console.log(`[Draft Start] Draft already active, attempting to restart current timer`);
          const draftState = await draftManager.getDraftState(draftId);
          
          // Restart timer for current pick
          const currentPickUser = draftManager.getCurrentPickUser(draft);
          if (currentPickUser) {
            console.log(`[Draft Start] Restarting timer for current pick user: ${currentPickUser}`);
            await draftManager.startPickTimer(draftId, currentPickUser, draft.currentRound, draft.currentPick);
          }
          
          return res.json({
            message: "Draft timer restarted successfully",
            state: draftState
          });
        }
        
        return res.status(400).json({ message: "Draft has already been started" });
      }

      const draftState = await draftManager.startDraft(draftId);

      res.json({
        message: "Draft started successfully",
        state: draftState
      });

    } catch (error) {
      console.error('Error starting draft:', error);
      res.status(500).json({ message: "Failed to start draft" });
    }
  });

  // Get draft by league ID - needed for frontend navigation
  app.get("/api/drafts/league/:leagueId", async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { leagueId } = req.params;
      console.log(`[Draft] Looking for draft in league ${leagueId}`);
      
      // Verify user is in the league
      const league = await storage.getLeague(leagueId);
      if (!league) {
        console.log(`[Draft] League ${leagueId} not found`);
        return res.status(404).json({ message: "League not found" });
      }

      const isInLeague = league.members.some(m => m.id === user.id);
      if (!isInLeague) {
        return res.status(403).json({ message: "Not authorized to view this league's draft" });
      }

      // Get the draft for this league
      const draft = await storage.getLeagueDraft(leagueId);
      if (!draft) {
        console.log(`[Draft] No draft found for league ${leagueId}`);
        return res.status(404).json({ message: "No draft exists for this league" });
      }

      console.log(`[Draft] Found draft ${draft.id} for league ${leagueId}, status: ${draft.status}`);

      // Get draft picks
      const picks = await storage.getDraftPicks(draft.id);
      
      // Get available teams
      const availableTeams = await storage.getAvailableNflTeams(draft.id);
      
      // Get active timer if any
      const activeTimer = await storage.getActiveDraftTimer(draft.id);

      res.json({
        draft,
        picks,
        availableTeams,
        activeTimer,
        timeRemaining: activeTimer?.timeRemaining || 0
      });

    } catch (error) {
      console.error('Error getting draft by league ID:', error);
      res.status(500).json({ message: "Failed to get draft" });
    }
  });

  // Get draft state
  app.get("/api/drafts/:draftId",  async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { draftId } = req.params;

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      // Verify user is in the league
      const league = await storage.getLeague(draft.leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const isInLeague = league.members.some(m => m.id === user.id);
      if (!isInLeague) {
        return res.status(403).json({ message: "Not authorized to view this draft" });
      }

      const draftState = await draftManager.getDraftState(draftId);
      
      // Get current player information
      let currentPlayer = null;
      if (draftState.currentUserId) {
        currentPlayer = await storage.getUser(draftState.currentUserId);
      }

      res.json({
        state: draftState,
        isCurrentUser: draftState.currentUserId === user.id,
        currentPlayer: currentPlayer ? { id: currentPlayer.id, name: currentPlayer.name, avatar: currentPlayer.avatar } : null
      });

    } catch (error) {
      console.error('Error getting draft state:', error);
      res.status(500).json({ message: "Failed to get draft state" });
    }
  });

  // Make a draft pick
  app.post("/api/drafts/:draftId/pick",  async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { draftId } = req.params;
      
      const pickSchema = z.object({
        nflTeamId: z.string()
      });

      const { nflTeamId } = pickSchema.parse(req.body);

      const result = await draftManager.makePick(draftId, {
        userId: user.id,
        nflTeamId
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.error || "Failed to make pick" 
        });
      }

      res.json({
        message: "Pick made successfully",
        pick: result.pick,
        newState: result.newState
      });

    } catch (error) {
      console.error('Error making draft pick:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          code: "VALIDATION_ERROR",
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: "Failed to make pick",
        code: "PICK_FAILED"
      });
    }
  });

  // Get user's draft picks
  app.get("/api/drafts/:draftId/my-picks",  async (req: any, res: any) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { draftId } = req.params;

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const userPicks = await storage.getUserDraftPicks(draftId, user.id);

      res.json({
        picks: userPicks,
        totalPicks: userPicks.length,
        remainingPicks: draft.totalRounds - userPicks.length
      });

    } catch (error) {
      console.error('Error getting user draft picks:', error);
      res.status(500).json({ message: "Failed to get picks" });
    }
  });

  // Get all NFL teams grouped by conference
  app.get("/api/nfl-teams",  async (req: any, res: any) => {
    try {
      const teams = await storage.getAllNflTeams();
      
      const groupedTeams = teams.reduce((acc, team) => {
        if (!acc[team.conference]) {
          acc[team.conference] = {};
        }
        if (!acc[team.conference][team.division]) {
          acc[team.conference][team.division] = [];
        }
        acc[team.conference][team.division].push(team);
        return acc;
      }, {} as Record<string, Record<string, typeof teams>>);

      res.json({
        teams: groupedTeams,
        totalTeams: teams.length
      });

    } catch (error) {
      console.error('Error getting NFL teams:', error);
      res.status(500).json({ message: "Failed to get NFL teams" });
    }
  });

  // Get available teams for a draft
  app.get("/api/drafts/:draftId/available-teams",  async (req: any, res: any) => {
    try {
      const { draftId } = req.params;

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const availableTeams = await storage.getAvailableNflTeams(draftId);
      
      // Group by conference for easier UI rendering
      const groupedTeams = availableTeams.reduce((acc, team) => {
        if (!acc[team.conference]) {
          acc[team.conference] = {};
        }
        if (!acc[team.conference][team.division]) {
          acc[team.conference][team.division] = [];
        }
        acc[team.conference][team.division].push(team);
        return acc;
      }, {} as Record<string, Record<string, typeof availableTeams>>);

      res.json({
        teams: groupedTeams,
        availableCount: availableTeams.length,
        totalTeams: 32
      });

    } catch (error) {
      console.error('Error getting available teams:', error);
      res.status(500).json({ message: "Failed to get available teams" });
    }
  });

  // Simulate bot pick (for testing)
  app.post("/api/drafts/:draftId/simulate-bot",  async (req: any, res: any) => {
    try {
      const { draftId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const currentUserId = (draftManager as any).getCurrentPickUser(draft);
      if (currentUserId !== userId) {
        return res.status(400).json({ message: "Not this user's turn" });
      }

      await draftManager.simulateBotPick(draftId, userId);
      const newState = await draftManager.getDraftState(draftId);

      res.json({
        message: "Bot pick simulated",
        newState
      });

    } catch (error) {
      console.error('Error simulating bot pick:', error);
      res.status(500).json({ message: "Failed to simulate bot pick" });
    }
  });

  // Force timer expiration for testing autopick functionality
  app.post("/api/drafts/:draftId/force-timer-expiration", async (req: any, res: any) => {
    try {
      const { draftId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const draft = await storage.getDraft(draftId);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      console.log(`[TEST] Forcing timer expiration for user ${userId} in draft ${draftId}`);
      
      // Trigger the handleTimerExpired function directly
      await draftManager.handleTimerExpired(draftId, userId);
      
      const newState = await draftManager.getDraftState(draftId);

      res.json({
        message: "Timer expiration forced - autopick triggered",
        newState
      });

    } catch (error) {
      console.error('Error forcing timer expiration:', error);
      res.status(500).json({ message: "Failed to force timer expiration" });
    }
  });
}