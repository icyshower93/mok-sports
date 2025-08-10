// Real Mok Sports scoring system based on official game rules
// Calculates points from actual NFL game results

import { db } from "../db";
import { nflGames, nflTeams, weeklyLocks, userWeeklyScores, draftPicks, stables } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// Tank01 API integration for real-time scoring
const TANK01_API_OPTIONS = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Key': '005fffe3bemsh0ccee48c9d8de37p1274c5jsn792f60867fc1',
    'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
  }
};

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
  week: number;
  season: number;
  opponentCode: string;
  teamScore: number;
  opponentScore: number;
  isWin: boolean;
  isTie: boolean;
  isLoss: boolean;
  isBlowout: boolean;      // Won by 20+ points
  isShutout: boolean;      // Held opponent to 0
  isWeeklyHigh: boolean;   // Highest score this week
  isWeeklyLow: boolean;    // Lowest score this week
  baseMokPoints: number;   // Points without lock bonuses
  gameDate: Date;
}

export interface UserWeeklyScore {
  userId: string;
  leagueId: string; 
  week: number;
  season: number;
  teamResults: TeamGameResult[];
  totalBaseMokPoints: number;
  lockedTeam?: string;
  lockAndLoadTeam?: string; 
  lockBonusPoints: number;
  lockAndLoadBonusPoints: number;
  totalMokPoints: number;
}

