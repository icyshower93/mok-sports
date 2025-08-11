#!/usr/bin/env tsx

import { db } from '../db.js';
import { nflGames, nflTeams } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { nflDataService } from '../services/nflDataService.js';
import fetch from 'node-fetch';

// Tank01 team ID to team code mapping (based on 2025 NFL data)
const TEAM_ID_MAPPING: { [key: string]: string } = {
  '1': 'ARI', '2': 'ATL', '3': 'BAL', '4': 'BUF', '5': 'CAR', '6': 'CHI',
  '7': 'CIN', '8': 'CLE', '9': 'DAL', '10': 'DEN', '11': 'DET', '12': 'GB',
  '13': 'HOU', '14': 'IND', '15': 'JAX', '16': 'KC', '17': 'LV', '18': 'LAC',
  '19': 'LAR', '20': 'MIA', '21': 'MIN', '22': 'NE', '23': 'NO', '24': 'NYG',
  '25': 'NYJ', '26': 'PHI', '27': 'PIT', '28': 'SF', '29': 'SEA', '30': 'TB',
  '31': 'TEN', '32': 'WAS'
};

// Function to get team UUID by code
async function getTeamUUIDByCode(teamCode: string): Promise<string | null> {
  try {
    const team = await db.select().from(nflTeams).where(eq(nflTeams.code, teamCode)).limit(1);
    return team.length > 0 ? team[0].id : null;
  } catch (error) {
    console.error(`Error getting team UUID for ${teamCode}:`, error);
    return null;
  }
}

// Convert Tank01 team ID to our team code
function getTeamCodeFromId(teamId: string | number): string | null {
  const id = String(teamId);
  return TEAM_ID_MAPPING[id] || null;
}

