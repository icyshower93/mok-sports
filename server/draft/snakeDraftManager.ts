/**
 * Snake Draft Manager
 * 
 * Handles the core snake draft logic including:
 * - Draft order generation and snake pattern
 * - Turn management and auto-pick functionality
 * - Conference validation rules
 * - Real-time state management
 * - Bot user simulation
 */

import { IStorage } from "../storage.js";
import type { Draft, DraftPick, NflTeam, User } from "@shared/schema";

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
  enableConferenceRule: boolean;
  maxTeamsPerConference: number;
}

export class SnakeDraftManager {
  private storage: IStorage;
  private timerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private draftConfig: DraftConfig;
  private draftStateCache: Map<string, DraftState> = new Map();
  private lastTimerUpdate: Map<string, number> = new Map();
  private webSocketManager?: any; // Will be injected
  private robotManager?: any; // Will be injected for robot handling

  constructor(storage: IStorage, config?: Partial<DraftConfig>, webSocketManager?: any, robotManager?: any) {
    this.storage = storage;
    this.webSocketManager = webSocketManager;
    this.robotManager = robotManager;
    this.draftConfig = {
      totalRounds: 5,
      pickTimeLimit: 60,
      enableConferenceRule: true,
      maxTeamsPerConference: 3, // No more than 3 teams from same conference per user
      ...config
    };
    
    // Skip timer recovery for now - focus on fixing core timer mechanism
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
      draftOrder: shuffledOrder
    };

