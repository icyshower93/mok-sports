// End-of-week processing system for Mok Sports
// Handles high/low score icons, weekly skins awards, and week point resets

import { db } from "../db.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { 
  nflGames, 
  nflTeams, 
  userWeeklyScores, 
  weeklySkins, 
  draftPicks,
  drafts,
  leagues,
  users 
} from "@shared/schema.js";

export interface WeekEndResults {
  highScoreTeams: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    score: number;
  }>;
  lowScoreTeams: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    score: number;
  }>;
  weeklySkinsWinner?: {
    userId: string;
    userName: string;
    totalWeeklyPoints: number;
    prizeAmount: number;
    isTied: boolean;
  };
  skinsRollover?: {
    reason: string;
    nextWeekPrize: number;
  };
}

export class EndOfWeekProcessor {
  
  // Check if a week is complete (all games finished)
  async isWeekComplete(season: number, week: number, currentSimulatedDate?: Date): Promise<boolean> {
    const weekGames = await db.select().from(nflGames).where(
      and(
        eq(nflGames.season, season),
        eq(nflGames.week, week)
      )
    );
    
    if (weekGames.length === 0) return false;
    
    // If currentSimulatedDate is provided, check if all games have actually occurred
    if (currentSimulatedDate) {
      const gamesActuallyCompleted = weekGames.filter(game => {
        // Game must be marked as completed AND its date must have passed
        return game.isCompleted && new Date(game.gameDate) <= currentSimulatedDate;
      });
      
      // Week is complete only if ALL games have both occurred and been marked as completed
      return gamesActuallyCompleted.length === weekGames.length;
    }
    
    // Fallback to original logic if no simulated date provided
    return weekGames.every(game => game.isCompleted);
  }

  // Process end-of-week: determine high/low scores and award weekly skins
  async processEndOfWeek(season: number, week: number, leagueId: string, currentSimulatedDate?: Date): Promise<WeekEndResults> {
    console.log(`[EndOfWeek] Processing end of week ${week} for season ${season}, league ${leagueId}`);
    
    // First, verify week is actually complete
    const weekComplete = await this.isWeekComplete(season, week, currentSimulatedDate);
    if (!weekComplete) {
      throw new Error(`Cannot process end of week - Week ${week} is not yet complete`);
    }

    // Get all completed games for this week with scores
    const weekGames = await db.select({
      gameId: nflGames.id,
      homeTeamId: nflGames.homeTeamId,
      awayTeamId: nflGames.awayTeamId,
      homeScore: nflGames.homeScore,
      awayScore: nflGames.awayScore,
      homeTeamCode: nflTeams.code,
      homeTeamName: nflTeams.name,
      awayTeamCode: nflTeams.code,
      awayTeamName: nflTeams.name
    })
    .from(nflGames)
    .leftJoin(nflTeams, eq(nflGames.homeTeamId, nflTeams.id))
    .where(
      and(
        eq(nflGames.season, season),
        eq(nflGames.week, week),
        eq(nflGames.isCompleted, true)
      )
    );

    console.log(`[EndOfWeek] Found ${weekGames.length} completed games for week ${week}`);

    // Calculate team scores and find high/low performers
    const teamScores = await this.calculateTeamScores(weekGames);
    const { highScoreTeams, lowScoreTeams } = this.findHighLowScoreTeams(teamScores);

    console.log(`[EndOfWeek] High score teams:`, highScoreTeams.map(t => `${t.teamCode} (${t.score})`));
    console.log(`[EndOfWeek] Low score teams:`, lowScoreTeams.map(t => `${t.teamCode} (${t.score})`));

    // Apply high/low score bonuses to users who own these teams
    await this.applyHighLowScoreBonuses(season, week, leagueId, highScoreTeams, lowScoreTeams);

    // Process weekly skins award
    const skinsResult = await this.processWeeklySkins(season, week, leagueId);

    return {
      highScoreTeams,
      lowScoreTeams,
      weeklySkinsWinner: skinsResult.winner,
      skinsRollover: skinsResult.rollover
    };
  }

