// Real Mok Sports scoring system based on official game rules
// Calculates points from actual NFL game results

import { db } from "../db";
import { nflGames, nflTeams, weeklyLocks, userWeeklyScores, draftPicks, stables } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface MokScoringRules {
  // Base scoring
  winPoints: number;     // +1 for wins
  tiePoints: number;     // +0.5 for ties
  lossPoints: number;    // 0 for losses
  
  // Bonus scoring  
  blowoutPoints: number;   // +1 for winning by 20+ points
  shutoutPoints: number;   // +1 for holding opponent to 0 points
  weeklyHighPoints: number; // +1 for highest scoring team of the week
  weeklyLowPenalty: number; // -1 for lowest scoring team of the week
  
  // Lock system
  lockBonusPoints: number;      // +1 additional when locking a team
  lockAndLoadWinPoints: number; // +2 for Lock & Load win
  lockAndLoadLossPenalty: number; // -1 for Lock & Load loss
  
  // Usage limits
  maxLocksPerTeamPerSeason: number; // 4 times max per team
  maxLockAndLoadPerTeamPerSeason: number; // 1 time max per team
}

// Official Mok Sports scoring rules
export const MOK_SCORING_RULES: MokScoringRules = {
  winPoints: 1,
  tiePoints: 0.5,
  lossPoints: 0,
  blowoutPoints: 1,
  shutoutPoints: 1,
  weeklyHighPoints: 1,
  weeklyLowPenalty: -1,
  lockBonusPoints: 1,
  lockAndLoadWinPoints: 2,
  lockAndLoadLossPenalty: -1,
  maxLocksPerTeamPerSeason: 4,
  maxLockAndLoadPerTeamPerSeason: 1
};

export interface TeamGameResult {
  teamCode: string;
  opponentCode: string;
  teamScore: number;
  opponentScore: number;
  week: number;
  season: number;
  gameDate: Date | null;
  baseMokPoints: number;
  isWin: boolean;
  isLoss: boolean;
  isTie: boolean;
  isBlowout: boolean;
  isShutout: boolean;
  isWeeklyHigh: boolean;
  isWeeklyLow: boolean;
}

export interface UserWeeklyScore {
  userId: string;
  leagueId: string;
  week: number;
  season: number;
  totalPoints: number;
  basePoints: number;
  lockBonusPoints: number;
  lockAndLoadBonusPoints: number;
}

// Calculate ONLY the core game result points (win/tie/loss) - NO bonuses
export function calculateTrueBaseMokPoints(result: TeamGameResult): number {
  if (result.isWin) {
    return MOK_SCORING_RULES.winPoints; // 1 point
  } else if (result.isTie) {
    return MOK_SCORING_RULES.tiePoints; // 0.5 points
  } else {
    return MOK_SCORING_RULES.lossPoints; // 0 points
  }
}

// Calculate all Mok Sports points including bonuses (for total scoring)
export function calculateBaseMokPoints(result: TeamGameResult): number {
  let points = 0;
  
  // Base points for game result
  if (result.isWin) {
    points += MOK_SCORING_RULES.winPoints;
  } else if (result.isTie) {
    points += MOK_SCORING_RULES.tiePoints;
  } else {
    points += MOK_SCORING_RULES.lossPoints; // 0 points
  }
  
  // Bonus points
  if (result.isBlowout && result.isWin) {
    points += MOK_SCORING_RULES.blowoutPoints;
  }
  
  if (result.isShutout && result.isWin) {
    points += MOK_SCORING_RULES.shutoutPoints;
  }
  
  if (result.isWeeklyHigh) {
    points += MOK_SCORING_RULES.weeklyHighPoints;
  }
  
  if (result.isWeeklyLow) {
    points += MOK_SCORING_RULES.weeklyLowPenalty;
  }
  
  return points;
}

// Calculate lock bonus points
export function calculateLockPoints(result: TeamGameResult, isLocked: boolean, isLockAndLoad: boolean): number {
  let lockPoints = 0;
  
  if (isLockAndLoad) {
    // Lock & Load scoring overrides regular lock
    if (result.isWin) {
      lockPoints += MOK_SCORING_RULES.lockAndLoadWinPoints;
    } else if (result.isLoss) {
      lockPoints += MOK_SCORING_RULES.lockAndLoadLossPenalty;
    }
  } else if (isLocked) {
    // Regular lock bonus (only applies to wins)
    if (result.isWin) {
      lockPoints += MOK_SCORING_RULES.lockBonusPoints;
    }
  }
  
  return lockPoints;
}