    return await this.storage.createDraft(draftData);
  }

  /**
   * Starts the draft and begins the first pick timer
   */
  async startDraft(draftId: string): Promise<DraftState> {
    await this.storage.startDraft(draftId);
    const draft = await this.storage.getDraft(draftId);
    
    if (!draft) {
      throw new Error('Draft not found');
    }

    // Start timer for first pick
    await this.startPickTimer(draftId, draft.draftOrder[0], 1, 1);
    
    return await this.getDraftState(draftId);
  }

  /**
   * Gets the current draft state for real-time updates
   */
  async getDraftState(draftId: string): Promise<DraftState> {
    const draft = await this.storage.getDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    const picks = await this.storage.getDraftPicks(draftId);
    const availableTeams = await this.storage.getAvailableNflTeams(draftId);
    const currentUserId = this.getCurrentPickUser(draft);
    const timer = await this.storage.getActiveDraftTimer(draftId);

    return {
      draft,
      currentUserId,
      timeRemaining: timer?.timeRemaining || 0,
      picks,
      availableTeams,
      isUserTurn: !!currentUserId,
      canMakePick: draft.status === 'active' && !!currentUserId
    };
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

      // Check conference rule if enabled
      if (this.draftConfig.enableConferenceRule) {
        const conferenceViolation = await this.checkConferenceRule(
          draftId,
          pickRequest.userId,
          selectedTeam
        );
        
        if (conferenceViolation.isViolation && !conferenceViolation.allowOverride) {
          return { 
            success: false, 
            error: `Conference rule violation: ${conferenceViolation.message}` 
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

      // Update cache
      this.draftStateCache.set(draftId, nextState);

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
      
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      if (availableTeams.length === 0) {
        console.error('No available teams for auto-pick');
        return;
      }

      // Get user's current picks to check conference rule
      let eligibleTeams = availableTeams;
      
      if (this.draftConfig.enableConferenceRule) {
        eligibleTeams = await this.getConferenceEligibleTeams(draftId, userId, availableTeams);
      }

      // If no eligible teams due to conference rule, pick from any available
      if (eligibleTeams.length === 0) {
        eligibleTeams = availableTeams;
        console.log(`⚠️ Conference rule forced override for user ${userId}`);
      }

      // Random selection for auto-pick
      const randomTeam = eligibleTeams[Math.floor(Math.random() * eligibleTeams.length)];
      
      await this.makePick(draftId, {
        userId,
        nflTeamId: randomTeam.id,
        isAutoPick: true
      });

      console.log(`🤖 Auto-picked ${randomTeam.name} for user ${userId}`);
      
      // Advance draft to next pick
      const newState = await this.advanceDraft(draftId);
      
      // Broadcast the update
      this.websocketManager?.broadcastDraftUpdate(draftId, newState);
      
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
   * Simulates bot picks for testing
   */
  async simulateBotPick(draftId: string, userId: string): Promise<void> {
    // Wait a short random time to simulate thinking
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    const availableTeams = await this.storage.getAvailableNflTeams(draftId);
    if (availableTeams.length === 0) return;

    let eligibleTeams = availableTeams;
    
    if (this.draftConfig.enableConferenceRule) {
      eligibleTeams = await this.getConferenceEligibleTeams(draftId, userId, availableTeams);
      if (eligibleTeams.length === 0) {
        eligibleTeams = availableTeams; // Override rule if necessary
      }
    }

    // Smart bot selection: prefer teams from different conferences
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
    
    // Check if round is complete
    if ((nextPick - 1) % totalUsers === 0 && nextPick > totalUsers) {
      nextRound++;
      nextPick = (nextRound - 1) * totalUsers + 1;
    }
    
    // Check if draft is complete
    if (nextPick > totalPicks) {
      await this.storage.completeDraft(draftId);
      return await this.getDraftState(draftId);
    }
    
    // Update draft progress
    await this.storage.updateDraftProgress(draftId, nextRound, nextPick);
    
    // Start timer for next pick
    const nextUserId = this.getCurrentPickUser({
      ...draft,
      currentRound: nextRound,
      currentPick: nextPick
    });
    
    if (nextUserId) {
      await this.startPickTimer(draftId, nextUserId, nextRound, nextPick);
      
      // If next user is a robot, trigger auto-pick after delay
      if (this.robotManager?.isRobot(nextUserId)) {
        const delay = this.robotManager.simulateRobotPickDelay();
        setTimeout(() => {
          this.simulateBotPick(draftId, nextUserId);
        }, delay);
      }
    }
    
    return await this.getDraftState(draftId);
  }

  private async startPickTimer(
    draftId: string, 
    userId: string, 
    round: number, 
    pickNumber: number
  ): Promise<void> {
    // Create timer record
    await this.storage.createDraftTimer({
      draftId,
      userId,
      round,
      pickNumber,
      timeRemaining: this.draftConfig.pickTimeLimit
    });

    // Set up countdown interval
    const timerKey = `${draftId}-${userId}`;
    let timeLeft = this.draftConfig.pickTimeLimit;
    
    console.log(`🕐 Starting timer for user ${userId} in draft ${draftId} with ${timeLeft} seconds`);
    
    const interval = setInterval(async () => {
      timeLeft--;
      console.log(`🕐 Timer tick for user ${userId}: ${timeLeft}s remaining`);
      
      if (timeLeft <= 0) {
        console.log(`⏰ Timer reached 0 for user ${userId}, triggering expiration handler`);
        clearInterval(interval);
        this.timerIntervals.delete(timerKey);
        
        // Force immediate timer expiration handling
        console.log(`🚨 TIMER EXPIRED: Processing auto-pick for ${userId}`);
        
        // Force expiration with immediate execution (no async delay)
        this.handleTimerExpired(draftId, userId)
          .then(() => {
            console.log(`✅ Timer expiration completed for ${userId}`);
          })
          .catch(error => {
            console.error(`❌ Timer expiration handler failed for ${userId}:`, error);
          });
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

  private async stopPickTimer(draftId: string, userId: string): Promise<void> {
    const timerKey = `${draftId}-${userId}`;
    const interval = this.timerIntervals.get(timerKey);
    
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(timerKey);
    }
    
    await this.storage.deactivateTimer(draftId, userId);
  }

  private async checkConferenceRule(
    draftId: string,
    userId: string,
    selectedTeam: NflTeam
  ): Promise<{ isViolation: boolean; allowOverride: boolean; message: string }> {
    const userPicks = await this.storage.getUserDraftPicks(draftId, userId);
    const conferenceCount = userPicks.filter(
      pick => pick.nflTeam.conference === selectedTeam.conference
    ).length;

    if (conferenceCount >= this.draftConfig.maxTeamsPerConference) {
      const availableOtherConference = await this.storage.getAvailableNflTeams(draftId);
      const hasOtherOptions = availableOtherConference.some(
        team => team.conference !== selectedTeam.conference
      );

      return {
        isViolation: true,
        allowOverride: !hasOtherOptions,
        message: hasOtherOptions 
          ? `Already have ${conferenceCount} ${selectedTeam.conference} teams`
          : `Conference rule override: no other options available`
      };
    }

    return { isViolation: false, allowOverride: false, message: '' };
  }

  /**
   * Simulate a bot pick for automated testing
   */
  private async simulateBotPick(draftId: string, userId: string): Promise<void> {
    try {
      if (!this.robotManager?.isRobot(userId)) {
        return;
      }

      console.log(`[SnakeDraftManager] Simulating bot pick for ${userId}`);
      
      // Get available teams
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      if (availableTeams.length === 0) {
        console.log('[SnakeDraftManager] No available teams for bot pick');
        return;
      }

      // Get robot's preferred team
      const preferredTeams = this.robotManager.getRobotTeamPreference(userId, availableTeams);
      const selectedTeam = preferredTeams[0];

      if (selectedTeam) {
        await this.makePick(draftId, userId, selectedTeam.id, true);
        console.log(`[SnakeDraftManager] Bot ${userId} auto-picked ${selectedTeam.name}`);
      }
    } catch (error) {
      console.error('[SnakeDraftManager] Error in bot pick simulation:', error);
    }
  }

  private async getConferenceEligibleTeams(
    draftId: string,
    userId: string,
    availableTeams: NflTeam[]
  ): Promise<NflTeam[]> {
    const userPicks = await this.storage.getUserDraftPicks(draftId, userId);
    const afcCount = userPicks.filter(p => p.nflTeam.conference === 'AFC').length;
    const nfcCount = userPicks.filter(p => p.nflTeam.conference === 'NFC').length;

    return availableTeams.filter(team => {
      if (team.conference === 'AFC' && afcCount >= this.draftConfig.maxTeamsPerConference) {
        return false;
      }
      if (team.conference === 'NFC' && nfcCount >= this.draftConfig.maxTeamsPerConference) {
        return false;
      }
      return true;
    });
  }

  /**
   * Force restart all active timers (for debugging server restart issues)
   */
  // Manual timer restart method removed due to storage interface limitations

  /**
   * Recover active timers after server restart
   */
  async recoverActiveTimers(): Promise<void> {
    console.log('🔄 Recovering active timers after restart...');
    
    try {
      const activeTimers = await this.storage.getActiveTimers();
      
      for (const timer of activeTimers) {
        const now = Date.now();
        const startTime = new Date(timer.timerStartedAt).getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, timer.timeRemaining - elapsed);
        
        console.log(`🕐 Recovering timer for user ${timer.userId}: ${remaining}s remaining (${elapsed}s elapsed)`);
        
        if (remaining <= 0) {
          // Timer already expired - trigger auto-pick immediately
          console.log(`⏰ Timer was expired, triggering auto-pick for user ${timer.userId}`);
          await this.handleTimerExpired(timer.draftId, timer.userId);
        } else {
          // Timer still active - recreate interval
          this.createTimerInterval(timer.draftId, timer.userId, remaining);
        }
      }
      
      console.log(`✅ Recovered ${activeTimers.length} active timers`);
    } catch (error) {
      console.error('❌ Error recovering timers:', error);
    }
  }

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
   * Cleanup method to clear all timers
   */
  cleanup(): void {
    this.timerIntervals.forEach(interval => clearInterval(interval));
    this.timerIntervals.clear();
  }
}

export default SnakeDraftManager;