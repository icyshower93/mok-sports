/**
 * Snake Draft Manager
 * 
 * Handles the core snake draft logic including:
 * - Draft order generation and snake pattern
 * - Turn management and auto-pick functionality
 * - Division validation rules (max 1 per division unless unavoidable)
 * - Real-time state management
 * - Bot user simulation
 */

import { IStorage } from "../storage.js";
import type { Draft, DraftPick, NflTeam, User } from "@shared/schema";
import { RedisStateManager } from "./redisStateManager.js";

export interface DraftState {
  draft: Draft;
  currentUserId: string | null;
  timeRemaining: number;
  picks: Array<DraftPick & { user: User; nflTeam: NflTeam }>;
  availableTeams: NflTeam[];
  isUserTurn: boolean;
  canMakePick: boolean;
}

export interface PickRequest {
  userId: string;
  nflTeamId: string;
  isAutoPick?: boolean;
}

export interface PickResult {
  success: boolean;
  pick?: DraftPick & { user: User; nflTeam: NflTeam };
  error?: string;
  newState?: DraftState;
}

export interface DraftConfig {
  totalRounds: number;
  pickTimeLimit: number; // seconds
  enableDivisionRule: boolean;
  maxTeamsPerDivision: number;
}

export class SnakeDraftManager {
  private storage: IStorage;
  private timerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private draftConfig: DraftConfig;
  private redisStateManager: RedisStateManager;
  private webSocketManager?: any; // Will be injected
  private robotManager?: any; // Will be injected for robot handling

  constructor(storage: IStorage, config?: Partial<DraftConfig>, webSocketManager?: any, robotManager?: any) {
    this.storage = storage;
    this.webSocketManager = webSocketManager;
    this.robotManager = robotManager;
    this.redisStateManager = new RedisStateManager();
    this.draftConfig = {
      totalRounds: 5,
      pickTimeLimit: 60,
      enableDivisionRule: true,
      maxTeamsPerDivision: 1, // No more than 1 team from same division unless unavoidable
      ...config
    };
  }

  /**
   * Recover active timers after server restart
   */
  async recoverActiveTimers(): Promise<void> {
    console.log('🔄 Recovering active timers after restart...');
    
    try {
      const activeDrafts = await this.redisStateManager.getActiveDrafts();
      let recoveredCount = 0;
      
      // CRITICAL FIX: Also check database directly for active drafts with timers
      const dbActiveDrafts = await this.storage.getActiveTimers();
      const allDraftIds = new Set([...activeDrafts, ...dbActiveDrafts.map(t => t.draftId)]);
      
      console.log(`🔍 Found ${activeDrafts.length} drafts in Redis, ${dbActiveDrafts.length} active timers in DB`);
      console.log(`🔍 Processing ${allDraftIds.size} total drafts: [${Array.from(allDraftIds).join(', ')}]`);
      
      for (const draftId of Array.from(allDraftIds)) {
        const draft = await this.storage.getDraft(draftId);
        if (!draft || draft.status !== 'active') {
          // Clean up stale draft
          await this.redisStateManager.deleteDraftState(draftId);
          await this.redisStateManager.deleteTimer(draftId);
          continue;
        }
        
        const redisTimer = await this.redisStateManager.getTimer(draftId);
        if (redisTimer) {
          const timeRemaining = await this.redisStateManager.getTimeRemaining(draftId);
          
          if (timeRemaining > 0) {
            // Restart the timer for remaining time
            await this.restartPickTimer(draftId, redisTimer.userId, timeRemaining);
            recoveredCount++;
            console.log(`✅ Recovered timer for draft ${draftId}, user ${redisTimer.userId} with ${timeRemaining}s remaining`);
          } else {
            // Timer expired during downtime, handle auto-pick
            console.log(`⏰ Timer expired during downtime for draft ${draftId}, user ${redisTimer.userId}`);
            await this.handleTimerExpired(draftId, redisTimer.userId);
          }
        } else {
          // PERMANENT FIX: No timer found but draft is active - check if we need to start one
          console.log(`🔍 No timer found for active draft ${draftId}, checking if timer needed...`);
          
          // Check if draft is completed (simple check: all picks made)
          const totalPicks = draft.totalRounds * draft.draftOrder.length;
          const existingPicks = await this.storage.getDraftPicks(draftId);
          const isDraftComplete = existingPicks.length >= totalPicks;
          
          if (!isDraftComplete) {
            const currentUser = this.getCurrentPickUser(draft);
            if (currentUser) {
              console.log(`🚀 Starting missing timer for draft ${draftId}, user ${currentUser}`);
              await this.startPickTimer(draftId, currentUser, draft.currentRound, draft.currentPick);
              recoveredCount++;
            } else {
              console.log(`❌ Could not determine current pick user for draft ${draftId}`);
            }
          } else {
            console.log(`✅ Draft ${draftId} is completed, no timer needed`);
          }
        }
      }
      
      console.log(`✅ Recovered ${recoveredCount} active timers`);
    } catch (error) {
      console.error('❌ Failed to recover timers:', error);
    }
  }

