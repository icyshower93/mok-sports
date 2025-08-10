import { Router } from 'express';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { nflGames, nflTeams, weeklyLocks, userWeeklyScores } from '../../shared/schema';

const router = Router();

interface RapidAPIGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  teams: {
    away: {
      id: number;
      name: string;
      logo: string;
    };
    home: {
      id: number;
      name: string;
      logo: string;
    };
  };
  scores?: {
    away?: number;
    home?: number;
  };
  status: {
    short: string;
    long: string;
  };
  week: number;
  season: number;
}

// NFL team mapping from API names to our abbreviations
const NFL_TEAM_MAPPING: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS'
};

async function fetchNFLScheduleFromESPN(season: number = 2024): Promise<any[]> {
  try {
    console.log(`[Schedule Import] Fetching 2024 NFL schedule from ESPN API...`);
    
    const games: any[] = [];
    
    // ESPN API endpoint for NFL games by season
    // Fetch games week by week (weeks 1-18 for regular season, 19-22 for playoffs)
    for (let week = 1; week <= 22; week++) {
      try {
        const weekResponse = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&year=${season}`,
          { headers: { 'User-Agent': 'MokSports/1.0' } }
        );
        
        if (weekResponse.ok) {
          const weekData = await weekResponse.json();
          
          if (weekData.events && weekData.events.length > 0) {
            const weekGames = weekData.events.map((event: any) => ({
              id: event.id,
              week: week,
              season: season,
              date: event.date,
              timestamp: new Date(event.date).getTime() / 1000,
              teams: {
                away: {
                  id: event.competitions[0].competitors[1].id,
                  name: event.competitions[0].competitors[1].team.displayName,
                  abbreviation: event.competitions[0].competitors[1].team.abbreviation,
                  logo: event.competitions[0].competitors[1].team.logo
                },
                home: {
                  id: event.competitions[0].competitors[0].id,
                  name: event.competitions[0].competitors[0].team.displayName,
                  abbreviation: event.competitions[0].competitors[0].team.abbreviation,
                  logo: event.competitions[0].competitors[0].team.logo
                }
              },
              scores: event.competitions[0].status.type.completed ? {
                away: parseInt(event.competitions[0].competitors[1].score),
                home: parseInt(event.competitions[0].competitors[0].score)
              } : undefined,
              status: {
                short: event.competitions[0].status.type.completed ? 'FT' : 'NS',
                long: event.competitions[0].status.type.description
              }
            }));
            
            games.push(...weekGames);
            console.log(`[Schedule Import] Week ${week}: Found ${weekGames.length} games`);
          }
        } else {
          console.log(`[Schedule Import] Week ${week}: No data or API limit reached`);
        }
        
        // Small delay to avoid overwhelming ESPN's API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (weekError) {
        console.log(`[Schedule Import] Error fetching week ${week}:`, weekError);
        continue;
      }
    }
    
    console.log(`[Schedule Import] Successfully fetched ${games.length} total games from ESPN`);
    return games;
    
  } catch (error) {
    console.error('[Schedule Import] Error fetching from ESPN:', error);
    throw error;
  }
}

async function fetchNFLSchedule(season: number = 2024): Promise<RapidAPIGame[]> {
  // First, try RapidAPI with multiple endpoints
  const rapidAPIOptions = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': '005fffe3bemsh0ccee48c9d8de37p1274c5jsn792f60867fc1',
      'X-RapidAPI-Host': 'api-american-football.p.rapidapi.com'
    }
  };

  const rapidAPIEndpoints = [
    `https://api-american-football.p.rapidapi.com/games?league=1&season=${season}`,
    `https://api-american-football.p.rapidapi.com/fixtures?league=1&season=${season}`,
  ];

  // Try RapidAPI endpoints first (since you're paying for this)
  for (const endpoint of rapidAPIEndpoints) {
    try {
      console.log(`[Schedule Import] Trying RapidAPI endpoint: ${endpoint}`);
      const response = await fetch(endpoint, rapidAPIOptions);
      
      if (response.ok) {
        const data = await response.json();
        if (data.response && data.response.length > 0) {
          console.log(`[Schedule Import] SUCCESS! Fetched ${data.response.length} games from RapidAPI (paid service)`);
          return data.response;
        }
      } else {
        const errorText = await response.text();
        console.log(`[Schedule Import] RapidAPI failed: ${response.status} ${response.statusText} - ${errorText}`);
        
        if (response.status === 403 && errorText.includes('not subscribed')) {
          console.log(`[Schedule Import] SUBSCRIPTION ISSUE: You need to subscribe to the API-American-Football API on RapidAPI first`);
          console.log(`[Schedule Import] Visit: https://rapidapi.com/api-sports/api/api-american-football/pricing`);
        }
      }
    } catch (error) {
      console.log(`[Schedule Import] RapidAPI endpoint error:`, error);
      continue;
    }
  }

  // If RapidAPI fails, use ESPN as backup (but notify user)
  console.log(`[Schedule Import] ⚠️  Using FREE ESPN API as backup (since paid RapidAPI failed)`);
  try {
    const espnGames = await fetchNFLScheduleFromESPN(season);
    console.log(`[Schedule Import] ℹ️  Consider checking your RapidAPI subscription - you're paying $20/month but using free backup`);
    return espnGames as RapidAPIGame[];
  } catch (error) {
    console.error('[Schedule Import] Both RapidAPI and ESPN failed:', error);
    throw new Error('Unable to fetch NFL schedule from any source. Please check API availability.');
  }
}

async function convertToOurFormat(apiGame: any, teamMapping: Record<string, string>): Promise<any> {
  // Handle both RapidAPI format and ESPN format
  let awayTeam, homeTeam;
  
  if (apiGame.teams?.away?.name) {
    // RapidAPI format
    awayTeam = NFL_TEAM_MAPPING[apiGame.teams.away.name] || apiGame.teams.away.name;
    homeTeam = NFL_TEAM_MAPPING[apiGame.teams.home.name] || apiGame.teams.home.name;
  } else if (apiGame.teams?.away?.abbreviation) {
    // ESPN format
    awayTeam = apiGame.teams.away.abbreviation;
    homeTeam = apiGame.teams.home.abbreviation;
  } else {
    throw new Error('Unknown API game format');
  }

  const gameDate = apiGame.timestamp 
    ? new Date(apiGame.timestamp * 1000) 
    : new Date(apiGame.date);

  // Get actual team IDs from the mapping
  const homeTeamId = teamMapping[homeTeam];
  const awayTeamId = teamMapping[awayTeam];
  
  if (!homeTeamId || !awayTeamId) {
    throw new Error(`Team mapping not found for ${homeTeam} or ${awayTeam}`);
  }

  return {
    season: apiGame.season,
    week: apiGame.week,
    gameDate: gameDate,
    homeTeamId: homeTeamId,
    awayTeamId: awayTeamId,
    homeScore: apiGame.scores?.home || null,
    awayScore: apiGame.scores?.away || null,
    isCompleted: apiGame.status.short === 'FT', // FT = Full Time
    isTie: apiGame.scores?.home === apiGame.scores?.away && apiGame.scores?.home !== undefined && apiGame.scores?.away !== undefined,
    winnerTeamId: apiGame.scores && apiGame.scores.home !== undefined && apiGame.scores.away !== undefined && apiGame.scores.home !== apiGame.scores.away 
      ? (apiGame.scores.home > apiGame.scores.away ? homeTeamId : awayTeamId)
      : null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// Import 2024 NFL schedule
router.post('/import-schedule', async (req, res) => {
  try {
    const { season = 2024, resetState = true } = req.body;
    
    console.log(`[Schedule Import] Starting import for ${season} season...`);
    
    // Step 1: Fetch schedule from RapidAPI
    const apiGames = await fetchNFLSchedule(season);
    
    if (!apiGames.length) {
      return res.status(400).json({ error: 'No games found for this season' });
    }

    // Step 2: Get team mapping using raw SQL to avoid circular structure issues
    const teamQuery = await db.execute(sql`SELECT id, code FROM nfl_teams`);
    const teams = teamQuery.rows;
    
    const teamMapping = teams.reduce((acc, team: any) => {
      acc[team.code] = team.id;
      return acc;
    }, {} as Record<string, string>);
    
    if (Object.keys(teamMapping).length === 0) {
      throw new Error('No NFL teams found in database. Please seed teams first using /api/nfl-teams/seed-teams');
    }
    
    console.log(`[Schedule Import] Using team mapping with ${Object.keys(teamMapping).length} teams`);
    
    // Step 3: Convert to our format with proper team ID mapping
    const gamesData = await Promise.all(
      apiGames.map(game => convertToOurFormat(game, teamMapping))
    );
    
    // Step 4: Clear existing data if requested
    if (resetState) {
      console.log('[Schedule Import] Resetting app state...');
      
      // Delete all existing games, locks, and user stats
      await db.delete(nflGames);
      await db.delete(weeklyLocks);
      await db.delete(userWeeklyScores);
      
      console.log('[Schedule Import] Previous data cleared');
    }

    // Step 5: Insert new games
    console.log(`[Schedule Import] Inserting ${gamesData.length} games...`);
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < gamesData.length; i += batchSize) {
      const batch = gamesData.slice(i, i + batchSize);
      await db.insert(nflGames).values(batch);
      insertedCount += batch.length;
      console.log(`[Schedule Import] Inserted batch ${Math.ceil(i / batchSize) + 1}, total: ${insertedCount}`);
    }

    console.log(`[Schedule Import] Successfully imported ${insertedCount} games for ${season} season`);
    
    // Step 6: Return summary
    const weekCounts = gamesData.reduce((acc, game) => {
      acc[game.week] = (acc[game.week] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    res.json({
      success: true,
      message: `Successfully imported ${insertedCount} games for ${season} NFL season`,
      summary: {
        totalGames: insertedCount,
        season,
        weekBreakdown: weekCounts,
        resetState,
        dateRange: {
          first: gamesData[0]?.gameDate,
          last: gamesData[gamesData.length - 1]?.gameDate
        }
      }
    });

  } catch (error) {
    console.error('[Schedule Import] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to import schedule',
      details: errorMessage
    });
  }
});

// Get import status/summary
router.get('/import-status', async (req, res) => {
  try {
    const allGames = await db.select().from(nflGames);
    
    const seasonsSet = new Set(allGames.map(g => g.season));
    const weeksSet = new Set(allGames.map(g => g.week));
    
    const summary = {
      totalGames: allGames.length,
      seasons: Array.from(seasonsSet),
      weeks: Array.from(weeksSet).sort((a, b) => a - b),
      completedGames: allGames.filter(g => g.isCompleted).length,
      upcomingGames: allGames.filter(g => !g.isCompleted).length
    };

    res.json({
      success: true,
      summary,
      sampleGames: allGames.slice(0, 5) // Show first 5 games as examples
    });
  } catch (error) {
    console.error('[Schedule Import] Status error:', error);
    res.status(500).json({
      error: 'Failed to get import status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reset app state (clear all user progress)
router.post('/reset-state', async (req, res) => {
  try {
    console.log('[Schedule Import] Resetting all user progress...');
    
    // Clear user progress but keep games
    await db.delete(weeklyLocks);
    await db.delete(userWeeklyScores);
    
    console.log('[Schedule Import] User progress reset complete');
    
    res.json({
      success: true,
      message: 'App state reset - all user progress cleared'
    });
  } catch (error) {
    console.error('[Schedule Import] Reset error:', error);
    res.status(500).json({
      error: 'Failed to reset app state',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router };
export default router;