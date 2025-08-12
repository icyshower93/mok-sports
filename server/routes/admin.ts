import { Express } from 'express';
import { db } from '../db';
import { nflGames, nflTeams, userWeeklyScores, stables, users, leagues, weeklyLocks, weeklySkins, leagueMembers } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { nflDataService } from '../services/nflDataService';
import { calculateBaseMokPoints } from '../utils/mokScoring';
import { endOfWeekProcessor } from '../utils/endOfWeekProcessor';

// Simple admin state management - 2024 season for testing
let adminState = {
  currentDate: new Date('2024-09-04'), // Testing: Start from September 4, 2024
  gamesProcessedToday: 0,
  totalGamesProcessed: 0,
  totalGames: 272,
  currentWeek: 1,
  processingInProgress: false,
  season: 2024 // 2024 season for testing with authentic NFL data
};



// Authentic 2024 NFL Week 1 scores for testing
function get2024Week1Scores(awayTeam: string, homeTeam: string, gameDate: Date): { homeScore: number, awayScore: number } | null {
  const dateStr = gameDate.toISOString().split('T')[0];
  
  // Week 1 2024 authentic NFL scores
  const week1Scores: Record<string, { homeScore: number, awayScore: number }> = {
    // Thursday 9/5
    'BAL@KC': { homeScore: 27, awayScore: 20 },
    // Friday 9/6
    'PHI@GB': { homeScore: 29, awayScore: 34 },
    // Sunday 9/8 Early
    'ARI@BUF': { homeScore: 34, awayScore: 28 },
    'NE@CIN': { homeScore: 16, awayScore: 10 },
    'IND@HOU': { homeScore: 29, awayScore: 27 },
    'JAX@MIA': { homeScore: 20, awayScore: 17 },
    'NYG@MIN': { homeScore: 28, awayScore: 6 },
    'CAR@NO': { homeScore: 47, awayScore: 10 },
    'CHI@TEN': { homeScore: 24, awayScore: 17 },
    'PIT@ATL': { homeScore: 18, awayScore: 10 },
    // Sunday 9/8 Late
    'LAC@LV': { homeScore: 22, awayScore: 10 },
    'DEN@SEA': { homeScore: 26, awayScore: 20 },
    'DAL@CLE': { homeScore: 33, awayScore: 17 },
    'WSH@TB': { homeScore: 37, awayScore: 20 },
    'DET@LAR': { homeScore: 26, awayScore: 20 },
    // Monday 9/9
    'SF@NYJ': { homeScore: 19, awayScore: 32 }
  };
  
  const gameKey = `${awayTeam}@${homeTeam}`;
  return week1Scores[gameKey] || null;
}

// Calculate current week based on date - 2024 season for testing
function calculateWeekFromDate(date: Date): number {
  const seasonStart = new Date(`${adminState.season}-09-04`); // NFL season typically starts first Thursday of September
  const diffDays = Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // NFL weeks: Thursday start (Week 1), then Sunday-Monday cycles
  if (diffDays < 0) return 1; // Before season starts
  if (diffDays < 4) return 1;  // Sept 4-7: Week 1 (Thu-Sun)
  if (diffDays < 11) return 2; // Sept 8-14: Week 2
  if (diffDays < 18) return 3; // Sept 15-21: Week 3
  if (diffDays < 25) return 4; // Sept 22-28: Week 4
  
  // Standard 7-day weeks after Week 4
  return Math.max(1, Math.min(18, Math.floor((diffDays - 4) / 7) + 2));
}