  /**
   * Restart a timer with specific remaining time
   */
  private async restartPickTimer(draftId: string, userId: string, timeRemaining: number): Promise<void> {
    const timerKey = `${draftId}-${userId}`;
    
    // Clear any existing timer
    const existingInterval = this.timerIntervals.get(timerKey);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    console.log(`🔄 Restarting timer for user ${userId} in draft ${draftId} with ${timeRemaining}s remaining`);
    
    const interval = setInterval(async () => {
      const currentTimeRemaining = await this.redisStateManager.getTimeRemaining(draftId);
      
      if (currentTimeRemaining <= 0) {
        console.log(`⏰ Recovered timer expired for user ${userId} - triggering autopick`);
        clearInterval(interval);
        this.timerIntervals.delete(timerKey);
        await this.redisStateManager.deleteTimer(draftId);
        
        // CRITICAL FIX: Ensure timer expiration properly triggers robot autopick
        await this.handleTimerExpired(draftId, userId);
      } else {
        // Broadcast timer update
        if (this.webSocketManager) {
          this.webSocketManager.broadcastTimerUpdate(draftId, currentTimeRemaining);
        }
        
        // Update database timer
        try {
          await this.storage.updateDraftTimer(draftId, userId, currentTimeRemaining);
        } catch (error) {
          console.error(`Failed to update recovered timer: ${error}`);
        }
      }
    }, 1000);
    
    this.timerIntervals.set(timerKey, interval);
  }

  // Removed broken timer recovery methods - focusing on core timer fix

  /**
   * Creates a new draft for a league with randomized snake order
   */
  async createDraft(leagueId: string, memberIds: string[]): Promise<Draft> {
    // Shuffle the member IDs to create random draft order
    const shuffledOrder = this.shuffleArray([...memberIds]);
    
    const draftData = {
      leagueId,
      totalRounds: this.draftConfig.totalRounds,
      pickTimeLimit: this.draftConfig.pickTimeLimit,
      draftOrder: shuffledOrder,
      status: 'not_started' as const // Explicitly set initial status
    };

    return await this.storage.createDraft(draftData);
  }

