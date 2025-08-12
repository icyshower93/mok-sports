// Week lock restriction logic for Mok Sports
// Prevents locking/loading once week starts until week ends

import { NFLDataService } from "../services/nflDataService.js";

export interface WeekLockStatus {
  canLock: boolean;
  reason?: string;
  weekStatus: 'pre_week' | 'week_in_progress' | 'week_complete';
  firstGameStart?: Date;
  lastGameEnd?: Date;
  gamesInProgress: number;
  gamesCompleted: number;
  totalGames: number;
}

export class WeekLockRestrictions {
  private nflDataService: NFLDataService;

  constructor() {
    this.nflDataService = new NFLDataService();
  }

  /**
   * Check if locks/loads are allowed for the given week
   * Rules:
   * - Can lock: Before first game of week starts OR after last game of week ends
   * - Cannot lock: While any game of the week is in progress or between first start and last end
   */
  async checkWeekLockStatus(season: number, week: number): Promise<WeekLockStatus> {
    try {
      console.log(`[WeekLockRestrictions] Checking lock status for Week ${week} of ${season}`);

      // For testing environment (2024 season), use different logic
      if (season === 2024) {
        return this.checkTestingWeekLockStatus(season, week);
      }

      // For production (2025+ season), use Tank01 live data
      return this.checkProductionWeekLockStatus(season, week);

    } catch (error) {
      console.error('[WeekLockRestrictions] Error checking week lock status:', error);
      // Default to allowing locks if we can't determine status
      return {
        canLock: true,
        reason: 'Unable to determine week status - defaulting to allow locks',
        weekStatus: 'pre_week',
        gamesInProgress: 0,
        gamesCompleted: 0,
        totalGames: 0
      };
    }
  }

  /**
   * Testing environment logic (2024 season)
   * Uses admin simulation state to determine if week is active
   */
  private async checkTestingWeekLockStatus(season: number, week: number): Promise<WeekLockStatus> {
    console.log(`[WeekLockRestrictions] Using testing logic for ${season} Week ${week}`);
    
    try {
      // Get admin simulation state
      const { getAdminState } = await import("../routes/admin.js");
      const adminState = getAdminState();
      const currentWeek = adminState.currentWeek;
      const simulationRunning = adminState.simulationRunning;

      // Get games for this week from database to count totals
      const weekGames = await this.nflDataService.getWeekData(season, week);
      const totalGames = weekGames.length;
      const gamesCompleted = weekGames.filter(game => game.isCompleted).length;
      const gamesInProgress = totalGames - gamesCompleted;

      // In testing: Allow locks if simulation is not running OR week hasn't started yet
      if (week > currentWeek) {
        // Future week - always allow locks
        return {
          canLock: true,
          weekStatus: 'pre_week',
          gamesInProgress: 0,
          gamesCompleted: 0,
          totalGames
        };
      }

      if (week < currentWeek) {
        // Past week - allow locks again (week is complete)
        return {
          canLock: true,
          weekStatus: 'week_complete',
          gamesInProgress: 0,
          gamesCompleted: totalGames,
          totalGames
        };
      }

      // Current week
      if (simulationRunning) {
        // Week is actively being simulated - no locks allowed
        return {
          canLock: false,
          reason: 'Week is currently in progress - locks disabled until week completes',
          weekStatus: 'week_in_progress',
          gamesInProgress,
          gamesCompleted,
          totalGames
        };
      } else {
        // Simulation paused or stopped - allow locks
        const allComplete = gamesCompleted === totalGames;
        return {
          canLock: true,
          weekStatus: allComplete ? 'week_complete' : 'pre_week',
          gamesInProgress,
          gamesCompleted,
          totalGames
        };
      }

    } catch (error) {
      console.error('[WeekLockRestrictions] Error in testing logic:', error);
      return {
        canLock: true,
        reason: 'Error checking testing status - defaulting to allow locks',
        weekStatus: 'pre_week',
        gamesInProgress: 0,
        gamesCompleted: 0,
        totalGames: 0
      };
    }
  }