// Get NFL game results for a specific week
async function getNFLGameResults(week: number, season: number): Promise<TeamGameResult[]> {
  console.log(`🏈 [MokScoring] Getting NFL results for Week ${week}, ${season}`);
  
  try {
    // Create table aliases for joining teams table twice (home and away teams)
    const homeTeam = alias(nflTeams, "home_team");
    const awayTeam = alias(nflTeams, "away_team");

    const dbGames = await db
      .select({
        id: nflGames.id,
        week: nflGames.week,
        season: nflGames.season,
        gameDate: nflGames.gameDate,
        homeTeamId: nflGames.homeTeamId,
        awayTeamId: nflGames.awayTeamId,
        homeScore: nflGames.homeScore,
        awayScore: nflGames.awayScore,
        isCompleted: nflGames.isCompleted,
        homeTeamCode: homeTeam.code,
        homeTeamName: homeTeam.name,
        homeTeamCity: homeTeam.city,
        awayTeamCode: awayTeam.code,
        awayTeamName: awayTeam.name,
        awayTeamCity: awayTeam.city,
      })
      .from(nflGames)
      .leftJoin(homeTeam, eq(nflGames.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(nflGames.awayTeamId, awayTeam.id))
      .where(and(
        eq(nflGames.week, week), 
        eq(nflGames.season, season),
        eq(nflGames.isCompleted, true)
      ));
    
    console.log(`🏈 [MokScoring] Found ${dbGames.length} completed games in database`);
    
    const teamResults: TeamGameResult[] = [];
    
    for (const game of dbGames) {
      if (game.homeScore !== null && game.awayScore !== null && game.homeTeamCode && game.awayTeamCode) {
        // Add home team result
        const homeResult: TeamGameResult = {
          teamCode: game.homeTeamCode,
          opponentCode: game.awayTeamCode,
          teamScore: game.homeScore,
          opponentScore: game.awayScore,
          week: game.week,
          season: game.season,
          gameDate: game.gameDate,
          baseMokPoints: 0, // Will be calculated later
          isWin: game.homeScore > game.awayScore,
          isLoss: game.homeScore < game.awayScore,
          isTie: game.homeScore === game.awayScore,
          isBlowout: (game.homeScore > game.awayScore) && (game.homeScore - game.awayScore >= 20),
          isShutout: game.awayScore === 0,
          isWeeklyHigh: false, // Will be calculated below
          isWeeklyLow: false   // Will be calculated below
        };
        teamResults.push(homeResult);

        // Add away team result
        const awayResult: TeamGameResult = {
          teamCode: game.awayTeamCode,
          opponentCode: game.homeTeamCode,
          teamScore: game.awayScore,
          opponentScore: game.homeScore,
          week: game.week,
          season: game.season,
          gameDate: game.gameDate,
          baseMokPoints: 0, // Will be calculated later
          isWin: game.awayScore > game.homeScore,
          isLoss: game.awayScore < game.homeScore,
          isTie: game.awayScore === game.homeScore,
          isBlowout: (game.awayScore > game.homeScore) && (game.awayScore - game.homeScore >= 20),
          isShutout: game.homeScore === 0,
          isWeeklyHigh: false, // Will be calculated below
          isWeeklyLow: false   // Will be calculated below
        };
        teamResults.push(awayResult);
      }
    }
    
    // Calculate weekly highs and lows
    if (teamResults.length > 0) {
      const maxScore = Math.max(...teamResults.map(r => r.teamScore));
      const minScore = Math.min(...teamResults.map(r => r.teamScore));
      
      // Mark weekly high and low teams
      teamResults.forEach(result => {
        if (result.teamScore === maxScore) {
          result.isWeeklyHigh = true;
        }
        if (result.teamScore === minScore) {
          result.isWeeklyLow = true;
        }
      });
    }

    console.log(`🏈 [MokScoring] Processed ${teamResults.length} team results from completed games`);
    return teamResults;

  } catch (error) {
    console.error(`❌ [MokScoring] Error fetching NFL results:`, error);
    return [];
  }
}

// Calculate weekly scores for all users in a league
export async function calculateWeeklyScores(leagueId: string, week: number, season: number): Promise<UserWeeklyScore[]> {
  console.log(`📊 [MokScoring] Calculating scores for league ${leagueId}, Week ${week}, ${season}`);
  
  // Get global draft manager for WebSocket broadcasts
  const { globalDraftManager } = await import("../draft/globalDraftManager.js");
  
  // Get all users in the league and their teams
  const userStables = await db
    .select({
      userId: stables.userId,
      nflTeamCode: nflTeams.code,
      locksUsed: stables.locksUsed,
      lockAndLoadUsed: stables.lockAndLoadUsed
    })
    .from(stables)
    .leftJoin(nflTeams, eq(stables.nflTeamId, nflTeams.id))
    .where(eq(stables.leagueId, leagueId));
  
  // Get NFL game results for this week
  const gameResults = await getNFLGameResults(week, season);
  
  const userScores: UserWeeklyScore[] = [];
  
  // Group stables by user
  const userTeams = userStables.reduce((acc, stable) => {
    if (!acc[stable.userId]) acc[stable.userId] = [];
    acc[stable.userId].push(stable);
    return acc;
  }, {} as Record<string, typeof userStables>);
  
  // Calculate scores for each user
  for (const [userId, teams] of Object.entries(userTeams)) {
    const userResults: TeamGameResult[] = [];
    let totalBaseMokPoints = 0;
    let lockBonusPoints = 0;
    let lockAndLoadBonusPoints = 0;
    
    // Get user's lock selections for this week from database
    const lockedTeamTable = alias(nflTeams, 'lockedTeam');
    const lockAndLoadTeamTable = alias(nflTeams, 'lockAndLoadTeam');
    
    const userLocks = await db
      .select({
        lockedTeamCode: lockedTeamTable.code,
        lockAndLoadTeamCode: lockAndLoadTeamTable.code
      })
      .from(weeklyLocks)
      .leftJoin(lockedTeamTable, eq(weeklyLocks.lockedTeamId, lockedTeamTable.id))
      .leftJoin(lockAndLoadTeamTable, eq(weeklyLocks.lockAndLoadTeamId, lockAndLoadTeamTable.id))
      .where(
        and(
          eq(weeklyLocks.userId, userId),
          eq(weeklyLocks.leagueId, leagueId),
          eq(weeklyLocks.week, week),
          eq(weeklyLocks.season, season)
        )
      );
    
    const lockData = userLocks[0];
    const lockedTeam = lockData?.lockedTeamCode;
    const lockAndLoadTeam = lockData?.lockAndLoadTeamCode;
    
    console.log(`🔒 [MokScoring] User ${userId}: Locked=${lockedTeam}, Load=${lockAndLoadTeam}`);
    
    // Calculate points for each team the user owns
    for (const team of teams) {
      const teamResult = gameResults.find(r => r.teamCode === team.nflTeamCode);
      if (teamResult) {
        // Calculate base points
        const baseMokPoints = calculateBaseMokPoints(teamResult);
        teamResult.baseMokPoints = baseMokPoints;
        totalBaseMokPoints += baseMokPoints;
        
        // Calculate lock bonuses
        const isLocked = lockedTeam === team.nflTeamCode;
        const isLockAndLoad = lockAndLoadTeam === team.nflTeamCode;
        const lockPoints = calculateLockPoints(teamResult, isLocked, isLockAndLoad);
        
        if (isLocked && !isLockAndLoad) {
          lockBonusPoints += lockPoints;
        } else if (isLockAndLoad) {
          lockAndLoadBonusPoints += lockPoints;
        }
        
        userResults.push(teamResult);
        console.log(`🏈 [MokScoring] ${team.nflTeamCode}: ${baseMokPoints} points (Win: ${teamResult.isWin}, Score: ${teamResult.teamScore})`);
      }
    }
    
    const totalPoints = totalBaseMokPoints + lockBonusPoints + lockAndLoadBonusPoints;
    
    userScores.push({
      userId,
      leagueId,
      week,
      season,
      totalPoints,
      basePoints: totalBaseMokPoints,
      lockBonusPoints,
      lockAndLoadBonusPoints
    });
    
    console.log(`📊 [MokScoring] User ${userId}: ${totalPoints} total points (${totalBaseMokPoints} base + ${lockBonusPoints} lock + ${lockAndLoadBonusPoints} L&L)`);
  }
  
  console.log(`✅ [MokScoring] Calculated scores for ${userScores.length} users`);
  
  // Broadcast score update to all connected clients
  if (globalDraftManager && (globalDraftManager as any).broadcast) {
    (globalDraftManager as any).broadcast({
      type: 'score_update',
      data: {
        leagueId,
        week,
        season,
        usersUpdated: userScores.length,
        timestamp: Date.now()
      }
    });
    console.log(`📡 [MokScoring] Broadcast score_update for league ${leagueId}, week ${week}`);
  }
  
  return userScores;
}