// Function to update NFL game scores from Tank01 API
export async function updateGameScoresFromTank01(week: number, season: number = 2024): Promise<void> {
  try {
    console.log(`[Tank01 Scoring] Updating scores for Week ${week} of ${season}...`);
    
    const response = await fetch(
      `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGamesForWeek?seasonType=reg&week=${week}&season=${season}`,
      TANK01_API_OPTIONS
    );
    
    if (!response.ok) {
      throw new Error(`Tank01 API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.statusCode === 200 && data.body && data.body.length > 0) {
      const games = data.body;
      console.log(`[Tank01 Scoring] Found ${games.length} games for Week ${week}`);
      
      // Update each game in our database
      for (const game of games) {
        if (game.gameStatus === 'Final') {
          // Parse the score from Tank01 data - need to extract from game details
          // Tank01 doesn't include scores in the basic endpoint, need to fetch individual game
          // For now, we'll mark the game as completed and handle scoring separately
          
          const awayTeam = game.away === 'WSH' ? 'WAS' : game.away; // Handle Washington mapping
          const homeTeam = game.home === 'WSH' ? 'WAS' : game.home;
          
          // Update game completion status
          await db
            .update(nflGames)
            .set({ 
              isCompleted: true, 
              updatedAt: new Date() 
            })
            .where(
              and(
                eq(nflGames.week, week),
                eq(nflGames.season, season),
                sql`EXISTS (
                  SELECT 1 FROM nfl_teams ht WHERE ht.id = ${nflGames.homeTeamId} AND ht.code = ${homeTeam}
                ) AND EXISTS (
                  SELECT 1 FROM nfl_teams at WHERE at.id = ${nflGames.awayTeamId} AND at.code = ${awayTeam}  
                )`
              )
            );
        }
      }
      
      console.log(`[Tank01 Scoring] Updated completion status for Week ${week} games`);
    }
  } catch (error) {
    console.error(`[Tank01 Scoring] Error updating scores:`, error);
    throw error;
  }
}

// Calculate base Mok points for a team's game result
export function calculateBaseMokPoints(result: TeamGameResult): number {
  const rules = MOK_SCORING_RULES;
  let points = 0;
  
  // Base game result points
  if (result.isWin) points += rules.winPoints;
  else if (result.isTie) points += rules.tiePoints;
  // Losses get 0 points
  
  // Bonus points
  if (result.isBlowout) points += rules.blowoutPoints;
  if (result.isShutout) points += rules.shutoutPoints;
  if (result.isWeeklyHigh) points += rules.weeklyHighPoints;
  if (result.isWeeklyLow) points += rules.weeklyLowPenalty;
  
  return points;
}

// Calculate lock bonus points
export function calculateLockPoints(result: TeamGameResult, isLocked: boolean, isLockAndLoad: boolean): number {
  const rules = MOK_SCORING_RULES;
  let lockPoints = 0;
  
  if (isLocked && !isLockAndLoad) {
    // Regular lock: +1 bonus regardless of outcome
    lockPoints += rules.lockBonusPoints;
  } else if (isLockAndLoad) {
    // Lock & Load: +2 for win, -1 for loss, 0 for tie
    if (result.isWin) {
      lockPoints += rules.lockAndLoadWinPoints;
    } else if (result.isLoss) {
      lockPoints += rules.lockAndLoadLossPenalty; // This is -1
    }
    // Ties get no lock and load bonus/penalty
  }
  
  return lockPoints;
}

// Get NFL game results for a specific week and season
export async function getNFLGameResults(week: number, season: number): Promise<TeamGameResult[]> {
  // This would integrate with real NFL data API
  // For now, return empty array since we need to implement NFL data source
  console.log(`🏈 [MokScoring] Getting NFL results for Week ${week}, ${season}`);
  
  // TODO: Integrate with NFL API (ESPN, NFL.com, or similar)
  // This is where we'd fetch real game data
  return [];
}

// Calculate weekly scores for all users in a league
export async function calculateWeeklyScores(leagueId: string, week: number, season: number): Promise<UserWeeklyScore[]> {
  console.log(`📊 [MokScoring] Calculating scores for league ${leagueId}, Week ${week}, ${season}`);
  
  // Get all users in the league and their teams
  const userStables = await db
    .select({
      userId: stables.userId,
      nflTeamCode: stables.nflTeamId, // Note: This should be joined with nflTeams to get the code
      locksUsed: stables.locksUsed,
      lockAndLoadUsed: stables.lockAndLoadUsed
    })
    .from(stables)
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
    
    // TODO: Get user's lock selections for this week from database
    const lockedTeam = undefined; // Would come from user's weekly lock selection
    const lockAndLoadTeam = undefined; // Would come from user's weekly lock & load selection
    
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
      }
    }
    
    const userScore: UserWeeklyScore = {
      userId,
      leagueId,
      week,
      season,
      teamResults: userResults,
      totalBaseMokPoints,
      lockedTeam,
      lockAndLoadTeam,
      lockBonusPoints,
      lockAndLoadBonusPoints,
      totalMokPoints: totalBaseMokPoints + lockBonusPoints + lockAndLoadBonusPoints
    };
    
    userScores.push(userScore);
  }
  
  console.log(`📊 [MokScoring] Calculated scores for ${userScores.length} users`);
  return userScores;
}

// Calculate season standings
export async function calculateSeasonStandings(leagueId: string, season: number, throughWeek: number): Promise<any> {
  console.log(`🏆 [MokScoring] Calculating standings for league ${leagueId}, ${season} through Week ${throughWeek}`);
  
  // This would aggregate all weekly scores for the season
  // For now, return empty standings structure
  
  const standings = {
    leagueId,
    season,
    throughWeek,
    standings: [],
    totalGamesPlayed: 0,
    averagePointsPerWeek: 0
  };
  
  console.log(`🏆 [MokScoring] Standings calculated for ${standings.standings.length} users`);
  return standings;
}

// Validate lock usage against season limits
export async function validateLockUsage(userId: string, leagueId: string, nflTeamId: string, lockType: 'lock' | 'lockAndLoad'): Promise<{ valid: boolean; reason?: string }> {
  console.log(`🔒 [MokScoring] Validating ${lockType} usage for user ${userId}, team ${nflTeamId}`);
  
  // Check current usage from stable table
  const [stable] = await db
    .select()
    .from(stables)
    .where(
      and(
        eq(stables.userId, userId),
        eq(stables.leagueId, leagueId),
        eq(stables.nflTeamId, nflTeamId)
      )
    );
    
  if (!stable) {
    return { valid: false, reason: "You don't own this team" };
  }
  
  const rules = MOK_SCORING_RULES;
  
  if (lockType === 'lock') {
    if (stable.locksUsed >= rules.maxLocksPerTeamPerSeason) {
      return { valid: false, reason: `You've already used ${stable.locksUsed}/${rules.maxLocksPerTeamPerSeason} regular locks for this team` };
    }
  } else if (lockType === 'lockAndLoad') {
    if (stable.lockAndLoadUsed) {
      return { valid: false, reason: "You've already used Lock & Load for this team this season" };
    }
  }
  
  return { valid: true };
}

// Export for backward compatibility with existing mock system
export { generateTeamPerformanceData } from './mockScoring.js';