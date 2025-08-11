#!/usr/bin/env tsx

import { db } from '../db';
import { nflGames, nflTeams } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { nflDataService } from '../services/nflDataService';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Tank01 team ID to abbreviation mapping (1-32)
const TANK01_TEAM_MAP: { [key: number]: string } = {
  1: 'ARI', 2: 'ATL', 3: 'BAL', 4: 'BUF', 5: 'CAR', 6: 'CHI', 7: 'CIN', 8: 'CLE',
  9: 'DAL', 10: 'DEN', 11: 'DET', 12: 'GB', 13: 'HOU', 14: 'IND', 15: 'JAX', 16: 'KC',
  17: 'LV', 18: 'LAC', 19: 'LAR', 20: 'MIA', 21: 'MIN', 22: 'NE', 23: 'NO', 24: 'NYG',
  25: 'NYJ', 26: 'PIT', 27: 'SF', 28: 'SEA', 29: 'TB', 30: 'TEN', 31: 'WSH', 32: 'PHI'
};

async function makeAPIRequest(endpoint: string) {
  const response = await fetch(`https://${RAPIDAPI_HOST}${endpoint}`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY!,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

function formatGameDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function createGameID(awayTeam: string, homeTeam: string, gameDate: Date): string {
  const dateStr = formatGameDate(gameDate);
  return `${dateStr}_${awayTeam}@${homeTeam}`;
}

async function updateGameScores() {
  try {
    console.log('🏈 Starting 2024 NFL game score updates...');

    // Get all games from database with team codes
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
      .where(
        and(
          eq(nflGames.season, 2024),
          eq(nflGames.isCompleted, false)
        )
      )
      .limit(50); // Process in batches

    console.log(`Found ${games.length} games needing score updates`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const game of games) {
      try {
        console.log(`\n📊 Processing ${game.awayTeamCode} @ ${game.homeTeamCode} (Week ${game.week})...`);

        // Create gameID in Tank01 format: YYYYMMDD_AWAY@HOME
        const gameID = createGameID(game.awayTeamCode, game.homeTeamCode, game.gameDate);
        
        console.log(`🔍 Looking up game ID: ${gameID}`);

        // Try to get box score first
        const boxScore = await nflDataService.getGameBoxScore(gameID);
        
        if (boxScore && boxScore.homeTeam && boxScore.awayTeam) {
          const homeScore = parseInt(boxScore.homeTeam.teamStats?.totalPoints || boxScore.homeTeam.totalPts || '0');
          const awayScore = parseInt(boxScore.awayTeam.teamStats?.totalPoints || boxScore.awayTeam.totalPts || '0');
          
          if (homeScore > 0 || awayScore > 0) {
            console.log(`✅ Found scores: ${game.awayTeamCode} ${awayScore}, ${game.homeTeamCode} ${homeScore}`);
            
            // Update the game in database
            await db
              .update(nflGames)
              .set({
                homeScore,
                awayScore,
                isCompleted: true
              })
              .where(eq(nflGames.id, game.id));

            updatedCount++;
          } else {
            console.log(`⚠️  No valid scores found in box score for ${gameID}`);
          }
        } else {
          console.log(`⚠️  No box score found for ${gameID}`);
          
          // Try alternative approach: get games for that date
          const dateStr = formatGameDate(game.gameDate);
          const dailyGames = await nflDataService.getGamesForDate(dateStr);
          
          for (const apiGame of dailyGames) {
            if ((apiGame.awayTeam === game.awayTeamCode || apiGame.away === game.awayTeamCode) && 
                (apiGame.homeTeam === game.homeTeamCode || apiGame.home === game.homeTeamCode)) {
              const homeScore = parseInt(apiGame.homePts || apiGame.homeScore || '0');
              const awayScore = parseInt(apiGame.awayPts || apiGame.awayScore || '0');
              
              if (homeScore > 0 || awayScore > 0) {
                console.log(`✅ Found scores via daily games: ${game.awayTeamCode} ${awayScore}, ${game.homeTeamCode} ${homeScore}`);
                
                await db
                  .update(nflGames)
                  .set({
                    homeScore,
                    awayScore,
                    isCompleted: true
                  })
                  .where(eq(nflGames.id, game.id));

                updatedCount++;
                break;
              }
            }
          }
        }

        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${game.awayTeamCode} @ ${game.homeTeamCode}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎯 Score update completed:`);
    console.log(`   ✅ Updated: ${updatedCount} games`);
    console.log(`   ❌ Errors: ${errorCount} games`);
    console.log(`   📊 Total processed: ${games.length} games`);

  } catch (error) {
    console.error('❌ Failed to update game scores:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  updateGameScores()
    .then(() => {
      console.log('✅ Game score update script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { updateGameScores };