// Import complete 2025 NFL season
async function importFullSeason() {
  console.log('🏈 Starting full 2025 NFL season import...');
  
  try {
    // Get the full 2025 NFL schedule from Tank01 API
    console.log('📡 Fetching complete 2025 NFL schedule from RapidAPI...');
    
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY not found in environment variables');
    }

    // Try multiple approaches to get 2025 schedule
    let scheduleData: any = null;
    
    // First try: regular season endpoint
    try {
      console.log('Trying regular season endpoint...');
      const response = await fetch('https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGames?season=2025&seasonType=reg', {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
        },
      });
      
      if (response.ok) {
        scheduleData = await response.json();
        console.log('✅ Got schedule from regular season endpoint');
      }
    } catch (error) {
      console.log('Regular season endpoint failed:', error);
    }
    
    // Second try: general schedule endpoint  
    if (!scheduleData?.body?.length) {
      try {
        console.log('Trying general schedule endpoint...');
        const response = await fetch('https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGames?season=2025', {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
          },
        });
        
        if (response.ok) {
          scheduleData = await response.json();
          console.log('✅ Got schedule from general endpoint');
        }
      } catch (error) {
        console.log('General schedule endpoint failed:', error);
      }
    }
    
    // Third try: date-based approach for regular season weeks
    if (!scheduleData?.body?.length) {
      console.log('API endpoints unavailable, using date-based approach for known 2025 regular season dates...');
      scheduleData = { body: [] };
      
      // Get all regular season dates from September through January
      const regularSeasonDates = [
        // Week 1 (September 7-8, 2025)
        '20250907', '20250908',
        // Week 2 (September 14-15, 2025)  
        '20250914', '20250915',
        // Week 3 (September 21-22, 2025)
        '20250921', '20250922',
        // Week 4 (September 28-29, 2025)
        '20250928', '20250929',
        // Week 5 (October 5-6, 2025)
        '20251005', '20251006',
        // Continue through Week 18...
        '20251012', '20251013', // Week 6
        '20251019', '20251020', // Week 7
        '20251026', '20251027', // Week 8
        '20251102', '20251103', // Week 9
        '20251109', '20251110', // Week 10
        '20251116', '20251117', // Week 11
        '20251123', '20251124', // Week 12
        '20251130', '20251201', // Week 13
        '20251207', '20251208', // Week 14
        '20251214', '20251215', // Week 15
        '20251221', '20251222', // Week 16
        '20251228', '20251229', // Week 17
        '20260104', '20260105'  // Week 18
      ];
      
      for (const dateStr of regularSeasonDates) {
        try {
          const response = await fetch(`https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGamesForDate?gameDate=${dateStr}`, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
            },
          });
          
          if (response.ok) {
            const dateData = await response.json();
            if (dateData?.body?.length) {
              console.log(`Found ${dateData.body.length} games for ${dateStr}`);
              scheduleData.body.push(...dateData.body);
            }
          }
        } catch (error) {
          console.log(`Failed to get games for ${dateStr}:`, error);
        }
      }
    }
    
    if (!scheduleData || !scheduleData.body || !Array.isArray(scheduleData.body)) {
      console.error('❌ No schedule data received from API');
      return;
    }

    console.log(`📊 Found ${scheduleData.body.length} games in API response`);
    
    let importCount = 0;
    let errorCount = 0;
    
    for (const game of scheduleData.body) {
      try {
        // Convert Tank01 team IDs to team codes
        const homeTeamCode = getTeamCodeFromId(game.teamIDHome);
        const awayTeamCode = getTeamCodeFromId(game.teamIDAway);
        
        if (!homeTeamCode || !awayTeamCode) {
          console.warn(`⚠️ Skipping game - invalid team IDs: ${game.teamIDAway}@${game.teamIDHome}`);
          errorCount++;
          continue;
        }
        
        // Parse date more carefully
        let gameDate: Date;
        try {
          if (game.gameDate) {
            gameDate = new Date(game.gameDate);
            if (isNaN(gameDate.getTime())) {
              throw new Error('Invalid date');
            }
          } else {
            // Fallback to estimated date based on week
            const season2025Start = new Date('2025-09-07'); // Week 1 starts Sept 7, 2025
            const weekNumber = parseInt(game.week) || 1;
            gameDate = new Date(season2025Start.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
          }
        } catch (error) {
          console.warn(`⚠️ Skipping game - invalid date: ${game.gameDate}`);
          errorCount++;
          continue;
        }
        
        const week = parseInt(game.week) || 1;
        
        // Convert week to our schema (add 4 for preseason weeks)
        const schemaWeek = week + 4;
        
        // Get team UUIDs
        const homeTeamId = await getTeamUUIDByCode(homeTeamCode);
        const awayTeamId = await getTeamUUIDByCode(awayTeamCode);
        
        if (!homeTeamId || !awayTeamId) {
          console.warn(`⚠️ Skipping game - missing team UUIDs: ${awayTeamCode}@${homeTeamCode}`);
          errorCount++;
          continue;
        }
        
        // Create game ID
        const gameId = `${gameDate.getFullYear()}${String(gameDate.getMonth() + 1).padStart(2, '0')}${String(gameDate.getDate()).padStart(2, '0')}_${awayTeamCode}@${homeTeamCode}`;
        
        // Check if game already exists
        const existingGame = await db.select().from(nflGames).where(eq(nflGames.id, gameId)).limit(1);
        if (existingGame.length > 0) {
          console.log(`⏭️ Game already exists: ${gameId}`);
          continue;
        }
        
        // Insert game
        await db.insert(nflGames).values({
          id: gameId,
          season: 2025,
          week: schemaWeek,
          gameDate: gameDate,
          homeTeamId: homeTeamId,
          awayTeamId: awayTeamId,
          isCompleted: false,
          homeScore: null,
          awayScore: null
        });
        
        console.log(`✅ Imported: Week ${week} (${schemaWeek}) - ${awayTeamCode}@${homeTeamCode} on ${gameDate.toISOString().split('T')[0]}`);
        importCount++;
        
      } catch (gameError) {
        console.error(`❌ Error importing game:`, gameError);
        errorCount++;
      }
    }
    
    console.log(`🏁 Import complete! ✅ ${importCount} games imported, ❌ ${errorCount} errors`);
    
    // Show final schedule summary
    const summary = await db.execute(`
      SELECT week, COUNT(*) as game_count, 
             MIN(game_date) as first_game, 
             MAX(game_date) as last_game
      FROM nfl_games 
      WHERE season = 2025 
      GROUP BY week 
      ORDER BY week
    `);
    
    console.log('\n📋 Final 2025 Schedule Summary:');
    console.log('Week | Games | First Game     | Last Game');
    console.log('-----|-------|----------------|----------------');
    for (const row of summary.rows) {
      const weekLabel = row.week <= 4 ? `PS${row.week}` : `RS${row.week - 4}`;
      const firstGame = new Date(row.first_game).toISOString().split('T')[0];
      const lastGame = new Date(row.last_game).toISOString().split('T')[0];
      console.log(`${weekLabel.padEnd(4)} | ${String(row.game_count).padEnd(5)} | ${firstGame}     | ${lastGame}`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
  }
}

// Run the import
importFullSeason().then(() => {
  console.log('🎯 Import script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});