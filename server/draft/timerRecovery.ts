import { Storage } from '../storage';

export class TimerRecovery {
  constructor(private storage: Storage) {}

  /**
   * Recover any expired timers that weren't processed due to server restart
   */
  async recoverExpiredTimers(): Promise<void> {
    try {
      console.log('🔄 Checking for expired timers to recover...');
      
      // Get all active timers
      const activeTimers = await this.storage.query(`
        SELECT dt.*, d.status 
        FROM draft_timers dt 
        JOIN drafts d ON dt.draft_id = d.id 
        WHERE dt.is_active = true AND d.status = 'active'
      `);

      for (const timer of activeTimers) {
        const elapsed = Math.floor((Date.now() - new Date(timer.timer_started_at).getTime()) / 1000);
        const timeRemaining = Math.max(0, timer.time_remaining - elapsed);
        
        if (timeRemaining <= 0) {
          console.log(`⚠️ Found expired timer for user ${timer.user_id} in draft ${timer.draft_id}`);
          
          // Force auto-pick and advance
          await this.forceAutoPick(timer.draft_id, timer.user_id, timer.pick_number);
        } else {
          // Update the timer with correct remaining time
          await this.storage.updateDraftTimer(timer.draft_id, timer.user_id, timeRemaining);
          console.log(`🕐 Updated timer for user ${timer.user_id}: ${timeRemaining}s remaining`);
        }
      }
    } catch (error) {
      console.error('Error recovering expired timers:', error);
    }
  }

  private async forceAutoPick(draftId: string, userId: string, pickNumber: number): Promise<void> {
    try {
      // Get available teams
      const availableTeams = await this.storage.getAvailableNflTeams(draftId);
      if (availableTeams.length === 0) {
        console.error(`No teams available for auto-pick in draft ${draftId}`);
        return;
      }

      // Pick random team
      const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      
      // Calculate round from pick number
      const round = Math.ceil(pickNumber / 6); // 6 users per round
      
      // Create the pick
      await this.storage.createDraftPick({
        draftId,
        userId,
        nflTeamId: randomTeam.id,
        round,
        pickNumber,
        isAutoPick: true
      });

      // Deactivate timer
      await this.storage.deactivateTimer(draftId, userId);
      
      // Advance draft
      await this.storage.updateDraftProgress(draftId, round, pickNumber + 1);
      
      console.log(`🤖 Force auto-picked ${randomTeam.name} for user ${userId} (pick ${pickNumber})`);
      
    } catch (error) {
      console.error(`Error in force auto-pick for user ${userId}:`, error);
    }
  }
}