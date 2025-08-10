import { Router } from 'express';
import { db } from '../db';
import { nflGames, type InsertNflGame } from '@/shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// NFL Schedule API Configuration
interface RapidAPIConfig {
  apiKey: string;
  host: string;
  baseUrl: string;
}

// NFL Game data from API
interface NFLGameAPI {
  id: string;
  date: string;
  time: string;
  week: number;
  season: number;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: string;
  stadium?: string;
  location?: string;
}

// Get RapidAPI configuration
function getRapidAPIConfig(): RapidAPIConfig {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY environment variable is required');
  }
  
  return {
    apiKey,
    host: 'nfl-api-data.p.rapidapi.com', // Primary recommendation from search
    baseUrl: 'https://nfl-api-data.p.rapidapi.com'
  };
}

// Fetch NFL schedule from RapidAPI
async function fetchNFLSchedule(season: number): Promise<NFLGameAPI[]> {
  const config = getRapidAPIConfig();
  
  try {
    console.log(`[NFL API] Fetching ${season} season schedule...`);
    
    const response = await fetch(`${config.baseUrl}/nfl-schedule?season=${season}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': config.apiKey,
        'X-RapidAPI-Host': config.host,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NFL API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[NFL API] Successfully fetched ${data.length || 0} games`);
    
    return data;
  } catch (error) {
    console.error('[NFL API] Error fetching schedule:', error);
    throw error;
  }
}

// Transform API data to database format
function transformGameData(apiGame: NFLGameAPI): InsertNflGame {
  const gameDateTime = new Date(`${apiGame.date} ${apiGame.time}`);
  
  return {
    gameId: apiGame.id,
    season: apiGame.season,
    week: apiGame.week,
    gameDate: gameDateTime,
    homeTeam: apiGame.home_team,
    awayTeam: apiGame.away_team,
    homeScore: apiGame.home_score || null,
    awayScore: apiGame.away_score || null,
    status: apiGame.status,
    stadium: apiGame.stadium || null,
    location: apiGame.location || null
  };
}

// Import full season schedule
router.post('/import/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    
    if (isNaN(season) || season < 2020 || season > 2030) {
      return res.status(400).json({
        success: false,
        error: 'Invalid season. Must be between 2020-2030'
      });
    }

    console.log(`[NFL Import] Starting import for ${season} season...`);
    
    // Fetch schedule from RapidAPI
    const apiGames = await fetchNFLSchedule(season);
    
    if (!apiGames || apiGames.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No schedule data found for this season'
      });
    }

    // Transform and insert games
    const games = apiGames.map(transformGameData);
    let imported = 0;
    let updated = 0;

    for (const game of games) {
      try {
        // Check if game already exists
        const existing = await db.select()
          .from(nflGames)
          .where(eq(nflGames.gameId, game.gameId))
          .limit(1);

        if (existing.length > 0) {
          // Update existing game
          await db.update(nflGames)
            .set(game)
            .where(eq(nflGames.gameId, game.gameId));
          updated++;
        } else {
          // Insert new game
          await db.insert(nflGames).values(game);
          imported++;
        }
      } catch (error) {
        console.error(`[NFL Import] Error processing game ${game.gameId}:`, error);
      }
    }

    console.log(`[NFL Import] Completed: ${imported} imported, ${updated} updated`);

    res.json({
      success: true,
      season,
      total: apiGames.length,
      imported,
      updated,
      message: `Successfully processed ${season} NFL schedule`
    });

  } catch (error) {
    console.error('[NFL Import] Import failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed'
    });
  }
});

// Get available weeks for a season
router.get('/weeks/:season', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    
    const weeks = await db.selectDistinct({ week: nflGames.week })
      .from(nflGames)
      .where(eq(nflGames.season, season))
      .orderBy(nflGames.week);

    res.json({
      success: true,
      season,
      weeks: weeks.map(w => w.week)
    });

  } catch (error) {
    console.error('[NFL Schedule] Error fetching weeks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weeks'
    });
  }
});

// Get schedule for specific week
router.get('/:season/:week', async (req, res) => {
  try {
    const season = parseInt(req.params.season);
    const week = parseInt(req.params.week);

    const games = await db.select()
      .from(nflGames)
      .where(eq(nflGames.season, season))
      .where(eq(nflGames.week, week))
      .orderBy(nflGames.gameDate);

    res.json({
      success: true,
      season,
      week,
      games
    });

  } catch (error) {
    console.error('[NFL Schedule] Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule'
    });
  }
});

export default router;