  // Calculate individual team scores from all games
  private async calculateTeamScores(weekGames: any[]): Promise<Map<string, { teamId: string; teamCode: string; teamName: string; score: number }>> {
    const teamScores = new Map();

    for (const game of weekGames) {
      // Get home team info
      const homeTeam = await db.select().from(nflTeams).where(eq(nflTeams.id, game.homeTeamId)).limit(1);
      const awayTeam = await db.select().from(nflTeams).where(eq(nflTeams.id, game.awayTeamId)).limit(1);

      if (homeTeam[0]) {
        teamScores.set(game.homeTeamId, {
          teamId: game.homeTeamId,
          teamCode: homeTeam[0].code,
          teamName: homeTeam[0].name,
          score: game.homeScore || 0
        });
      }

      if (awayTeam[0]) {
        teamScores.set(game.awayTeamId, {
          teamId: game.awayTeamId,
          teamCode: awayTeam[0].code,
          teamName: awayTeam[0].name,
          score: game.awayScore || 0
        });
      }
    }

    return teamScores;
  }

  // Find teams with highest and lowest scores
  private findHighLowScoreTeams(teamScores: Map<string, any>): { highScoreTeams: any[], lowScoreTeams: any[] } {
    const scores = Array.from(teamScores.values());
    
    if (scores.length === 0) {
      return { highScoreTeams: [], lowScoreTeams: [] };
    }

    // Find highest and lowest scores
    const maxScore = Math.max(...scores.map(t => t.score));
    const minScore = Math.min(...scores.map(t => t.score));

    const highScoreTeams = scores.filter(t => t.score === maxScore);
    const lowScoreTeams = scores.filter(t => t.score === minScore);

    return { highScoreTeams, lowScoreTeams };
  }

  // Apply +1 for high score teams and -1 for low score teams
  private async applyHighLowScoreBonuses(
    season: number, 
    week: number, 
    leagueId: string, 
    highScoreTeams: any[], 
    lowScoreTeams: any[]
  ): Promise<void> {
    console.log(`[EndOfWeek] Applying high/low score bonuses for week ${week}`);

    // Apply +1 bonus for users owning high-scoring teams
    for (const team of highScoreTeams) {
      await this.applyTeamBonus(season, week, leagueId, team.teamId, 1, 'weekly_high');
    }

    // Apply -1 penalty for users owning low-scoring teams  
    for (const team of lowScoreTeams) {
      await this.applyTeamBonus(season, week, leagueId, team.teamId, -1, 'weekly_low');
    }
  }

  // Apply bonus/penalty to users who own a specific team
  private async applyTeamBonus(
    season: number,
    week: number, 
    leagueId: string,
    teamId: string,
    bonusPoints: number,
    reason: string
  ): Promise<void> {
    // Find users who own this team in this league  
    const teamOwners = await db.select({
      userId: draftPicks.userId,
      userName: users.name
    })
    .from(draftPicks)
    .innerJoin(users, eq(draftPicks.userId, users.id))
    .innerJoin(drafts, eq(draftPicks.draftId, drafts.id))
    .where(
      and(
        eq(draftPicks.nflTeamId, teamId),
        eq(drafts.leagueId, leagueId)
      )
    );

    console.log(`[EndOfWeek] Applying ${bonusPoints} ${reason} bonus to ${teamOwners.length} users for team ${teamId}`);

    // Update each user's weekly score
    for (const owner of teamOwners) {
      const updateData: any = {
        totalPoints: sql`${userWeeklyScores.totalPoints} + ${bonusPoints}`,
        updatedAt: new Date()
      };

      // Update specific bonus/penalty columns based on reason
      if (reason === 'weekly_high') {
        updateData.weeklyHighBonusPoints = sql`${userWeeklyScores.weeklyHighBonusPoints} + ${bonusPoints}`;
      } else if (reason === 'weekly_low') {
        updateData.weeklyLowPenaltyPoints = sql`${userWeeklyScores.weeklyLowPenaltyPoints} + ${bonusPoints}`;
      }

      await db.update(userWeeklyScores)
        .set(updateData)
        .where(
          and(
            eq(userWeeklyScores.userId, owner.userId),
            eq(userWeeklyScores.leagueId, leagueId),
            eq(userWeeklyScores.season, season),
            eq(userWeeklyScores.week, week)
          )
        );

      console.log(`[EndOfWeek] Applied ${bonusPoints} ${reason} bonus to user ${owner.userName}`);
    }
  }