  /**
   * Production environment logic (2025+ season)
   * Uses Tank01 API to get real-time game status
   */
  private async checkProductionWeekLockStatus(season: number, week: number): Promise<WeekLockStatus> {
    console.log(`[WeekLockRestrictions] Using production logic for ${season} Week ${week}`);
    
    try {
      // Get all games for this week from Tank01 API
      const weekGames = await this.nflDataService.getWeekData(season, week);
      
      if (weekGames.length === 0) {
        console.log(`[WeekLockRestrictions] No games found for Week ${week} - allowing locks`);
        return {
          canLock: true,
          weekStatus: 'pre_week',
          gamesInProgress: 0,
          gamesCompleted: 0,
          totalGames: 0
        };
      }

      const now = new Date();
      const totalGames = weekGames.length;
      
      // Sort games by date to find first and last
      const sortedGames = weekGames.sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime());
      const firstGame = sortedGames[0];
      const lastGame = sortedGames[sortedGames.length - 1];
      
      let gamesCompleted = 0;
      let gamesInProgress = 0;
      let gamesNotStarted = 0;

      // Count game statuses
      for (const game of weekGames) {
        if (game.isCompleted) {
          gamesCompleted++;
        } else if (game.status === 'live') {
          gamesInProgress++;
        } else {
          gamesNotStarted++;
        }
      }

      // Determine week status
      if (now < firstGame.gameDate) {
        // Before first game starts - allow locks
        return {
          canLock: true,
          weekStatus: 'pre_week',
          firstGameStart: firstGame.gameDate,
          lastGameEnd: lastGame.gameDate,
          gamesInProgress: 0,
          gamesCompleted: 0,
          totalGames
        };
      }

      if (gamesCompleted === totalGames) {
        // All games complete - allow locks for next week
        return {
          canLock: true,
          weekStatus: 'week_complete',
          firstGameStart: firstGame.gameDate,
          lastGameEnd: lastGame.gameDate,
          gamesInProgress: 0,
          gamesCompleted,
          totalGames
        };
      }

      // Week is in progress (first game started but not all complete) - no locks
      return {
        canLock: false,
        reason: `Week ${week} is in progress - locks disabled until all games complete`,
        weekStatus: 'week_in_progress',
        firstGameStart: firstGame.gameDate,
        lastGameEnd: lastGame.gameDate,
        gamesInProgress,
        gamesCompleted,
        totalGames
      };

    } catch (error) {
      console.error('[WeekLockRestrictions] Error in production logic:', error);
      return {
        canLock: true,
        reason: 'Error checking production status - defaulting to allow locks',
        weekStatus: 'pre_week',
        gamesInProgress: 0,
        gamesCompleted: 0,
        totalGames: 0
      };
    }
  }

  /**
   * Get a user-friendly message about lock restrictions
   */
  getLockStatusMessage(status: WeekLockStatus): string {
    if (status.canLock) {
      switch (status.weekStatus) {
        case 'pre_week':
          return 'Locks available - week hasn\'t started yet';
        case 'week_complete':
          return 'Locks available - week is complete';
        default:
          return 'Locks available';
      }
    } else {
      return status.reason || 'Locks not available';
    }
  }

  /**
   * Check if a specific team can be locked (team-specific restrictions)
   */
  async checkTeamLockStatus(season: number, week: number, teamCode: string): Promise<{canLock: boolean, reason?: string}> {
    try {
      // First check general week restrictions
      const weekStatus = await this.checkWeekLockStatus(season, week);
      if (!weekStatus.canLock) {
        return {
          canLock: false,
          reason: weekStatus.reason
        };
      }

      // For production, also check if this specific team's game has started
      if (season >= 2025) {
        const weekGames = await this.nflDataService.getWeekData(season, week);
        const teamGame = weekGames.find(game => 
          game.homeTeam === teamCode || game.awayTeam === teamCode
        );

        if (teamGame) {
          const now = new Date();
          if (now >= teamGame.gameDate && !teamGame.isCompleted) {
            return {
              canLock: false,
              reason: `${teamCode}'s game has started - cannot lock this team`
            };
          }
        }
      }

      return { canLock: true };
      
    } catch (error) {
      console.error(`[WeekLockRestrictions] Error checking team lock status for ${teamCode}:`, error);
      return { canLock: true }; // Default to allowing if error
    }
  }
}

// Export singleton instance
export const weekLockRestrictions = new WeekLockRestrictions();