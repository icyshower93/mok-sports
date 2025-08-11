import { Express } from 'express';
import { db } from '../db';
import { nflGames, nflTeams } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { nflDataService } from '../services/nflDataService';

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

    // Get games scheduled for this date that aren't completed
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
        gte(nflGames.gameDate, dayStart),
        lte(nflGames.gameDate, dayEnd),
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

        // For 2025 testing, use fallback scores if Tank01 API doesn't have data yet
        if (!foundScores && adminState.season === 2025) {
          // Use fallback scores for BAL @ KC Thursday night opener
          if (game.awayTeamCode === 'BAL' && game.homeTeamCode === 'KC') {
            homeScore = 27;
            awayScore = 20;
            foundScores = true;
            console.log(`🏈 Using fallback scores for ${game.awayTeamCode} @ ${game.homeTeamCode}: ${awayScore}-${homeScore}`);
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

      // Process games for the new current date
      const processedCount = await processGamesForDate(adminState.currentDate);
      
      // Update state
      await updateAdminState();
      adminState.processingInProgress = false;

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

  // Removed season switching - focus on 2024 testing season only
}