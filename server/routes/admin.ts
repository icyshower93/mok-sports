import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { nflDataService, type NFLGameData } from "../services/nflDataService";
import { nflGames, nflTeams, stables, userWeeklyScores, locks } from "@shared/schema";
import { calculateWeeklyScores } from "../utils/mokScoring";

// Admin state for time control and app state management
let adminState = {
  currentWeek: 0, // Start before Week 1 
  currentDay: 'sunday', // Sunday September 1, 2024
  currentTime: '12:00',
  currentDate: new Date('2024-09-01T12:00:00-04:00'), // Sept 1, 2024 12:00 PM ET
  season: 2024, // Using 2024 real NFL season data
  lockDeadlinePassed: false,
  activeLocks: 0,
  totalPlayers: 6,
  gamesPlayed: 0,
  lastSimulation: null as { week: number; gamesSimulated: number } | null,
  useRealData: true, // Flag to use Tank01/ESPN real NFL data instead of mock
  testLeagueId: '243d719b-92ce-4752-8689-5da93ee69213', // EEW2YU Test League
  realNFLGames: [] as NFLGameData[], // Cache of real NFL games
  simulatedCompletedGames: new Set<string>() // Track which games are "completed" in our simulation
};

// Export function to get admin state for internal use
export function getAdminState() {
  return adminState;
}

// Mock game data for simulation
const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

// Generate weekly matchups (16 games per week)
function generateWeeklyMatchups(week: number) {
  const shuffledTeams = [...NFL_TEAMS].sort(() => Math.random() - 0.5);
  const matchups = [];
  
  for (let i = 0; i < shuffledTeams.length; i += 2) {
    if (i + 1 < shuffledTeams.length) {
      matchups.push({
        week,
        homeTeam: shuffledTeams[i],
        awayTeam: shuffledTeams[i + 1],
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        gameTime: `${13 + (i / 2) % 3}:00`, // Stagger times: 1pm, 2pm, 3pm
        isCompleted: false
      });
    }
  }
  
  return matchups;
}

// Simulate game results
function simulateGameResult() {
  // Generate realistic NFL scores
  const homeScore = Math.floor(Math.random() * 28) + 10; // 10-37 points
  const awayScore = Math.floor(Math.random() * 28) + 10;
  
  return { homeScore, awayScore };
}

// In-memory storage for mock games
const mockGames: Array<{
  week: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'live' | 'completed';
  gameTime: string;
  isCompleted: boolean;
}> = [];

// Helper function to convert day name to offset from Sunday
function getDayOffset(day: string): number {
  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  return dayMap[day.toLowerCase()] || 0;
}