  /**
   * Starts the draft with a 10-second preparation countdown
   */
  async startDraft(draftId: string): Promise<DraftState> {
    // First set draft to starting phase
    await this.storage.setDraftStatus(draftId, 'starting');
    const draft = await this.storage.getDraft(draftId);
    
    if (!draft) {
      throw new Error('Draft not found');
    }

    console.log(`🚀 [Draft Start] Starting 10-second countdown for draft ${draftId}`);

    // Set 10-second preparation countdown
    await this.redisStateManager.setTimer(draftId, 'preparation', 10);
    
    // Set timeout to transition to active draft after countdown
    setTimeout(async () => {
      try {
        console.log(`✅ [Draft Start] Countdown complete, activating draft ${draftId}`);
        await this.storage.startDraft(draftId); // This sets status to 'active'
        
        // Start timer for first pick
        await this.startPickTimer(draftId, draft.draftOrder[0], 1, 1);
        
        // Broadcast the state change
        if (this.webSocketManager) {
          const newState = await this.getDraftState(draftId);
          this.webSocketManager.broadcastToRoom(draftId, {
            type: 'draft_started',
            state: newState
          });
        }
      } catch (error) {
        console.error(`❌ [Draft Start] Error activating draft ${draftId}:`, error);
      }
    }, 10000);
    
    return await this.getDraftState(draftId);
  }

  /**
   * Gets the current draft state for real-time updates
   * First checks Redis cache, falls back to database if needed
   */
  async getDraftState(draftId: string): Promise<DraftState> {
    // Always fetch fresh data from database to ensure accuracy
    const draft = await this.storage.getDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    console.log(`🔍 [DraftState] Fresh database fetch - Round ${draft.currentRound}, Pick ${draft.currentPick}, Status: ${draft.status}`);

    // Get timer data for active drafts and starting countdown
    let timeRemaining = 0;
    if (draft.status === 'active' || draft.status === 'starting') {
      timeRemaining = await this.redisStateManager.getTimeRemaining(draftId);
      console.log(`[DEBUG] ${draft.status === 'starting' ? 'Starting countdown' : 'Active draft timer'} lookup for draft ${draftId}: ${timeRemaining}s remaining`);
    } else {
      console.log(`[DEBUG] Draft ${draftId} is ${draft.status}, skipping timer lookup`);
    }

    const picks = await this.storage.getDraftPicks(draftId);
    const availableTeams = await this.storage.getAvailableNflTeams(draftId);
    
    // Only get current user for active drafts
    const currentUserId = draft.status === 'active' ? this.getCurrentPickUser(draft) : null;

    const state: DraftState = {
      draft,
      currentUserId,
      timeRemaining,
      picks,
      availableTeams,
      isUserTurn: draft.status === 'active' && !!currentUserId,
      canMakePick: draft.status === 'active' && !!currentUserId
    };

    console.log(`🔍 [DraftState] Returning state - Round ${state.draft.currentRound}, Pick ${state.draft.currentPick}, Timer: ${state.timeRemaining}s, Picks: ${state.picks.length}, Status: ${state.draft.status}`);

    // Cache the fresh state in Redis for future requests
    await this.redisStateManager.setDraftState(draftId, state);
    
    return state;
  }

