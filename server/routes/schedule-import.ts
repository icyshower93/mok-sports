import { Router } from 'express';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { nflGames, nflTeams, weeklyLocks, userWeeklyScores } from '@shared/schema';

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

// Tank01 API team code mapping - some codes differ from our database
const TANK01_TEAM_MAPPING: Record<string, string> = {
  'WSH': 'WAS',  // Washington uses WSH in Tank01, WAS in our DB
  'TB': 'TB',    // Tampa Bay is consistent
  // All other teams should match directly
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
  // Tank01 NFL Live API configuration (your subscribed service)
  const tankAPIOptions = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': '005fffe3bemsh0ccee48c9d8de37p1274c5jsn792f60867fc1',
      'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
    }
  };

  // Try Tank01 API first - fetch all weeks
  const allGames: any[] = [];
  
  console.log(`[Schedule Import] Using Tank01 NFL Live API (your subscribed service)`);
  
  for (let week = 1; week <= 18; week++) {
    try {
      const endpoint = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLGamesForWeek?seasonType=reg&week=${week}&season=${season}`;
      console.log(`[Schedule Import] Fetching Week ${week} from Tank01...`);
      
      const response = await fetch(endpoint, tankAPIOptions);
      
      if (response.ok) {
        const data = await response.json();
        if (data.statusCode === 200 && data.body && data.body.length > 0) {
          allGames.push(...data.body);
          console.log(`[Schedule Import] Week ${week}: Found ${data.body.length} games`);
        } else {
          console.log(`[Schedule Import] Week ${week}: No games found`);
        }
      } else {
        const errorText = await response.text();
        console.log(`[Schedule Import] Tank01 Week ${week} failed: ${response.status} ${response.statusText}`);
        
        if (response.status === 403) {
          console.log(`[Schedule Import] Tank01 subscription issue - falling back to ESPN`);
          break;
        }
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.log(`[Schedule Import] Tank01 Week ${week} error:`, error);
      continue;
    }
  }
  
  if (allGames.length > 0) {
    console.log(`[Schedule Import] SUCCESS! Fetched ${allGames.length} games from Tank01 NFL Live API`);
    return allGames;
  }

  // If Tank01 fails, use ESPN as backup
  console.log(`[Schedule Import] Tank01 failed, using ESPN API as backup...`);
  try {
    const espnGames = await fetchNFLScheduleFromESPN(season);
    console.log(`[Schedule Import] Successfully using ESPN backup with ${espnGames.length} games`);
    return espnGames as RapidAPIGame[];
  } catch (error) {
    console.error('[Schedule Import] Both Tank01 and ESPN failed:', error);
    throw new Error('Unable to fetch NFL schedule from any source. Please check API availability.');
  }
}

async function convertToOurFormat(apiGame: any, teamMapping: Record<string, string>): Promise<any> {
  // Handle Tank01, ESPN format, and legacy formats
  let awayTeam, homeTeam;
  
  if (apiGame.away && apiGame.home && apiGame.gameID) {
    // Tank01 API format - normalize team codes
    awayTeam = TANK01_TEAM_MAPPING[apiGame.away] || apiGame.away;
    homeTeam = TANK01_TEAM_MAPPING[apiGame.home] || apiGame.home;
  } else if (apiGame.teams?.away?.name) {
    // Legacy RapidAPI format
    awayTeam = NFL_TEAM_MAPPING[apiGame.teams.away.name] || apiGame.teams.away.name;
    homeTeam = NFL_TEAM_MAPPING[apiGame.teams.home.name] || apiGame.teams.home.name;
  } else if (apiGame.teams?.away?.abbreviation) {
    // ESPN format
    awayTeam = apiGame.teams.away.abbreviation;
    homeTeam = apiGame.teams.home.abbreviation;
  } else {
    throw new Error('Unknown API game format');
  }

  // Handle different date formats
  let gameDate;
  if (apiGame.gameDate) {
    // Tank01 format: "20240905" -> convert to proper date
    const dateStr = apiGame.gameDate.toString();
    gameDate = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`);
  } else if (apiGame.timestamp) {
    gameDate = new Date(apiGame.timestamp * 1000);
  } else {
    gameDate = new Date(apiGame.date);
  }

  // Get actual team IDs from the mapping
  const homeTeamId = teamMapping[homeTeam];
  const awayTeamId = teamMapping[awayTeam];
  
  if (!homeTeamId || !awayTeamId) {
    throw new Error(`Team mapping not found for ${homeTeam} or ${awayTeam}`);
  }

  // Extract week number from Tank01 format ("Week 1" -> 1)
  let weekNumber;
  if (apiGame.gameWeek) {
    weekNumber = parseInt(apiGame.gameWeek.replace('Week ', ''));
  } else {
    weekNumber = apiGame.week;
  }

  // Handle Tank01 completion status
  let isCompleted = false;
  if (apiGame.gameStatus === 'Final' || apiGame.gameStatus === 'Completed') {
    isCompleted = true;
  } else if (apiGame.status?.short === 'FT') {
    isCompleted = true;
  }

  return {
    season: parseInt(apiGame.season) || 2024,
    week: weekNumber,
    gameDate: gameDate,
    homeTeamId: homeTeamId,
    awayTeamId: awayTeamId,
    homeScore: apiGame.scores?.home || null,
    awayScore: apiGame.scores?.away || null,
    isCompleted: isCompleted,
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
      acc[String(team.code)] = String(team.id);
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