export function registerAdminRoutes(app: Express) {
  // Reset app state and load real NFL data
  app.post("/api/admin/reset-app-state", async (req, res) => {
    try {
      const { resetToWeek = 1, season = 2024 } = req.body;
      
      console.log(`[Admin] Resetting app state to Week ${resetToWeek} of ${season} season...`);
      
      // Load real NFL data
      console.log(`[Admin] Loading real NFL schedule for ${season} season...`);
      const nflGames = await nflDataService.getScheduleForSeason(season);
      
      // Update admin state
      adminState.currentWeek = resetToWeek;
      adminState.season = season;
      adminState.lockDeadlinePassed = false;
      adminState.activeLocks = 0;
      adminState.gamesPlayed = 0;
      adminState.lastSimulation = null;
      adminState.realNFLGames = nflGames;
      adminState.simulatedCompletedGames.clear();
      
      console.log(`[Admin] Loaded ${nflGames.length} real NFL games for ${season} season`);
      console.log(`[Admin] App state reset complete - Week ${resetToWeek} of ${season}`);
      
      res.json({
        success: true,
        message: `App state reset to Week ${resetToWeek} of ${season} season with ${nflGames.length} real games loaded`,
        adminState: {
          ...adminState,
          realNFLGames: undefined, // Don't send large data array in response
          totalGamesLoaded: nflGames.length
        }
      });
    } catch (error) {
      console.error('[Admin] Reset app state error:', error);
      res.status(500).json({ error: 'Failed to reset app state: ' + (error as Error).message });
    }
  });

  // Get current admin state  
  app.get("/api/admin/state", async (req, res) => {
    try {
      // Get real league data from EEW2YU test league
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const { leagues, users, drafts, draftPicks } = await import("../../shared/schema");
      
      // Get league info
      const [league] = await db.select().from(leagues).where(eq(leagues.id, adminState.testLeagueId));
      
      // Get total players count
      let totalPlayers = 0;
      if (league) {
        const leagueDrafts = await db.select().from(drafts).where(eq(drafts.leagueId, league.id));
        if (leagueDrafts.length > 0) {
          const picks = await db.select().from(draftPicks).where(eq(draftPicks.draftId, leagueDrafts[0].id));
          const uniqueUsers = new Set(picks.map(p => p.userId));
          totalPlayers = uniqueUsers.size;
        }
      }
      
      adminState.totalPlayers = totalPlayers;
      
      // Get completed games count from real NFL data
      let completedGames = 0;
      try {
        const { nflGames } = await import("../../shared/schema");
        const completedGamesResult = await db
          .select({ count: sql`count(*)` })
          .from(nflGames)
          .where(eq(nflGames.isCompleted, true));
        completedGames = Number(completedGamesResult[0].count) || 0;
      } catch (error) {
        console.log('[Admin] Could not get completed games count:', error);
      }
      
      adminState.gamesPlayed = completedGames;
      
      // Format current date and time for display (using dynamic date)
      const currentDate = adminState.currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York'
      });
      
      const currentTime = adminState.currentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short'
      });

      res.json({
        ...adminState,
        currentDate,
        currentTime,
        currentDateISO: adminState.currentDate.toISOString(),
        gamesPlayed: completedGames,
        // Add league stats
        totalGames: mockGames.length,
        scheduledGames: mockGames.filter(g => g.status === 'scheduled').length,
      });
    } catch (error) {
      console.error('Error getting admin state:', error);
      res.status(500).json({ message: "Failed to get admin state" });
    }
  });

  // Set specific time and simulate game completion
  app.post("/api/admin/set-time", async (req, res) => {
    try {
      const { week, day, time } = req.body;
      
      if (!week || !day || !time) {
        return res.status(400).json({ message: "Week, day, and time are required" });
      }

      const weekNum = parseInt(week);
      adminState.currentWeek = weekNum;
      adminState.currentDay = day;
      adminState.currentTime = time;
      
      // Calculate the actual date based on week, day, and time
      const seasonStart = new Date('2024-09-01T00:00:00-04:00'); // Sept 1, 2024
      const daysToAdd = (weekNum * 7) + getDayOffset(day);
      const calculatedDate = new Date(seasonStart);
      calculatedDate.setDate(seasonStart.getDate() + daysToAdd);
      
      // Set the time
      const [hour, minute] = time.split(':').map(Number);
      calculatedDate.setHours(hour, minute, 0, 0);
      adminState.currentDate = calculatedDate;
      
      console.log(`[Admin] Time set - Week ${weekNum}, ${day} ${time}`);
      console.log(`[Admin] Calculated date: ${calculatedDate.toISOString()}`);
      
      // Determine if lock deadline has passed (Thursday 8:20 PM)
      const isThursday = day === 'thursday';
      const timeHour = parseInt(time.split(':')[0]);
      const timeMinute = parseInt(time.split(':')[1]);
      const isAfterLockTime = (timeHour > 20) || (timeHour === 20 && timeMinute >= 20);
      
      adminState.lockDeadlinePassed = isThursday && isAfterLockTime;

      // Update simulated completed games based on new time
      const completedGames = await nflDataService.getGamesForTimeSimulation(weekNum, day, time);
      adminState.simulatedCompletedGames.clear();
      completedGames.forEach(game => adminState.simulatedCompletedGames.add(game.id));
      
      // Count games that should be "played" by this time
      let gamesPlayedCount = 0;
      if (weekNum > 1) {
        // All games from previous weeks are "played"
        gamesPlayedCount = adminState.realNFLGames.filter(g => g.week < weekNum).length;
      }
      // Add any games from current week that should be completed
      if (isAfterLockTime || ['friday', 'saturday', 'sunday', 'monday', 'tuesday'].includes(day)) {
        gamesPlayedCount += adminState.realNFLGames.filter(g => g.week === weekNum).length;
      }
      
      adminState.gamesPlayed = gamesPlayedCount;

      console.log(`[Admin] Time set to Week ${week}, ${day} ${time}`);
      console.log(`[Admin] Lock deadline status: ${adminState.lockDeadlinePassed ? 'PASSED' : 'ACTIVE'}`);
      console.log(`[Admin] Games simulated as completed: ${adminState.simulatedCompletedGames.size}`);

      res.json({ 
        message: "Time updated successfully", 
        state: {
          ...adminState,
          realNFLGames: undefined // Don't send large array
        },
        gamesCompleted: adminState.simulatedCompletedGames.size
      });
    } catch (error) {
      console.error('Error setting time:', error);
      res.status(500).json({ message: "Failed to set time" });
    }
  });

  // Advance to next week
  app.post("/api/admin/advance-week", async (req, res) => {
    try {
      adminState.currentWeek += 1;
      adminState.currentDay = 'monday';
      adminState.currentTime = '12:00';
      adminState.lockDeadlinePassed = false;

      if (adminState.currentWeek > 18) {
        adminState.currentWeek = 18; // Cap at regular season
      }
      
      // Recalculate the date based on new week
      const seasonStart = new Date('2024-09-01T00:00:00-04:00'); // Sept 1, 2024
      const daysToAdd = (adminState.currentWeek * 7) + getDayOffset(adminState.currentDay);
      const calculatedDate = new Date(seasonStart);
      calculatedDate.setDate(seasonStart.getDate() + daysToAdd);
      calculatedDate.setHours(12, 0, 0, 0); // Set to 12:00 PM
      adminState.currentDate = calculatedDate;

      console.log(`[Admin] Advanced to Week ${adminState.currentWeek}`);
      console.log(`[Admin] New date: ${calculatedDate.toISOString()}`);

      res.json({ 
        message: `Advanced to Week ${adminState.currentWeek}`, 
        state: adminState 
      });
    } catch (error) {
      console.error('Error advancing week:', error);
      res.status(500).json({ message: "Failed to advance week" });
    }
  });

  // Generate games for a week
  app.post("/api/admin/generate-games", async (req, res) => {
    try {
      const { week } = req.body;
      
      if (!week) {
        return res.status(400).json({ message: "Week is required" });
      }

      const weekNum = parseInt(week);
      
      // Remove existing games for this week
      const existingIndex = mockGames.findIndex(g => g.week === weekNum);
      if (existingIndex !== -1) {
        mockGames.splice(existingIndex, mockGames.filter(g => g.week === weekNum).length);
      }

      // Generate new matchups
      const newMatchups = generateWeeklyMatchups(weekNum);
      mockGames.push(...newMatchups);

      console.log(`[Admin] Generated ${newMatchups.length} games for Week ${weekNum}`);

      res.json({ 
        message: `Generated ${newMatchups.length} games for Week ${weekNum}`,
        games: newMatchups.length
      });
    } catch (error) {
      console.error('Error generating games:', error);
      res.status(500).json({ message: "Failed to generate games" });
    }
  });

  // Simulate games for a week with real Mok Sports scoring
  app.post("/api/admin/simulate-games", async (req, res) => {
    try {
      const { week } = req.body;
      
      if (!week) {
        return res.status(400).json({ message: "Week is required" });
      }

      const weekNum = parseInt(week);
      
      // Create table aliases for joins
      const homeTeam = alias(nflTeams, 'homeTeam');
      const awayTeam = alias(nflTeams, 'awayTeam');
      
      // Get real NFL games from database for this week
      const weekGames = await db
        .select({
          id: nflGames.id,
          homeTeamId: nflGames.homeTeamId,
          awayTeamId: nflGames.awayTeamId,
          homeScore: nflGames.homeScore,
          awayScore: nflGames.awayScore,
          isCompleted: nflGames.isCompleted,
          homeTeam: {
            id: homeTeam.id,
            code: homeTeam.code,
            name: homeTeam.name,
            city: homeTeam.city,
          },
          awayTeam: {
            id: awayTeam.id,
            code: awayTeam.code,
            name: awayTeam.name,
            city: awayTeam.city,
          },
        })
        .from(nflGames)
        .leftJoin(homeTeam, eq(nflGames.homeTeamId, homeTeam.id))
        .leftJoin(awayTeam, eq(nflGames.awayTeamId, awayTeam.id))
        .where(eq(nflGames.week, weekNum));
      
      if (weekGames.length === 0) {
        return res.status(400).json({ 
          message: `No games found for Week ${weekNum} in database.` 
        });
      }

      let simulatedCount = 0;
      const gameResults = [];
      
      // Production-ready scoring system: Live API with historical fallback
      const incompleteGames = weekGames.filter(game => !game.isCompleted);
      
      if (incompleteGames.length > 0) {
        console.log(`🏈 [Admin] Fetching NFL results for Week ${weekNum}, ${season}`);
        
        let useHistoricalFallback = false;
        
        // Try Tank01 API first for current/recent seasons
        if (season >= 2024) {
          try {
            console.log(`🏈 [Admin] Attempting Tank01 API for ${season} Season Week ${weekNum}`);
            
            const apiUrl = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLScoresOnly?week=${weekNum}&seasonType=reg&season=${season}`;
            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
                'X-RapidAPI-Host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
              }
            });
            
            if (response.ok) {
              const apiData = await response.json();
              console.log(`🏈 [Admin] Tank01 API returned ${apiData?.body?.length || 0} games for ${season}`);
              
              // Validate API data quality
              if (apiData?.body && Array.isArray(apiData.body) && apiData.body.length > 0) {
                // Check if we're getting the right season data
                const sampleGame = apiData.body[0];
                const hasValidScores = sampleGame.homePts !== null && sampleGame.awayPts !== null;
                const isCurrentSeason = season === 2025; // For 2025 season, accept live data
                
                if (hasValidScores || isCurrentSeason) {
                  console.log(`🏈 [Admin] Using Tank01 API data for production ${season} season`);
                  
                  // Process Tank01 API results
                  for (const apiGame of apiData.body) {
                    const matchingGame = incompleteGames.find(dbGame => {
                      const homeMatch = (dbGame.homeTeam?.city + " " + dbGame.homeTeam?.name).toLowerCase().includes(apiGame.home?.toLowerCase() || '');
                      const awayMatch = (dbGame.awayTeam?.city + " " + dbGame.awayTeam?.name).toLowerCase().includes(apiGame.away?.toLowerCase() || '');
                      return homeMatch && awayMatch;
                    });
                    
                    if (matchingGame && apiGame.homePts !== null && apiGame.awayPts !== null) {
                      const homeScore = parseInt(apiGame.homePts) || 0;
                      const awayScore = parseInt(apiGame.awayPts) || 0;
                      
                      await db
                        .update(nflGames)
                        .set({
                          homeScore: homeScore,
                          awayScore: awayScore,
                          isCompleted: true,
                          isTie: homeScore === awayScore,
                          winnerTeamId: homeScore > awayScore ? matchingGame.homeTeamId : 
                                      homeScore < awayScore ? matchingGame.awayTeamId : null,
                          updatedAt: new Date(),
                        })
                        .where(eq(nflGames.id, matchingGame.id));
                        
                      simulatedCount++;
                      
                      let winner = "TIE";
                      if (homeScore > awayScore) {
                        winner = `${matchingGame.homeTeam?.city} ${matchingGame.homeTeam?.name}`;
                      } else if (awayScore > homeScore) {
                        winner = `${matchingGame.awayTeam?.city} ${matchingGame.awayTeam?.name}`;
                      }
                      
                      gameResults.push({
                        homeTeam: `${matchingGame.homeTeam?.city} ${matchingGame.homeTeam?.name}`,
                        awayTeam: `${matchingGame.awayTeam?.city} ${matchingGame.awayTeam?.name}`,
                        homeScore,
                        awayScore,
                        winner,
                        alreadyCompleted: false
                      });
                      
                      console.log(`🏈 [Admin] Tank01: ${winner} ${homeScore}-${awayScore}`);
                    }
                  }
                } else {
                  console.log(`🏈 [Admin] Tank01 data quality insufficient, falling back to historical data`);
                  useHistoricalFallback = true;
                }
              } else {
                console.log(`🏈 [Admin] Tank01 API returned no valid data, using historical fallback`);
                useHistoricalFallback = true;
              }
            } else {
              console.log(`🏈 [Admin] Tank01 API failed with status ${response.status}, using historical fallback`);
              useHistoricalFallback = true;
            }
            
          } catch (apiError) {
            console.error(`❌ [Admin] Tank01 API error:`, apiError);
            useHistoricalFallback = true;
          }
        } else {
          console.log(`🏈 [Admin] Using historical data for ${season} season (pre-2024)`);
          useHistoricalFallback = true;
        }
        
        // Historical fallback system for development and testing
        if (useHistoricalFallback && season === 2024 && weekNum === 1) {
          try {
            console.log(`🏈 [Admin] Loading ESPN-sourced 2024 Week 1 historical data`);
            
            const fs = await import('fs');
            const path = await import('path');
            const historicalDataPath = path.join(process.cwd(), 'server/data/nfl2024week1results.json');
            const historicalData = JSON.parse(fs.readFileSync(historicalDataPath, 'utf8'));
            
            for (const historicalGame of historicalData.week1_2024_results) {
              const matchingGame = incompleteGames.find(dbGame => {
                const homeTeamCode = dbGame.homeTeam?.code;
                const awayTeamCode = dbGame.awayTeam?.code;
                
                return (homeTeamCode === historicalGame.homeTeam && awayTeamCode === historicalGame.awayTeam) ||
                       (homeTeamCode === historicalGame.awayTeam && awayTeamCode === historicalGame.homeTeam);
              });
              
              if (matchingGame) {
                let homeScore, awayScore;
                
                if (matchingGame.homeTeam?.code === historicalGame.homeTeam) {
                  homeScore = historicalGame.homeScore;
                  awayScore = historicalGame.awayScore;
                } else {
                  homeScore = historicalGame.awayScore;
                  awayScore = historicalGame.homeScore;
                }
                
                await db
                  .update(nflGames)
                  .set({
                    homeScore: homeScore,
                    awayScore: awayScore,
                    isCompleted: true,
                    isTie: homeScore === awayScore,
                    winnerTeamId: homeScore > awayScore ? matchingGame.homeTeamId : 
                                homeScore < awayScore ? matchingGame.awayTeamId : null,
                    updatedAt: new Date(),
                  })
                  .where(eq(nflGames.id, matchingGame.id));
                  
                simulatedCount++;
                
                let winner = "TIE";
                if (homeScore > awayScore) {
                  winner = `${matchingGame.homeTeam?.city} ${matchingGame.homeTeam?.name}`;
                } else if (awayScore > homeScore) {
                  winner = `${matchingGame.awayTeam?.city} ${matchingGame.awayTeam?.name}`;
                }
                
                gameResults.push({
                  homeTeam: `${matchingGame.homeTeam?.city} ${matchingGame.homeTeam?.name}`,
                  awayTeam: `${matchingGame.awayTeam?.city} ${matchingGame.awayTeam?.name}`,
                  homeScore,
                  awayScore,
                  winner,
                  alreadyCompleted: false
                });
                
                console.log(`🏈 [Admin] Historical: ${winner} ${homeScore}-${awayScore}`);
              }
            }
          } catch (dataError) {
            console.error(`❌ [Admin] Error loading historical data:`, dataError);
          }
        }
      }
      
      // Add already completed games to results
      for (const game of weekGames) {
        if (game.isCompleted) {
          gameResults.push({
            homeTeam: `${game.homeTeam?.city} ${game.homeTeam?.name}`,
            awayTeam: `${game.awayTeam?.city} ${game.awayTeam?.name}`,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            winner: game.homeScore! > game.awayScore! ? `${game.homeTeam?.city} ${game.homeTeam?.name}` : 
                   game.homeScore! < game.awayScore! ? `${game.awayTeam?.city} ${game.awayTeam?.name}` : 'TIE',
            alreadyCompleted: true
          });
        }
      }

      console.log(`[Admin] Simulated ${simulatedCount} games for Week ${weekNum}`);

      // Now calculate Mok Sports scoring for all leagues that have users in them
      await calculateAndSaveWeeklyScoring(weekNum, 2024);

      // Update admin state
      adminState.lastSimulation = {
        week: weekNum,
        gamesSimulated: simulatedCount
      };

      res.json({ 
        message: `Simulated ${simulatedCount} games and calculated Mok Sports scoring for Week ${weekNum}`,
        gamesSimulated: simulatedCount,
        totalGames: weekGames.length,
        results: gameResults,
        scoringCalculated: true
      });
    } catch (error) {
      console.error('Error simulating games and calculating scoring:', error);
      res.status(500).json({ 
        message: "Failed to simulate games and calculate scoring",
        error: error.message 
      });
    }
  });

  // Function to calculate and save weekly scoring for all leagues
  async function calculateAndSaveWeeklyScoring(week: number, season: number) {
    try {
      console.log(`[MokScoring] Starting weekly scoring calculation for Week ${week}, ${season}`);
      
      // Get all leagues that have users with drafted teams
      const leagues = await db
        .selectDistinct({ leagueId: stables.leagueId })
        .from(stables);

      let totalUsersScored = 0;
      
      for (const { leagueId } of leagues) {
        console.log(`[MokScoring] Calculating scores for league ${leagueId}`);
        
        // Calculate scores for this league using the mokScoring utility
        const userScores = await calculateWeeklyScores(leagueId, week, season);
        
        // Save scores in database (delete existing and insert new for now)
        for (const score of userScores) {
          // Delete existing record if it exists
          await db
            .delete(userWeeklyScores)
            .where(
              and(
                eq(userWeeklyScores.userId, score.userId),
                eq(userWeeklyScores.leagueId, score.leagueId),
                eq(userWeeklyScores.season, score.season),
                eq(userWeeklyScores.week, score.week)
              )
            );
          
          // Insert new record
          await db
            .insert(userWeeklyScores)
            .values({
              userId: score.userId,
              leagueId: score.leagueId,
              season: score.season,
              week: score.week,
              basePoints: score.basePoints,
              lockBonusPoints: score.lockBonusPoints || 0,
              lockAndLoadBonusPoints: score.lockAndLoadBonusPoints || 0,
              totalPoints: score.totalPoints,
              updatedAt: new Date()
            });
        }
        
        totalUsersScored += userScores.length;
        console.log(`[MokScoring] Saved scores for ${userScores.length} users in league ${leagueId}`);
      }
      
      console.log(`[MokScoring] ✅ Completed scoring calculation for ${leagues.length} leagues, ${totalUsersScored} total users`);
      
    } catch (error) {
      console.error('[MokScoring] Error calculating weekly scoring:', error);
      throw error;
    }
  }

  // Get games for a specific week (for testing/verification)
  app.get("/api/admin/games/:week", async (req, res) => {
    try {
      const week = parseInt(req.params.week);
      const weekGames = mockGames.filter(g => g.week === week);
      
      res.json({
        week,
        games: weekGames,
        completed: weekGames.filter(g => g.isCompleted).length,
        scheduled: weekGames.filter(g => !g.isCompleted).length
      });
    } catch (error) {
      console.error('Error getting games:', error);
      res.status(500).json({ message: "Failed to get games" });
    }
  });

  // Get real NFL scores with time simulation (for scores page)
  app.get("/api/games/week/:week", async (req, res) => {
    try {
      const week = parseInt(req.params.week);
      
      // Use real NFL data if available, otherwise fall back to mock
      if (adminState.useRealData && adminState.realNFLGames.length > 0) {
        const weekGames = adminState.realNFLGames.filter(g => g.week === week);
        
        // Format games for the scores page with simulation logic
        const formattedGames = weekGames.map(game => {
          // Check if this game should be "completed" based on simulated time
          const shouldBeCompleted = adminState.simulatedCompletedGames.has(game.id);
          
          return {
            id: game.id,
            week,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: shouldBeCompleted ? game.homeScore : null,
            awayScore: shouldBeCompleted ? game.awayScore : null,
            gameDate: game.gameDate.toISOString(),
            isCompleted: shouldBeCompleted,
            // Add ownership data (will be merged with draft data in scoring route)
            homeOwner: '',
            homeOwnerName: '',
            awayOwner: '',
            awayOwnerName: '',
            homeLocked: false,
            awayLocked: false,
            homeLockAndLoad: false,
            awayLockAndLoad: false,
            homeMokPoints: 0,
            awayMokPoints: 0
          };
        });

        res.json({ results: formattedGames });
      } else {
        // Fallback to mock games
        const weekGames = mockGames.filter(g => g.week === week);
        
        const formattedGames = weekGames.map(game => ({
          id: `${game.homeTeam}-${game.awayTeam}-${week}`,
          week,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          gameDate: new Date().toISOString(),
          isCompleted: game.isCompleted,
          homeOwner: '',
          homeOwnerName: '',
          awayOwner: '',
          awayOwnerName: '',
          homeLocked: false,
          awayLocked: false,
          homeLockAndLoad: false,
          awayLockAndLoad: false,
          homeMokPoints: 0,
          awayMokPoints: 0
        }));

        res.json({ results: formattedGames });
      }
    } catch (error) {
      console.error('Error getting weekly games:', error);
      res.status(500).json({ message: "Failed to get games" });
    }
  });

  console.log('[Admin] Admin routes registered successfully');
}

// Helper function to get team names
function getTeamName(code: string): string {
  const teamNames: Record<string, string> = {
    'ARI': 'Cardinals', 'ATL': 'Falcons', 'BAL': 'Ravens', 'BUF': 'Bills',
    'CAR': 'Panthers', 'CHI': 'Bears', 'CIN': 'Bengals', 'CLE': 'Browns',
    'DAL': 'Cowboys', 'DEN': 'Broncos', 'DET': 'Lions', 'GB': 'Packers',
    'HOU': 'Texans', 'IND': 'Colts', 'JAX': 'Jaguars', 'KC': 'Chiefs',
    'LV': 'Raiders', 'LAC': 'Chargers', 'LAR': 'Rams', 'MIA': 'Dolphins',
    'MIN': 'Vikings', 'NE': 'Patriots', 'NO': 'Saints', 'NYG': 'Giants',
    'NYJ': 'Jets', 'PHI': 'Eagles', 'PIT': 'Steelers', 'SEA': 'Seahawks',
    'SF': '49ers', 'TB': 'Buccaneers', 'TEN': 'Titans', 'WAS': 'Commanders'
  };
  
  return teamNames[code] || code;
}