  /**
   * Makes a draft pick for a user
   */
  async makePick(draftId: string, pickRequest: PickRequest): Promise<PickResult> {
    try {
      const draft = await this.storage.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      if (draft.status !== 'active') {
        return { success: false, error: 'Draft is not active' };
      }

      const currentUserId = this.getCurrentPickUser(draft);
      if (!currentUserId || currentUserId !== pickRequest.userId) {
        return { success: false, error: 'Not your turn to pick' };
      }

      // Validate team is available
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      const selectedTeam = availableTeams.find(team => team.id === pickRequest.nflTeamId);
      
      if (!selectedTeam) {
        return { success: false, error: 'Team is not available' };
      }

      // Check division rule if enabled
      if (this.draftConfig.enableDivisionRule) {
        const divisionViolation = await this.checkDivisionRule(
          draftId,
          pickRequest.userId,
          selectedTeam
        );
        
        if (divisionViolation.isViolation && !divisionViolation.allowOverride) {
          return { 
            success: false, 
            error: `Division rule violation: ${divisionViolation.message}` 
          };
        }
      }

      // Create the pick
      const pickData = {
        draftId,
        userId: pickRequest.userId,
        nflTeamId: pickRequest.nflTeamId,
        round: draft.currentRound,
        pickNumber: draft.currentPick,
        isAutoPick: pickRequest.isAutoPick || false
      };

      const newPick = await this.storage.createDraftPick(pickData);

      // Stop current timer
      await this.stopPickTimer(draftId, pickRequest.userId);

      // Move to next pick
      const nextState = await this.advanceDraft(draftId);

      // Get the pick with user and team data
      const picks = await this.storage.getDraftPicks(draftId);
      const pickWithData = picks.find(p => p.id === newPick.id);

      // Broadcast pick to all connected users via WebSocket
      if (this.webSocketManager) {
        if (pickRequest.isAutoPick) {
          this.webSocketManager.broadcastAutoPick(draftId, pickWithData, nextState);
        } else {
          this.webSocketManager.broadcastPickMade(draftId, pickWithData, nextState);
        }
      }

      // Update Redis cache
      await this.redisStateManager.setDraftState(draftId, nextState);

      return {
        success: true,
        pick: pickWithData,
        newState: nextState
      };

    } catch (error) {
      console.error('Error making draft pick:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Handles auto-pick when timer expires
   */
  async handleTimerExpired(draftId: string, userId: string): Promise<void> {
    console.log(`⏰ Timer expired for user ${userId} in draft ${draftId}`);
    
    try {
      // First, deactivate the timer to prevent double processing
      await this.storage.deactivateTimer(draftId, userId);
      
      // Verify this user should actually be picking
      const draft = await this.storage.getDraft(draftId);
      if (!draft) {
        console.error('Draft not found during timer expiration');
        return;
      }
      
      const currentPickUser = this.getCurrentPickUser(draft);
      if (currentPickUser !== userId) {
        console.error(`Timer mismatch: expected ${userId} but current pick user is ${currentPickUser}`);
        console.error(`Draft state: Round ${draft.currentRound}, Pick ${draft.currentPick}`);
        return;
      }
      
      // ENHANCED AUTOPICK: Handle both robot and human users when timer expires
      if (this.robotManager?.isRobot(userId)) {
        console.log(`🤖 Timer expired for robot user ${userId} - using intelligent robot autopick`);
        await this.simulateBotPickPrivate(draftId, userId);
        return;
      }
      
      // Handle human user autopick - they should also get autopicked when stuck at 0:00
      console.log(`👤 Timer expired for human user ${userId} - triggering automatic pick`);
      
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      if (availableTeams.length === 0) {
        console.error('No available teams for auto-pick');
        return;
      }

      // Get user's current picks to check division rule
      let eligibleTeams = availableTeams;
      
      if (this.draftConfig.enableDivisionRule) {
        eligibleTeams = await this.getDivisionEligibleTeams(draftId, userId, availableTeams);
      }

      // If no eligible teams due to division rule, pick from any available
      if (eligibleTeams.length === 0) {
        eligibleTeams = availableTeams;
        console.log(`⚠️ Division rule forced override for user ${userId}`);
      }

      // Random selection for auto-pick
      const randomTeam = eligibleTeams[Math.floor(Math.random() * eligibleTeams.length)];
      
      // Use makePick which already handles advancement - remove duplicate advanceDraft call
      console.log(`🚀 Making auto-pick for ${userId}: ${randomTeam.name}`);
      const autoPickResult = await this.makePick(draftId, {
        userId,
        nflTeamId: randomTeam.id,
        isAutoPick: true
      });

      if (autoPickResult.success) {
        console.log(`✅ Auto-picked ${randomTeam.name} for user ${userId} - draft advanced`);
        
        // SMOOTH TRANSITION: Immediately broadcast the new timer state after auto-pick
        const updatedDraft = await this.storage.getDraft(draftId);
        if (updatedDraft && updatedDraft.status === 'active') {
          const currentTimer = await this.redisStateManager.getTimer(draftId);
          const timeRemaining = currentTimer?.duration || this.draftConfig.pickTimeLimit;
          
          console.log(`🕐 Broadcasting immediate timer update: ${timeRemaining}s for next user`);
          this.webSocketManager.broadcastTimerUpdate(draftId, timeRemaining);
        }
      } else {
        console.error(`Failed to auto-pick for user ${userId}:`, autoPickResult.error);
      }
      
    } catch (error) {
      console.error(`❌ Error handling timer expiration for user ${userId}:`, error);
      
      // Try to at least deactivate the timer
      try {
        await this.storage.deactivateTimer(draftId, userId);
      } catch (deactivateError) {
        console.error(`Failed to deactivate timer: ${deactivateError}`);
      }
    }
  }

  /**
   * Resets the current pick timer for a user
   */
  async resetPickTimer(draftId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const draft = await this.storage.getDraft(draftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      if (draft.status !== 'active') {
        return { success: false, error: 'Draft is not active' };
      }

      // Check if it's the user's turn
      const currentUser = this.getCurrentPickUser(draft);
      if (currentUser !== userId) {
        return { success: false, error: 'Not your turn to pick' };
      }

      // Stop current timer
      await this.stopPickTimer(draftId, userId);

      // Start new timer with full time
      await this.startPickTimer(draftId, userId, draft.currentRound, draft.currentPick);

      console.log(`🔄 Timer reset for user ${userId} in draft ${draftId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error resetting timer:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Simulates bot picks for testing (public method)
   */
  async simulateBotPick(draftId: string, userId: string): Promise<void> {
    // Wait a short random time to simulate thinking
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    const availableTeams = await this.storage.getAvailableNflTeams(draftId);
    if (availableTeams.length === 0) return;

    let eligibleTeams = availableTeams;
    
    if (this.draftConfig.enableDivisionRule) {
      eligibleTeams = await this.getDivisionEligibleTeams(draftId, userId, availableTeams);
      if (eligibleTeams.length === 0) {
        eligibleTeams = availableTeams; // Override rule if necessary
      }
    }

    // Smart bot selection: prefer teams from different divisions
    const randomTeam = eligibleTeams[Math.floor(Math.random() * eligibleTeams.length)];
    
    await this.makePick(draftId, {
      userId,
      nflTeamId: randomTeam.id,
      isAutoPick: false // Bot picks are not auto-picks
    });

    console.log(`🤖 Bot picked ${randomTeam.name}`);
  }

  // Private helper methods

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getCurrentPickUser(draft: Draft): string | null {
    if (draft.status !== 'active') return null;
    
    const { currentRound, currentPick, draftOrder } = draft;
    const totalUsers = draftOrder.length;
    
    // Snake draft logic: alternate direction each round
    let userIndex: number;
    
    if (currentRound % 2 === 1) {
      // Odd rounds: 1 → N (forward)
      userIndex = (currentPick - 1) % totalUsers;
    } else {
      // Even rounds: N → 1 (reverse)
      userIndex = totalUsers - 1 - ((currentPick - 1) % totalUsers);
    }
    
    return draftOrder[userIndex] || null;
  }

  private async advanceDraft(draftId: string): Promise<DraftState> {
    const draft = await this.storage.getDraft(draftId);
    if (!draft) throw new Error('Draft not found');

    const totalUsers = draft.draftOrder.length;
    const totalPicks = totalUsers * draft.totalRounds;
    
    let nextRound = draft.currentRound;
    let nextPick = draft.currentPick + 1;
    
    console.log(`🔄 Advancing draft from Round ${draft.currentRound}, Pick ${draft.currentPick} to Pick ${nextPick}`);
    
    // Check if we need to advance to next round
    // Each round has exactly totalUsers picks  
    const currentRoundEndPick = draft.currentRound * totalUsers;
    
    if (nextPick > currentRoundEndPick) {
      nextRound++;
      console.log(`🔄 Advancing to Round ${nextRound}, Pick ${nextPick}`);
    }
    
    // Check if draft is complete (all rounds finished)
    if (nextRound > draft.totalRounds) {
      console.log(`🎉 Draft complete! All ${draft.totalRounds} rounds finished with ${totalPicks} total picks`);
      await this.storage.completeDraft(draftId);
      
      // Initialize stable teams from draft picks
      try {
        await this.storage.initializeStableFromDraft(draftId);
        console.log(`✅ Initialized stable teams from completed draft ${draftId}`);
      } catch (error) {
        console.error(`❌ Failed to initialize stable teams:`, error);
      }
      
      return await this.getDraftState(draftId);
    }
    
    // Update draft progress
    try {
      await this.storage.updateDraftProgress(draftId, nextRound, nextPick);
      console.log(`📊 Updated draft to Round ${nextRound}, Pick ${nextPick}`);
    } catch (error) {
      console.error(`❌ Failed to update draft progress in database:`, error);
      throw error;
    }
    
    // Start timer for next pick
    const nextUserId = this.getCurrentPickUser({
      ...draft,
      currentRound: nextRound,
      currentPick: nextPick
    });
    
    if (nextUserId) {
      // Add brief 1.5-second transition period for smooth UI flow
      console.log(`⏳ Starting 1.5-second transition before timer for user ${nextUserId}`);
      
      // Broadcast transition state immediately
      if (this.webSocketManager) {
        this.webSocketManager.broadcastDraftUpdate(draftId, await this.getDraftState(draftId));
      }
      
      setTimeout(async () => {
        // Verify draft state is still valid after transition
        const currentDraft = await this.storage.getDraft(draftId);
        if (!currentDraft || currentDraft.status !== 'active') {
          console.log(`⚠️ Draft state changed during transition, skipping timer start`);
          return;
        }
        
        // Double-check this user is still supposed to pick
        const currentPickUser = this.getCurrentPickUser(currentDraft);
        if (currentPickUser !== nextUserId) {
          console.log(`⚠️ Pick user changed during transition: expected ${nextUserId}, got ${currentPickUser}`);
          return;
        }
        
        console.log(`✅ Transition complete, starting timer for user ${nextUserId}`);
        await this.startPickTimer(draftId, nextUserId, nextRound, nextPick);
        
        // If next user is a robot, trigger auto-pick after delay
        if (this.robotManager?.isRobot(nextUserId)) {
          const delay = this.robotManager.simulateRobotPickDelay();
          setTimeout(() => {
            this.simulateBotPick(draftId, nextUserId);
          }, delay);
        }
      }, 1500); // 1.5-second smooth transition
    }
    
    return await this.getDraftState(draftId);
  }

  async startPickTimer(
    draftId: string, 
    userId: string, 
    round: number, 
    pickNumber: number
  ): Promise<void> {
    // Clear any existing timers for this draft
    const existingKeys = Array.from(this.timerIntervals.keys()).filter(key => key.startsWith(draftId));
    for (const existingKey of existingKeys) {
      clearInterval(this.timerIntervals.get(existingKey)!);
      this.timerIntervals.delete(existingKey);
      console.log(`🧹 Cleared existing timer: ${existingKey}`);
    }

    // Clear existing Redis timer and database records
    await this.redisStateManager.deleteTimer(draftId);
    await this.storage.deactivateAllDraftTimers(draftId);

    // Store timer in Redis
    const redisTimer = {
      draftId,
      userId,
      startTime: Date.now(),
      duration: this.draftConfig.pickTimeLimit,
      round,
      pick: pickNumber
    };
    
    await this.redisStateManager.setTimer(draftId, userId, this.draftConfig.pickTimeLimit);
    
    // PERMANENT FIX: Ensure draft is marked as active in Redis
    await this.redisStateManager.addActiveDraft(draftId);

    // Create database timer record for persistence
    await this.storage.createDraftTimer({
      draftId,
      userId,
      round,
      pickNumber,
      timeRemaining: this.draftConfig.pickTimeLimit
    });
    
    console.log(`🕐 Starting Redis timer for user ${userId} in draft ${draftId} with ${this.draftConfig.pickTimeLimit} seconds`);
    
    // Set up local interval for broadcasting updates
    const timerKey = `${draftId}-${userId}`;
    
    // Initialize local timer counter
    let localTimeRemaining = this.draftConfig.pickTimeLimit;
    
    const interval = setInterval(async () => {
      // Decrement local timer
      localTimeRemaining--;
      
      console.log(`🕐 Timer tick for user ${userId}: ${localTimeRemaining}s remaining`);
      
      if (localTimeRemaining <= 0) {
        console.log(`⏰ Timer expired for user ${userId}, triggering expiration handler`);
        clearInterval(interval);
        this.timerIntervals.delete(timerKey);
        
        // Clean up Redis timer
        await this.redisStateManager.deleteTimer(draftId);
        
        // Handle expiration with immediate processing for smooth transitions
        try {
          console.log(`🚀 Processing timer expiration immediately for ${userId}`);
          await this.handleTimerExpired(draftId, userId);
          console.log(`✅ Timer expiration completed for ${userId}`);
        } catch (error) {
          console.error(`❌ Timer expiration handler failed for ${userId}:`, error);
        }
      } else {
        // Update Redis with current time remaining
        await this.redisStateManager.updateTimeRemaining(draftId, localTimeRemaining);
        
        // Broadcast timer update
        if (this.webSocketManager) {
          this.webSocketManager.broadcastTimerUpdate(draftId, localTimeRemaining);
        }
        
        // Update database timer for persistence
        try {
          await this.storage.updateDraftTimer(draftId, userId, localTimeRemaining);
        } catch (error) {
          console.error(`Failed to update timer: ${error}`);
        }
      }
    }, 1000);
    
    this.timerIntervals.set(timerKey, interval);
  }

  private async stopPickTimer(draftId: string, userId: string): Promise<void> {
    const timerKey = `${draftId}-${userId}`;
    const interval = this.timerIntervals.get(timerKey);
    
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(timerKey);
    }
    
    // Clean up Redis timer and database timer
    await this.redisStateManager.deleteTimer(draftId);
    await this.storage.deactivateTimer(draftId, userId);
  }

  private async checkDivisionRule(
    draftId: string,
    userId: string,
    selectedTeam: NflTeam
  ): Promise<{ isViolation: boolean; allowOverride: boolean; message: string }> {
    const userPicks = await this.storage.getUserDraftPicks(draftId, userId);
    
    // FIXED: Check for same conference + division combination (e.g., AFC East vs NFC East)
    const fullDivision = `${selectedTeam.conference} ${selectedTeam.division}`;
    const divisionCount = userPicks.filter(
      pick => `${pick.nflTeam.conference} ${pick.nflTeam.division}` === fullDivision
    ).length;

    if (divisionCount >= this.draftConfig.maxTeamsPerDivision) {
      const availableOtherDivisions = await this.storage.getAvailableNflTeams(draftId);
      const hasOtherOptions = availableOtherDivisions.some(
        team => `${team.conference} ${team.division}` !== fullDivision
      );

      return {
        isViolation: true,
        allowOverride: !hasOtherOptions,
        message: hasOtherOptions 
          ? `Already have a team from ${fullDivision} division`
          : `Division rule override: no other division options available`
      };
    }

    return { isViolation: false, allowOverride: false, message: '' };
  }

  /**
   * Simulate a bot pick for automated testing (private method)
   */
  private async simulateBotPickPrivate(draftId: string, userId: string): Promise<void> {
    try {
      if (!this.robotManager?.isRobot(userId)) {
        console.log(`[SnakeDraftManager] User ${userId} is not a robot, skipping bot pick logic`);
        return;
      }

      console.log(`[SnakeDraftManager] Executing robot autopick for ${userId}`);
      
      // Get available teams
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      if (availableTeams.length === 0) {
        console.log('[SnakeDraftManager] No available teams for bot pick');
        return;
      }

      // Apply division rule if enabled
      let eligibleTeams = availableTeams;
      
      if (this.draftConfig.enableDivisionRule) {
        eligibleTeams = await this.getDivisionEligibleTeams(draftId, userId, availableTeams);
        if (eligibleTeams.length === 0) {
          console.log(`[SnakeDraftManager] Division rule override for robot ${userId} - no eligible teams, using all available`);
          eligibleTeams = availableTeams;
        }
      }

      // Get robot's preferred team from eligible options
      const preferredTeams = this.robotManager.getRobotTeamPreference(userId, eligibleTeams);
      const selectedTeam = preferredTeams[0];

      if (selectedTeam) {
        const pickResult = await this.makePick(draftId, {
          userId,
          nflTeamId: selectedTeam.id,
          isAutoPick: true
        });
        
        if (pickResult.success) {
          console.log(`[SnakeDraftManager] ✅ Robot ${userId} successfully auto-picked ${selectedTeam.name}`);
        } else {
          console.error(`[SnakeDraftManager] ❌ Failed to make robot pick: ${pickResult.error}`);
        }
      } else {
        console.error(`[SnakeDraftManager] No preferred team found for robot ${userId}`);
      }
    } catch (error) {
      console.error('[SnakeDraftManager] Error in bot pick simulation:', error);
    }
  }

  private async getDivisionEligibleTeams(
    draftId: string,
    userId: string,
    availableTeams: NflTeam[]
  ): Promise<NflTeam[]> {
    const userPicks = await this.storage.getUserDraftPicks(draftId, userId);
    
    // FIXED: Get all conference + division combinations the user already has teams from
    const userFullDivisions = new Set(
      userPicks.map(p => `${p.nflTeam.conference} ${p.nflTeam.division}`)
    );

    return availableTeams.filter(team => {
      // If user already has a team from this conference+division, they can't pick another
      // unless the rule allows overrides (when no other options are available)
      const teamFullDivision = `${team.conference} ${team.division}`;
      return !userFullDivisions.has(teamFullDivision);
    });
  }

  /**
   * Force restart all active timers (for debugging server restart issues)
   */
  // Manual timer restart method removed due to storage interface limitations



  /**
   * Create timer interval without database record (for restarts)
   */
  private createTimerInterval(draftId: string, userId: string, initialTime: number): void {
    const timerKey = `${draftId}-${userId}`;
    let timeLeft = initialTime;
    
    const interval = setInterval(async () => {
      timeLeft--;
      console.log(`🕐 Timer tick for user ${userId}: ${timeLeft}s remaining`);
      
      if (timeLeft <= 0) {
        console.log(`⏰ Timer expired for user ${userId}, processing auto-pick`);
        clearInterval(interval);
        this.timerIntervals.delete(timerKey);
        
        // Execute expiration immediately
        await this.handleTimerExpired(draftId, userId);
      } else {
        try {
          await this.storage.updateDraftTimer(draftId, userId, timeLeft);
        } catch (error) {
          console.error(`Failed to update timer: ${error}`);
        }
      }
    }, 1000);
    
    this.timerIntervals.set(timerKey, interval);
  }

  /**
   * Broadcast a message to all connected clients via WebSocket manager
   */
  broadcast(message: any): void {
    if (this.webSocketManager && this.webSocketManager.broadcast) {
      this.webSocketManager.broadcast(message);
    } else {
      console.log('[SnakeDraftManager] ⚠️ WebSocket manager not available for broadcasting');
    }
  }

  /**
   * Cleanup method to clear all timers
   */
  cleanup(): void {
    this.timerIntervals.forEach(interval => clearInterval(interval));
    this.timerIntervals.clear();
  }
}

export default SnakeDraftManager;