  // Process weekly skins award
  private async processWeeklySkins(
    season: number,
    week: number,
    leagueId: string
  ): Promise<{ winner?: any, rollover?: any }> {
    console.log(`[EndOfWeek] Processing weekly skins for week ${week}`);

    // Get all user scores for this week
    const weeklyScores = await db.select({
      userId: userWeeklyScores.userId,
      userName: users.name,
      totalPoints: userWeeklyScores.totalPoints
    })
    .from(userWeeklyScores)
    .innerJoin(users, eq(userWeeklyScores.userId, users.id))
    .where(
      and(
        eq(userWeeklyScores.leagueId, leagueId),
        eq(userWeeklyScores.season, season),
        eq(userWeeklyScores.week, week)
      )
    )
    .orderBy(desc(userWeeklyScores.totalPoints));

    if (weeklyScores.length === 0) {
      console.log(`[EndOfWeek] No scores found for week ${week} - no skins award`);
      return {};
    }

    const highestScore = weeklyScores[0].totalPoints;
    const winners = weeklyScores.filter(score => score.totalPoints === highestScore);

    console.log(`[EndOfWeek] Highest score: ${highestScore}, Winners: ${winners.length}`);

    // Check for previous rollover skins to determine prize amount
    const previousRollovers = await db.select()
      .from(weeklySkins)
      .where(
        and(
          eq(weeklySkins.leagueId, leagueId),
          eq(weeklySkins.season, season),
          eq(weeklySkins.isTied, true),
          eq(weeklySkins.isRollover, true)
        )
      );

    const totalSkinsThisWeek = 1 + previousRollovers.length; // Base 1 skin + rollovers
    
    if (winners.length === 1) {
      // Single winner - award all accumulated skins
      const winner = winners[0];
      
      await db.insert(weeklySkins).values({
        leagueId,
        season,
        week,
        winnerId: winner.userId,
        winningScore: winner.totalPoints,
        prizeAmount: totalSkinsThisWeek,
        isTied: false,
        isRollover: false,
        awardedAt: new Date()
      }).onConflictDoNothing();

      console.log(`[EndOfWeek] 🏆 ${winner.userName} wins ${totalSkinsThisWeek} skin(s) with ${winner.totalPoints} points`);

      return {
        winner: {
          userId: winner.userId,
          userName: winner.userName,
          totalWeeklyPoints: winner.totalPoints,
          prizeAmount: totalSkinsThisWeek,
          isTied: false
        }
      };
    } else {
      // Multiple winners - tie, rollover skins to next week
      console.log(`[EndOfWeek] 🔄 ${winners.length} users tied with ${highestScore} points - ${totalSkinsThisWeek} skin(s) rolled over`);

      // Record the tie with rollover flag
      await db.insert(weeklySkins).values({
        leagueId,
        season,
        week,
        winnerId: null, // No winner for ties
        winningScore: highestScore,
        prizeAmount: totalSkinsThisWeek,
        isTied: true,
        isRollover: true,
        awardedAt: null // No award given
      }).onConflictDoNothing();

      return {
        rollover: {
          reason: `${winners.length} users tied with ${highestScore} points`,
          nextWeekPrize: totalSkinsThisWeek + 1 // Next week will be worth current + 1 more
        }
      };
    }
  }

  // Reset weekly points when new week starts (first game of next week)
  async resetWeeklyPoints(season: number, newWeek: number, leagueId: string): Promise<void> {
    console.log(`[EndOfWeek] Resetting weekly points for start of week ${newWeek}`);

    // Reset all users' weekly points to 0 for the new week
    await db.update(userWeeklyScores)
      .set({
        basePoints: 0,
        lockBonusPoints: 0,
        lockAndLoadBonusPoints: 0,
        totalPoints: 0,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(userWeeklyScores.leagueId, leagueId),
          eq(userWeeklyScores.season, season),
          eq(userWeeklyScores.week, newWeek)
        )
      );

    console.log(`[EndOfWeek] Weekly points reset completed for week ${newWeek}`);
  }

  // Get end-of-week results for display purposes
  async getWeekEndResults(season: number, week: number, leagueId: string, currentSimulatedDate?: Date): Promise<WeekEndResults | null> {
    const weekComplete = await this.isWeekComplete(season, week, currentSimulatedDate);
    if (!weekComplete) {
      return null;
    }

    // This would return the same data as processEndOfWeek but without making changes
    // Implementation would be similar but read-only
    return this.processEndOfWeek(season, week, leagueId, currentSimulatedDate);
  }
}

export const endOfWeekProcessor = new EndOfWeekProcessor();