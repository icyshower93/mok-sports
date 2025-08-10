import type { Express } from "express";
import { storage } from "../storage";

// Simple in-memory admin state for testing
let adminState = {
  currentWeek: 1,
  currentDay: 'monday',
  currentTime: '12:00',
  season: 2025,
  lockDeadlinePassed: false,
  activeLocks: 0,
  totalPlayers: 6,
  gamesPlayed: 0,
  lastSimulation: null as { week: number; gamesSimulated: number } | null
};

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

export function registerAdminRoutes(app: Express) {
  // Get current admin state
  app.get("/api/admin/state", async (req, res) => {
    try {
      // Calculate some dynamic stats
      const completedGames = mockGames.filter(g => g.isCompleted).length;
      
      // Format current time for display
      const timeDisplay = adminState.currentTime === '12:00' ? '12:00 PM ET' : 
                         parseInt(adminState.currentTime.split(':')[0]) > 12 ? 
                         `${parseInt(adminState.currentTime.split(':')[0]) - 12}:${adminState.currentTime.split(':')[1]} PM ET` :
                         `${adminState.currentTime} AM ET`;

      res.json({
        ...adminState,
        currentTime: timeDisplay,
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

  // Set specific time
  app.post("/api/admin/set-time", async (req, res) => {
    try {
      const { week, day, time } = req.body;
      
      if (!week || !day || !time) {
        return res.status(400).json({ message: "Week, day, and time are required" });
      }

      adminState.currentWeek = parseInt(week);
      adminState.currentDay = day;
      adminState.currentTime = time;
      
      // Determine if lock deadline has passed (Thursday 8:20 PM)
      const isThursday = day === 'thursday';
      const timeHour = parseInt(time.split(':')[0]);
      const timeMinute = parseInt(time.split(':')[1]);
      const isAfterLockTime = (timeHour > 20) || (timeHour === 20 && timeMinute >= 20);
      
      adminState.lockDeadlinePassed = isThursday && isAfterLockTime;

      console.log(`[Admin] Time set to Week ${week}, ${day} ${time}`);
      console.log(`[Admin] Lock deadline status: ${adminState.lockDeadlinePassed ? 'PASSED' : 'ACTIVE'}`);

      res.json({ 
        message: "Time updated successfully", 
        state: adminState 
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

      console.log(`[Admin] Advanced to Week ${adminState.currentWeek}`);

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

  // Simulate games for a week
  app.post("/api/admin/simulate-games", async (req, res) => {
    try {
      const { week } = req.body;
      
      if (!week) {
        return res.status(400).json({ message: "Week is required" });
      }

      const weekNum = parseInt(week);
      const weekGames = mockGames.filter(g => g.week === weekNum);
      
      if (weekGames.length === 0) {
        return res.status(400).json({ message: `No games found for Week ${weekNum}. Generate games first.` });
      }

      let simulatedCount = 0;
      
      for (const game of weekGames) {
        if (!game.isCompleted) {
          const result = simulateGameResult();
          game.homeScore = result.homeScore;
          game.awayScore = result.awayScore;
          game.status = 'completed';
          game.isCompleted = true;
          simulatedCount++;
        }
      }

      // Update admin state
      adminState.lastSimulation = {
        week: weekNum,
        gamesSimulated: simulatedCount
      };

      console.log(`[Admin] Simulated ${simulatedCount} games for Week ${weekNum}`);

      res.json({ 
        message: `Simulated ${simulatedCount} games for Week ${weekNum}`,
        gamesSimulated: simulatedCount,
        results: weekGames.map(g => ({
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          winner: g.homeScore! > g.awayScore! ? g.homeTeam : g.awayTeam
        }))
      });
    } catch (error) {
      console.error('Error simulating games:', error);
      res.status(500).json({ message: "Failed to simulate games" });
    }
  });

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

  // Get mock scores API endpoint (for scores page)
  app.get("/api/games/week/:week", async (req, res) => {
    try {
      const week = parseInt(req.params.week);
      const weekGames = mockGames.filter(g => g.week === week);
      
      // Format games for the scores page
      const formattedGames = weekGames.map(game => ({
        id: `${game.homeTeam}-${game.awayTeam}-${week}`,
        week,
        homeTeam: {
          code: game.homeTeam,
          name: getTeamName(game.homeTeam),
          score: game.homeScore
        },
        awayTeam: {
          code: game.awayTeam,
          name: getTeamName(game.awayTeam),
          score: game.awayScore
        },
        status: game.status,
        gameTime: game.gameTime,
        isCompleted: game.isCompleted
      }));

      res.json(formattedGames);
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