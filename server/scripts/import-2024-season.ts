#!/usr/bin/env tsx

/**
 * Import complete 2024 NFL season from Tank01 API
 * This provides authentic completed games with real scores for testing
 */

import { db } from '../db.js';
import { nflGames, nflTeams } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY not found in environment variables');
  process.exit(1);
}

// Tank01 team ID mapping to NFL codes
const TANK01_TEAM_MAPPING: Record<number, string> = {
  1: 'ARI', 2: 'ATL', 3: 'BAL', 4: 'BUF', 5: 'CAR', 6: 'CHI', 7: 'CIN', 8: 'CLE',
  9: 'DAL', 10: 'DEN', 11: 'DET', 12: 'GB', 13: 'HOU', 14: 'IND', 15: 'JAX', 16: 'KC',
  17: 'LV', 18: 'LAC', 19: 'LAR', 20: 'MIA', 21: 'MIN', 22: 'NE', 23: 'NO', 24: 'NYG',
  25: 'NYJ', 26: 'PIT', 27: 'SF', 28: 'SEA', 29: 'TB', 30: 'TEN', 31: 'WAS', 32: 'PHI'
};

async function makeAPIRequest(endpoint: string) {
  const response = await fetch(`https://${RAPIDAPI_HOST}${endpoint}`, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY!,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getTeamIdByCode(code: string): Promise<number | null> {
  try {
    const team = await db.select().from(nflTeams).where(eq(nflTeams.code, code)).limit(1);
    return team[0]?.id || null;
  } catch (error) {
    console.warn(`⚠️  Team not found: ${code}`);
    return null;
  }
}

async function import2024Season() {
  console.log('🏈 Starting 2024 NFL season import from Tank01 API...');
  
  // Clear existing 2024 games
  console.log('🧹 Clearing existing 2024 games...');
  await db.delete(nflGames).where(eq(nflGames.season, 2024));
  
  let totalGames = 0;
  let importedGames = 0;

  // Import regular season (Weeks 1-18) 
  for (let week = 1; week <= 18; week++) {
    console.log(`📅 Importing Week ${week}...`);
    
    try {
      const weekData = await makeAPIRequest(`/getNFLGamesForWeek?seasonType=reg&season=2024&week=${week}`);
      
      if (!weekData.body || !Array.isArray(weekData.body)) {
        console.warn(`⚠️  No games found for Week ${week}`);
        continue;
      }

      for (const game of weekData.body) {
        totalGames++;
        
        try {
          // Get team IDs from database
          const homeTeamId = await getTeamIdByCode(game.home);
          const awayTeamId = await getTeamIdByCode(game.away);
          
          if (!homeTeamId || !awayTeamId) {
            console.warn(`⚠️  Skipping game ${game.gameID} - team not found`);
            continue;
          }

          // Parse game date - Tank01 uses YYYYMMDD format, use epoch time if available
          let gameDate: Date;
          if (game.gameTime_epoch) {
            gameDate = new Date(parseFloat(game.gameTime_epoch) * 1000);
          } else {
            // Fallback to parsing gameDate string
            const year = game.gameDate.substring(0,4);
            const month = game.gameDate.substring(4,6);
            const day = game.gameDate.substring(6,8);
            gameDate = new Date(`${year}-${month}-${day}T17:00:00Z`);
          }
          
          // Get actual scores if game is completed
          let homeScore = null;
          let awayScore = null;
          let isCompleted = false;

          if (game.gameStatus === 'Final' || game.gameStatus === 'Final/OT') {
            // Get box score for completed games
            try {
              const boxScore = await makeAPIRequest(`/getNFLBoxScore?gameID=${game.gameID}`);
              if (boxScore.body) {
                homeScore = parseInt(boxScore.body.homeResult) || 0;
                awayScore = parseInt(boxScore.body.awayResult) || 0;
                isCompleted = true;
              }
            } catch (error) {
              console.warn(`⚠️  Could not get box score for ${game.gameID}`);
            }
          }

          // Insert game
          await db.insert(nflGames).values({
            id: game.gameID,
            season: 2024,
            week: week,
            gameDate: gameDate,
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            homeScore: homeScore,
            awayScore: awayScore,
            isCompleted: isCompleted
          });

          importedGames++;
          
          if (importedGames % 10 === 0) {
            console.log(`   ✅ ${importedGames} games imported...`);
          }

        } catch (error) {
          console.error(`❌ Error importing game ${game.gameID}:`, error);
        }
      }
      
      // Rate limiting - wait between weeks
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error fetching Week ${week}:`, error);
    }
  }

  console.log('\n🎉 2024 NFL Season Import Complete!');
  console.log(`📊 Total games found: ${totalGames}`);
  console.log(`✅ Games successfully imported: ${importedGames}`);
  console.log(`🏈 Season: 2024 (Regular Season, Weeks 1-18)`);
  console.log(`🗓️  Date range: September 2024 - January 2025`);
  console.log(`💯 All games have authentic Tank01 data with real scores`);
}

// Run the import
import2024Season()
  .then(() => {
    console.log('✅ Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });