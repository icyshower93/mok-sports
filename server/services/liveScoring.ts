import { nflDataService } from './nflDataService';
import { db } from '../db';
import { nflGames } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface LiveGameUpdate {
  gameId: string;
  homeScore: number;
  awayScore: number;
  isCompleted: boolean;
  gameStatus: 'scheduled' | 'live' | 'final';
  lastUpdated: Date;
}

class LiveScoringService {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_FREQUENCY = 30000; // 30 seconds during live games

  /**
   * Start live scoring updates for the current NFL season
   * Only fetches scores for games that are currently live or recently completed
   */
  public startLiveUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    console.log('🔴 [LiveScoring] Starting live score updates...');
    
    // Immediate update, then every 30 seconds
    this.updateLiveGames();
    this.updateInterval = setInterval(() => {
      this.updateLiveGames();
    }, this.UPDATE_FREQUENCY);
  }

  public stopLiveUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ [LiveScoring] Stopped live score updates');
    }
  }

  /**
   * Update scores only for games that are currently happening or recently finished
   */
  private async updateLiveGames(): Promise<void> {
    try {
      const now = new Date();
      const currentSeason = now.getFullYear();
      
      // Only check today's games and games from the last 3 hours
      const startTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // 3 hours ago
      const endTime = new Date(now.getTime() + (6 * 60 * 60 * 1000)); // 6 hours from now

      console.log(`🏈 [LiveScoring] Checking games between ${startTime.toISOString()} and ${endTime.toISOString()}`);

      // Get games that might be live or recently completed
      const potentialLiveGames = await db
        .select()
        .from(nflGames)
        .where(and(
          eq(nflGames.season, currentSeason),
          // Games scheduled within our time window
        ));

      const liveUpdates: LiveGameUpdate[] = [];

      for (const game of potentialLiveGames) {
        // Skip if game is already marked as completed
        if (game.isCompleted) continue;

        try {
          // Check if this game should be live based on current time
          const gameTime = new Date(game.gameDate);
          const gameEndEstimate = new Date(gameTime.getTime() + (4 * 60 * 60 * 1000)); // Games typically last 3-4 hours
          
          // Only fetch if game should have started but not ended yet, or just ended
          if (now >= gameTime && now <= new Date(gameEndEstimate.getTime() + (60 * 60 * 1000))) {
            
            // Create Tank01 game ID format
            const dateStr = gameTime.toISOString().split('T')[0].replace(/-/g, '');
            
            // Get team codes from database
            const homeTeam = await this.getTeamCode(game.homeTeamId);
            const awayTeam = await this.getTeamCode(game.awayTeamId);
            
            if (!homeTeam || !awayTeam) continue;
            
            const gameID = `${dateStr}_${awayTeam}@${homeTeam}`;
            
            console.log(`🔍 [LiveScoring] Checking ${gameID} for live updates...`);
            
            // Try to get live score from Tank01 API
            const boxScore = await nflDataService.getGameBoxScore(gameID);
            
            if (boxScore && boxScore.homeTeam && boxScore.awayTeam) {
              const homeScore = parseInt(boxScore.homeTeam.teamStats?.totalPoints || boxScore.homeTeam.totalPts || '0');
              const awayScore = parseInt(boxScore.awayTeam.teamStats?.totalPoints || boxScore.awayTeam.totalPts || '0');
              
              // Determine game status
              let gameStatus: 'scheduled' | 'live' | 'final' = 'scheduled';
              let isCompleted = false;
              
              if (boxScore.gameStatus) {
                const status = boxScore.gameStatus.toLowerCase();
                if (status.includes('final') || status.includes('completed')) {
                  gameStatus = 'final';
                  isCompleted = true;
                } else if (status.includes('live') || status.includes('quarter') || status.includes('half')) {
                  gameStatus = 'live';
                } else if (homeScore > 0 || awayScore > 0) {
                  // If we have scores but no clear status, assume live
                  gameStatus = 'live';
                }
              }
              
              // Only update if we have actual score changes or status changes
              if (homeScore !== game.homeScore || awayScore !== game.awayScore || isCompleted !== game.isCompleted) {
                liveUpdates.push({
                  gameId: game.id,
                  homeScore,
                  awayScore,
                  isCompleted,
                  gameStatus,
                  lastUpdated: now
                });
                
                console.log(`📊 [LiveScoring] Score update: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam} (${gameStatus})`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ [LiveScoring] Error checking game ${game.id}:`, error);
        }
        
        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Apply all updates to database
      if (liveUpdates.length > 0) {
        for (const update of liveUpdates) {
          await db
            .update(nflGames)
            .set({
              homeScore: update.homeScore,
              awayScore: update.awayScore,
              isCompleted: update.isCompleted,
              winnerTeamId: update.homeScore > update.awayScore ? 
                (await this.getGameHomeTeamId(update.gameId)) :
                update.awayScore > update.homeScore ?
                (await this.getGameAwayTeamId(update.gameId)) : null
            })
            .where(eq(nflGames.id, update.gameId));
        }
        
        console.log(`✅ [LiveScoring] Updated ${liveUpdates.length} games with live scores`);
        
        // Broadcast update to connected clients via WebSocket if available
        // This would trigger UI updates in real-time
        this.broadcastScoreUpdates(liveUpdates);
      }

    } catch (error) {
      console.error('❌ [LiveScoring] Error in live score update:', error);
    }
  }

  /**
   * Get team code by team ID
   */
  private async getTeamCode(teamId: string): Promise<string | null> {
    try {
      const result = await db.query.nflTeams.findFirst({
        where: (teams, { eq }) => eq(teams.id, teamId),
        columns: { code: true }
      });
      return result?.code || null;
    } catch (error) {
      console.error('Error getting team code:', error);
      return null;
    }
  }

  /**
   * Get home team ID for a game
   */
  private async getGameHomeTeamId(gameId: string): Promise<string | null> {
    try {
      const game = await db.query.nflGames.findFirst({
        where: (games, { eq }) => eq(games.id, gameId),
        columns: { homeTeamId: true }
      });
      return game?.homeTeamId || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get away team ID for a game
   */
  private async getGameAwayTeamId(gameId: string): Promise<string | null> {
    try {
      const game = await db.query.nflGames.findFirst({
        where: (games, { eq }) => eq(games.id, gameId),
        columns: { awayTeamId: true }
      });
      return game?.awayTeamId || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Broadcast score updates to connected WebSocket clients
   */
  private broadcastScoreUpdates(updates: LiveGameUpdate[]): void {
    try {
      // Import WebSocket manager and broadcast updates
      // This would be connected to the existing WebSocket system
      const updateMessage = {
        type: 'live-score-update',
        updates: updates.map(update => ({
          gameId: update.gameId,
          homeScore: update.homeScore,
          awayScore: update.awayScore,
          isCompleted: update.isCompleted,
          status: update.gameStatus,
          timestamp: update.lastUpdated.toISOString()
        }))
      };
      
      // Broadcast to all connected clients
      console.log(`📡 [LiveScoring] Broadcasting score updates to clients:`, updateMessage);
      // TODO: Integrate with existing WebSocket system
      
    } catch (error) {
      console.error('Error broadcasting score updates:', error);
    }
  }

  /**
   * Get current live games status
   */
  public async getLiveGamesStatus(): Promise<{ liveGames: number; lastUpdate: Date | null }> {
    try {
      const now = new Date();
      const currentSeason = now.getFullYear();
      
      // Count games that are currently live (started but not completed)
      const liveGames = await db
        .select()
        .from(nflGames)
        .where(and(
          eq(nflGames.season, currentSeason),
          eq(nflGames.isCompleted, false)
        ));

      // Filter for games that should be live based on time
      const actuallyLive = liveGames.filter(game => {
        const gameTime = new Date(game.gameDate);
        const gameEndEstimate = new Date(gameTime.getTime() + (4 * 60 * 60 * 1000));
        return now >= gameTime && now <= gameEndEstimate;
      });

      return {
        liveGames: actuallyLive.length,
        lastUpdate: actuallyLive.length > 0 ? now : null
      };
    } catch (error) {
      console.error('Error getting live games status:', error);
      return { liveGames: 0, lastUpdate: null };
    }
  }
}

export const liveScoringService = new LiveScoringService();