// Update admin state by fetching from database
async function updateAdminState() {
  try {
    // Get total games count for current season
    const totalGamesResult = await db
      .select({ count: sql`count(*)` })
      .from(nflGames)
      .where(eq(nflGames.season, adminState.season));
    
    adminState.totalGames = Number(totalGamesResult[0]?.count) || 272;

    // Get completed games count for current season
    const completedGamesResult = await db
      .select({ count: sql`count(*)` })
      .from(nflGames)
      .where(and(
        eq(nflGames.season, adminState.season),
        eq(nflGames.isCompleted, true)
      ));

    adminState.totalGamesProcessed = Number(completedGamesResult[0]?.count) || 0;

    // Calculate current week
    adminState.currentWeek = calculateWeekFromDate(adminState.currentDate);

    // Get games processed today
    const todayStart = new Date(adminState.currentDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(adminState.currentDate);
    todayEnd.setHours(23, 59, 59, 999);

    const todayGamesResult = await db
      .select({ count: sql`count(*)` })
      .from(nflGames)
      .where(and(
        eq(nflGames.season, adminState.season),
        gte(nflGames.gameDate, todayStart),
        lte(nflGames.gameDate, todayEnd),
        eq(nflGames.isCompleted, true)
      ));

    adminState.gamesProcessedToday = Number(todayGamesResult[0]?.count) || 0;

  } catch (error) {
    console.error('Failed to update admin state:', error);
  }
}

// Process games for a specific date
async function processGamesForDate(targetDate: Date): Promise<number> {
  try {
    console.log(`🎮 Processing games for ${targetDate.toISOString().split('T')[0]}`);
    
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get games scheduled for this specific date that aren't completed
    const games = await db
      .select({
        id: nflGames.id,
        season: nflGames.season,
        week: nflGames.week,
        gameDate: nflGames.gameDate,
        homeTeamId: nflGames.homeTeamId,
        awayTeamId: nflGames.awayTeamId,
        homeScore: nflGames.homeScore,
        awayScore: nflGames.awayScore,
        isCompleted: nflGames.isCompleted,
        homeTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.homeTeamId})`,
        awayTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.awayTeamId})`
      })
      .from(nflGames)
      .where(and(
        eq(nflGames.season, adminState.season),
        sql`DATE(${nflGames.gameDate}) = DATE(${dayStart})`,
        eq(nflGames.isCompleted, false)
      ));

    console.log(`Found ${games.length} games to process for ${targetDate.toISOString().split('T')[0]}`);

    let processedCount = 0;

    for (const game of games) {
      try {
        // Create Tank01 game ID format: YYYYMMDD_AWAY@HOME
        const dateStr = game.gameDate.toISOString().split('T')[0].replace(/-/g, '');
        const gameID = `${dateStr}_${game.awayTeamCode}@${game.homeTeamCode}`;
        
        console.log(`🏈 Processing ${game.awayTeamCode} @ ${game.homeTeamCode} (${gameID})`);

        // Try to get box score from Tank01 API
        const boxScore = await nflDataService.getGameBoxScore(gameID);
        
        let homeScore = 0;
        let awayScore = 0;
        let foundScores = false;

        if (boxScore && boxScore.homeTeam && boxScore.awayTeam) {
          homeScore = parseInt(boxScore.homeTeam.teamStats?.totalPoints || boxScore.homeTeam.totalPts || '0');
          awayScore = parseInt(boxScore.awayTeam.teamStats?.totalPoints || boxScore.awayTeam.totalPts || '0');
          
          if (homeScore > 0 || awayScore > 0) {
            foundScores = true;
            console.log(`✅ Found scores via box score: ${game.awayTeamCode} ${awayScore}, ${game.homeTeamCode} ${homeScore}`);
          }
        }

        // If no scores from box score, try daily games API
        if (!foundScores) {
          const dailyGames = await nflDataService.getGamesForDate(dateStr);
          
          for (const apiGame of dailyGames) {
            if ((apiGame.awayTeam === game.awayTeamCode || apiGame.away === game.awayTeamCode) && 
                (apiGame.homeTeam === game.homeTeamCode || apiGame.home === game.homeTeamCode)) {
              homeScore = parseInt(apiGame.homePts || apiGame.homeScore || '0');
              awayScore = parseInt(apiGame.awayPts || apiGame.awayScore || '0');
              
              if (homeScore > 0 || awayScore > 0) {
                foundScores = true;
                console.log(`✅ Found scores via daily games: ${game.awayTeamCode} ${awayScore}, ${game.homeTeamCode} ${homeScore}`);
                break;
              }
            }
          }
        }

        // For 2024 testing season, always use authentic NFL scores since Tank01 may not have historical data
        if (adminState.season === 2024) {
          const authentic2024Scores = get2024Week1Scores(game.awayTeamCode, game.homeTeamCode, game.gameDate);
          if (authentic2024Scores) {
            homeScore = authentic2024Scores.homeScore;
            awayScore = authentic2024Scores.awayScore;
            foundScores = true;
            console.log(`🏈 Using authentic 2024 scores for ${game.awayTeamCode} @ ${game.homeTeamCode}: ${awayScore}-${homeScore}`);
          }
        }

        // Only update game in database if we found actual scores
        if (foundScores) {
          await db
            .update(nflGames)
            .set({
              homeScore,
              awayScore,
              isCompleted: true,
              winnerTeamId: homeScore > awayScore ? game.homeTeamId : 
                           awayScore > homeScore ? game.awayTeamId : null,
              isTie: homeScore === awayScore && homeScore > 0
            })
            .where(eq(nflGames.id, game.id));

          // Calculate and update Mok points for this game
          await calculateAndUpdateMokPoints(game.id.toString(), game.season, game.week, homeScore, awayScore, game.homeTeamId, game.awayTeamId, game.homeTeamCode, game.awayTeamCode);

          processedCount++;
          console.log(`✅ Updated game: ${game.awayTeamCode} ${awayScore} - ${homeScore} ${game.homeTeamCode}`);
        }

        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing game ${game.awayTeamCode} @ ${game.homeTeamCode}:`, error);
      }
    }

    console.log(`🎯 Processed ${processedCount} games for ${targetDate.toISOString().split('T')[0]}`);
    return processedCount;

  } catch (error) {
    console.error('Error processing games for date:', error);
    return 0;
  }
}

// Calculate and update Mok points for a completed game
async function calculateAndUpdateMokPoints(
  gameId: string, 
  season: number, 
  week: number, 
  homeScore: number, 
  awayScore: number, 
  homeTeamId: number, 
  awayTeamId: number,
  homeTeamCode: string,
  awayTeamCode: string
) {
  try {
    console.log(`🎯 Calculating Mok points for ${awayTeamCode} @ ${homeTeamCode}: ${awayScore}-${homeScore}`);

    // Get all users who own these teams
    const teamOwners = await db.select({
      userId: stables.userId,
      userName: users.name,
      leagueId: stables.leagueId,
      teamId: stables.nflTeamId,
      teamCode: nflTeams.code
    })
    .from(stables)
    .innerJoin(users, eq(stables.userId, users.id))
    .innerJoin(nflTeams, eq(stables.nflTeamId, nflTeams.id))
    .where(sql`${stables.nflTeamId} IN (${homeTeamId}, ${awayTeamId})`);

    console.log(`Found ${teamOwners.length} team owners for this game`);

    // Calculate points for each team owner
    for (const owner of teamOwners) {
      const isHomeTeam = owner.teamId === homeTeamId;
      const teamScore = isHomeTeam ? homeScore : awayScore;
      const opponentScore = isHomeTeam ? awayScore : homeScore;

      // Create team game result
      const teamResult = {
        teamCode: owner.teamCode,
        opponentCode: isHomeTeam ? awayTeamCode : homeTeamCode,
        teamScore,
        opponentScore,
        week,
        season,
        gameDate: new Date(),
        baseMokPoints: 0,
        isWin: teamScore > opponentScore,
        isLoss: teamScore < opponentScore,
        isTie: teamScore === opponentScore,
        isBlowout: (teamScore > opponentScore) && (teamScore - opponentScore >= 20),
        isShutout: opponentScore === 0,
        isWeeklyHigh: false, // calculated at week end
        isWeeklyLow: false   // calculated at week end
      };

      // Calculate base game result points
      const basePoints = calculateBaseMokPoints(teamResult);
      
      // Check for lock bonuses
      const lockData = await db.select({
        lockedTeamId: weeklyLocks.lockedTeamId,
        lockAndLoadTeamId: weeklyLocks.lockAndLoadTeamId
      })
      .from(weeklyLocks)
      .where(and(
        eq(weeklyLocks.userId, owner.userId),
        eq(weeklyLocks.leagueId, owner.leagueId),
        eq(weeklyLocks.week, week),
        eq(weeklyLocks.season, season)
      ));
      
      const userLock = lockData[0];
      const isLocked = userLock?.lockedTeamId === owner.teamId;
      const isLockAndLoad = userLock?.lockAndLoadTeamId === owner.teamId;
      
      let lockBonusPoints = 0;
      let lockAndLoadBonusPoints = 0;
      
      // Check for regular lock bonus first
      if (isLocked) {
        // Regular lock bonus: +1 for wins, +0.5 for ties, +0 for losses
        if (teamResult.isWin) {
          lockBonusPoints = 1;
        } else if (teamResult.isTie) {
          lockBonusPoints = 0.5;
        }
      }
      
      // Check for lock-and-load bonus (additional +1/-1 on top of lock)
      if (isLockAndLoad) {
        // Lock & Load additional scoring: +1 for win, -1 for loss, +0 for tie
        if (teamResult.isWin) {
          lockAndLoadBonusPoints = 1;
        } else if (teamResult.isLoss) {
          lockAndLoadBonusPoints = -1;
        }
        // No additional points for ties (just the lock bonus)
      }
      
      const totalPoints = basePoints + lockBonusPoints + lockAndLoadBonusPoints;

      const lockInfo = isLockAndLoad ? 'LOAD' : isLocked ? 'LOCK' : '';
      console.log(`${owner.userName} (${owner.teamCode}): ${totalPoints} points (${teamScore}-${opponentScore}) ${lockInfo} [Base: ${basePoints}, Lock: ${lockBonusPoints}, L&L: ${lockAndLoadBonusPoints}] - Locked=${isLocked}, Load=${isLockAndLoad}`);

      // Update or insert weekly scores
      await db.insert(userWeeklyScores)
        .values({
          userId: owner.userId,
          leagueId: owner.leagueId,
          season,
          week,
          basePoints: basePoints,
          lockBonusPoints: lockBonusPoints,
          lockAndLoadBonusPoints: lockAndLoadBonusPoints,
          totalPoints: totalPoints
        })
        .onConflictDoUpdate({
          target: [userWeeklyScores.userId, userWeeklyScores.leagueId, userWeeklyScores.season, userWeeklyScores.week],
          set: {
            basePoints: sql`${userWeeklyScores.basePoints} + ${basePoints}`,
            lockBonusPoints: sql`${userWeeklyScores.lockBonusPoints} + ${lockBonusPoints}`,
            lockAndLoadBonusPoints: sql`${userWeeklyScores.lockAndLoadBonusPoints} + ${lockAndLoadBonusPoints}`,
            totalPoints: sql`${userWeeklyScores.totalPoints} + ${totalPoints}`,
            updatedAt: new Date()
          }
        });
    }

    // Check if this is the last game of the week to calculate high/low bonuses
    await checkAndCalculateWeeklyBonuses(season, week);

  } catch (error) {
    console.error('Error calculating Mok points:', error);
  }
}

// Check if week is complete and calculate weekly high/low bonuses
async function checkAndCalculateWeeklyBonuses(season: number, week: number) {
  try {
    // Get all games for this week
    const weekGames = await db.select().from(nflGames).where(
      and(
        eq(nflGames.season, season),
        eq(nflGames.week, week)
      )
    );

    // Check if week is complete using the corrected logic that considers simulated date
    const { endOfWeekProcessor } = await import("../utils/endOfWeekProcessor.js");
    const weekComplete = await endOfWeekProcessor.isWeekComplete(season, week, adminState.currentDate);
    
    console.log(`Week ${week}: ${weekGames.length} total games, week complete: ${weekComplete} (simulated date: ${adminState.currentDate.toISOString()})`);

    // Only calculate weekly bonuses if ALL games of the week are actually completed according to simulated time
    if (weekComplete && weekGames.length > 0) {
      console.log(`🏆 Week ${week} actually completed according to simulated date! Now calculating weekly high/low bonuses...`);
      
      // Find highest and lowest scoring NFL teams this week
      const teamScores = await db.select({
        teamId: nflGames.homeTeamId,
        teamCode: nflTeams.code,
        score: nflGames.homeScore
      })
      .from(nflGames)
      .innerJoin(nflTeams, eq(nflGames.homeTeamId, nflTeams.id))
      .where(and(
        eq(nflGames.season, season),
        eq(nflGames.week, week),
        eq(nflGames.isCompleted, true)
      ))
      .union(
        db.select({
          teamId: nflGames.awayTeamId,
          teamCode: nflTeams.code,
          score: nflGames.awayScore
        })
        .from(nflGames)
        .innerJoin(nflTeams, eq(nflGames.awayTeamId, nflTeams.id))
        .where(and(
          eq(nflGames.season, season),
          eq(nflGames.week, week),
          eq(nflGames.isCompleted, true)
        ))
      );

      if (teamScores.length > 0) {
        // Find highest and lowest team scores
        const sortedScores = teamScores.sort((a, b) => b.score! - a.score!);
        const highestScore = sortedScores[0].score!;
        const lowestScore = sortedScores[sortedScores.length - 1].score!;
        
        console.log(`📊 Week ${week} NFL team scores: High=${highestScore}, Low=${lowestScore}`);
        
        // Find teams with highest and lowest scores
        const highestTeams = teamScores.filter(t => t.score === highestScore);
        const lowestTeams = teamScores.filter(t => t.score === lowestScore);
        
        // Award +1 to users who own highest scoring teams
        for (const team of highestTeams) {
          const teamOwners = await db.select({
            userId: stables.userId,
            leagueId: stables.leagueId
          })
          .from(stables)
          .where(eq(stables.nflTeamId, team.teamId));
          
          for (const owner of teamOwners) {
            await db.update(userWeeklyScores)
              .set({
                totalPoints: sql`${userWeeklyScores.totalPoints} + 1`,
                updatedAt: new Date()
              })
              .where(and(
                eq(userWeeklyScores.userId, owner.userId),
                eq(userWeeklyScores.leagueId, owner.leagueId),
                eq(userWeeklyScores.season, season),
                eq(userWeeklyScores.week, week)
              ));
            
            console.log(`🏆 +1 bonus for owning ${team.teamCode} (${highestScore} pts)`);
          }
        }
        
        // Apply -1 penalty to users who own lowest scoring teams
        for (const team of lowestTeams) {
          const teamOwners = await db.select({
            userId: stables.userId,
            leagueId: stables.leagueId
          })
          .from(stables)
          .where(eq(stables.nflTeamId, team.teamId));
          
          for (const owner of teamOwners) {
            await db.update(userWeeklyScores)
              .set({
                totalPoints: sql`${userWeeklyScores.totalPoints} - 1`,
                updatedAt: new Date()
              })
              .where(and(
                eq(userWeeklyScores.userId, owner.userId),
                eq(userWeeklyScores.leagueId, owner.leagueId),
                eq(userWeeklyScores.season, season),
                eq(userWeeklyScores.week, week)
              ));
            
            console.log(`💥 -1 penalty for owning ${team.teamCode} (${lowestScore} pts)`);
          }
        }

        // Get updated weekly scores for skins calculation
        const weeklyScores = await db.select({
          userId: userWeeklyScores.userId,
          leagueId: userWeeklyScores.leagueId,
          totalPoints: userWeeklyScores.totalPoints
        })
        .from(userWeeklyScores)
        .where(and(
          eq(userWeeklyScores.season, season),
          eq(userWeeklyScores.week, week)
        ))
        .orderBy(sql`${userWeeklyScores.totalPoints} DESC`);

        // Award weekly skins to highest scorers (after bonuses applied)
        const highScoreUsers = weeklyScores.filter(s => s.totalPoints === weeklyScores[0].totalPoints);
        await awardWeeklySkins(season, week, highScoreUsers);
        
        console.log(`✅ Applied NFL team-based weekly bonuses: High (${highestScore}) to ${highestTeams.length} teams, Low (${lowestScore}) to ${lowestTeams.length} teams`);
      }
    }
  } catch (error) {
    console.error('Error calculating weekly bonuses:', error);
  }
}

export function registerAdminRoutes(app: Express) {
  // Initialize admin state on startup
  updateAdminState();

  // Get current admin state
  app.get('/api/admin/state', async (req, res) => {
    try {
      await updateAdminState();
      
      res.json({
        currentDate: adminState.currentDate.toISOString(),
        gamesProcessedToday: adminState.gamesProcessedToday,
        totalGamesProcessed: adminState.totalGamesProcessed,
        totalGames: adminState.totalGames,
        currentWeek: adminState.currentWeek,
        processingInProgress: adminState.processingInProgress,
        season: adminState.season
      });
    } catch (error) {
      console.error('Error getting admin state:', error);
      res.status(500).json({ error: 'Failed to get admin state' });
    }
  });

  // Advance one day forward
  app.post('/api/admin/advance-day', async (req, res) => {
    try {
      if (adminState.processingInProgress) {
        return res.status(409).json({ error: 'Processing already in progress' });
      }

      adminState.processingInProgress = true;
      
      // Move to next day
      const nextDay = new Date(adminState.currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      adminState.currentDate = nextDay;

      console.log(`📅 Advanced to ${nextDay.toISOString().split('T')[0]}`);

      // Process games for the new current date (games scheduled for this exact date)
      const processedCount = await processGamesForDate(adminState.currentDate);
      
      // Check if week has changed and handle week progression
      const newWeek = calculateWeekFromDate(adminState.currentDate);
      if (newWeek !== adminState.currentWeek) {
        console.log(`📈 Week progression: ${adminState.currentWeek} → ${newWeek}`);
        await handleWeekProgression(adminState.currentWeek, newWeek, adminState.season);
        adminState.currentWeek = newWeek;
      }
      
      // Update state
      await updateAdminState();
      adminState.processingInProgress = false;

      // Broadcast update to all connected clients to refresh scores
      const draftManager = (global as any).draftManager;
      console.log('[Admin] Broadcasting admin_date_advanced to all connected clients');
      console.log('[Admin] DraftManager available:', !!draftManager);
      console.log('[Admin] DraftManager.broadcast available:', !!(draftManager && draftManager.broadcast));
      
      if (draftManager && draftManager.broadcast) {
        draftManager.broadcast({
          type: 'admin_date_advanced',
          data: {
            newDate: adminState.currentDate.toISOString(),
            gamesProcessed: processedCount,
            currentWeek: adminState.currentWeek
          }
        });
        console.log('[Admin] ✅ Broadcast sent for admin_date_advanced');
      } else {
        console.log('[Admin] ❌ Could not broadcast - draftManager or broadcast not available');
      }

      res.json({
        success: true,
        newDate: adminState.currentDate.toISOString(),
        gamesProcessed: processedCount,
        message: `Advanced to ${adminState.currentDate.toISOString().split('T')[0]}, processed ${processedCount} games`
      });

    } catch (error) {
      console.error('Error advancing day:', error);
      adminState.processingInProgress = false;
      res.status(500).json({ error: 'Failed to advance day' });
    }
  });

  // Reset season to beginning of current season
  app.post('/api/admin/reset-season', async (req, res) => {
    try {
      if (adminState.processingInProgress) {
        return res.status(409).json({ error: 'Processing in progress, cannot reset' });
      }

      adminState.processingInProgress = true;

      console.log(`🔄 Resetting ${adminState.season} season to September 4...`);

      // Clear all weekly scores for current season
      await db
        .delete(userWeeklyScores)
        .where(eq(userWeeklyScores.season, adminState.season));

      console.log(`🧹 Cleared all weekly scores for ${adminState.season} season`);

      // Reset all games to uncompleted with 0 scores for current season
      await db
        .update(nflGames)
        .set({
          homeScore: 0,
          awayScore: 0,
          isCompleted: false,
          isTie: false,
          winnerTeamId: null
        })
        .where(eq(nflGames.season, adminState.season));

      // Reset admin state to current season start
      adminState.currentDate = new Date(`${adminState.season}-09-04`);
      adminState.gamesProcessedToday = 0;
      adminState.currentWeek = 1;

      await updateAdminState();
      adminState.processingInProgress = false;

      console.log('✅ Season reset completed');

      // Broadcast reset to all connected clients to refresh scores page
      const draftManager = (global as any).draftManager;
      console.log('[Admin] Broadcasting admin_season_reset to all connected clients');
      console.log('[Admin] DraftManager available:', !!draftManager);
      console.log('[Admin] DraftManager.broadcast available:', !!(draftManager && draftManager.broadcast));
      
      if (draftManager && draftManager.broadcast) {
        draftManager.broadcast({
          type: 'admin_season_reset',
          data: {
            newDate: adminState.currentDate.toISOString(),
            season: adminState.season,
            totalGamesReset: adminState.totalGames
          }
        });
        console.log('[Admin] ✅ Broadcast sent for admin_season_reset');
      } else {
        console.log('[Admin] ❌ Could not broadcast - draftManager or broadcast not available');
      }

      res.json({
        success: true,
        message: `Season reset to September 4, ${adminState.season}`,
        currentDate: adminState.currentDate.toISOString(),
        season: adminState.season,
        totalGamesReset: adminState.totalGames
      });

    } catch (error) {
      console.error('Error resetting season:', error);
      adminState.processingInProgress = false;
      res.status(500).json({ error: 'Failed to reset season' });
    }
  });

  // Get current week and season info for frontend
  app.get("/api/admin/current-week", async (req, res) => {
    try {
      await updateAdminState();
      
      res.json({
        currentWeek: adminState.currentWeek,
        season: adminState.season,
        currentDate: adminState.currentDate.toISOString()
      });
    } catch (error) {
      console.error('Error getting current week:', error);
      res.status(500).json({ message: "Failed to get current week" });
    }
  });

  // Manual weekly bonus calculation route for testing
  app.post('/api/admin/recalculate-weekly-bonuses', async (req, res) => {
    try {
      const { season, week } = req.body;
      
      if (!season || !week) {
        return res.status(400).json({ error: 'Season and week are required' });
      }
      
      await checkAndCalculateWeeklyBonuses(season, week);
      
      res.json({
        success: true,
        message: `Recalculated weekly bonuses for Season ${season}, Week ${week}`
      });
    } catch (error) {
      console.error('Error recalculating weekly bonuses:', error);
      res.status(500).json({ error: 'Failed to recalculate weekly bonuses' });
    }
  });

  // Removed season switching - focus on 2024 testing season only
  console.log('Admin routes registered successfully');
}

// Handle week progression when date advances to a new week
async function handleWeekProgression(oldWeek: number, newWeek: number, season: number) {
  try {
    console.log(`🏁 Finalizing Week ${oldWeek} and starting Week ${newWeek}`);
    
    // Ensure final week bonuses are calculated
    await checkAndCalculateWeeklyBonuses(season, oldWeek);
    
    // Initialize user weekly scores for the new week (all users start at 0)
    await initializeNewWeekScores(season, newWeek);
    
    console.log(`✅ Week progression complete: ${oldWeek} → ${newWeek}`);
  } catch (error) {
    console.error('Error handling week progression:', error);
  }
}

// Award weekly skins to the highest scoring users
async function awardWeeklySkins(season: number, week: number, highScoreUsers: any[]) {
  try {
    if (highScoreUsers.length === 0) return;
    
    // Group by league
    const leagueGroups = highScoreUsers.reduce((groups, user) => {
      if (!groups[user.leagueId]) groups[user.leagueId] = [];
      groups[user.leagueId].push(user);
      return groups;
    }, {} as Record<string, any[]>);
    
    // Award skins for each league
    for (const [leagueId, winners] of Object.entries(leagueGroups)) {
      const isTied = winners.length > 1;
      const winningScore = winners[0].totalPoints + 1; // After high score bonus
      
      for (const winner of winners) {
        await db.insert(weeklySkins)
          .values({
            leagueId,
            season,
            week,
            winnerId: winner.userId,
            winningScore,
            prizeAmount: 30, // $30 prize
            isTied,
            awardedAt: new Date()
          })
          .onConflictDoNothing(); // Prevent duplicates
      }
      
      console.log(`🏆 Awarded Week ${week} skins to ${winners.length} winner(s) in league ${leagueId} (${winningScore} pts${isTied ? ', tied' : ''})`);
    }
  } catch (error) {
    console.error('Error awarding weekly skins:', error);
  }
}

// Initialize weekly scores for all users in active leagues for new week
async function initializeNewWeekScores(season: number, week: number) {
  try {
    // Get all league members (not just creators)  
    const allLeagueMembers = await db.select({
      userId: leagueMembers.userId,
      leagueId: leagueMembers.leagueId
    })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .where(eq(leagues.isActive, true));
    
    // Initialize scores for all members
    for (const member of allLeagueMembers) {
      await db.insert(userWeeklyScores)
        .values({
          userId: member.userId,
          leagueId: member.leagueId,
          season,
          week,
          basePoints: 0,
          lockBonusPoints: 0,
          lockAndLoadBonusPoints: 0,
          totalPoints: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoNothing(); // Skip if already exists
    }
    
    console.log(`📊 Initialized Week ${week} scores for ${allLeagueMembers.length} league members`);
  } catch (error) {
    console.error('Error initializing new week scores:', error);
  }
}

// Export function to get admin state
export function getAdminState() {
  return adminState;
}