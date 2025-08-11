import { Router } from "express";
import { db } from "../db.js";
import { users, stables, nflGames, nflTeams } from "../../shared/schema.js";
import { eq, and, lte, desc, gte, gt } from "drizzle-orm";

const router = Router();

// Season simulation state
let simulationState = {
  simulationDate: new Date('2024-09-01T00:00:00Z'),
  isSimulationRunning: false,
  timeAcceleration: 1, // 1x = real time, higher = faster
  currentWeek: 1,
  completedGames: 0,
  lastSimulationUpdate: Date.now()
};

let simulationInterval: NodeJS.Timeout | null = null;

// Helper function to get authenticated user (simplified)
async function getAuthenticatedUser(req: any) {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  
  try {
    const { verifyJWT } = await import("../auth.js");
    return verifyJWT(token);
  } catch {
    return null;
  }
}

// Get current admin state
router.get('/state', async (req, res) => {
  try {
    // Calculate how much time has passed since last update if simulation is running
    if (simulationState.isSimulationRunning) {
      const now = Date.now();
      const timePassed = (now - simulationState.lastSimulationUpdate) * simulationState.timeAcceleration;
      simulationState.simulationDate = new Date(simulationState.simulationDate.getTime() + timePassed);
      simulationState.lastSimulationUpdate = now;
    }

    // Get upcoming games (mock for now - will integrate with real NFL schedule)
    const upcomingGames = await getUpcomingGames(simulationState.simulationDate, simulationState.currentWeek);
    
    // Get league standings (from database)
    const leagueStandings = await getLeagueStandings();

    res.json({
      ...simulationState,
      upcomingGames,
      leagueStandings
    });
  } catch (error) {
    console.error('Error getting admin state:', error);
    res.status(500).json({ error: 'Failed to get admin state' });
  }
});

// Start simulation
router.post('/simulation/start', async (req, res) => {
  try {
    simulationState.isSimulationRunning = true;
    simulationState.lastSimulationUpdate = Date.now();
    
    // Start the simulation loop
    startSimulationLoop();
    
    // Broadcast to all connected admin clients
    broadcastAdminUpdate();
    
    res.json({ success: true, message: 'Simulation started' });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// Stop simulation
router.post('/simulation/stop', async (req, res) => {
  try {
    simulationState.isSimulationRunning = false;
    
    // Stop the simulation loop
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    
    // Broadcast to all connected admin clients
    broadcastAdminUpdate();
    
    res.json({ success: true, message: 'Simulation stopped' });
  } catch (error) {
    console.error('Error stopping simulation:', error);
    res.status(500).json({ error: 'Failed to stop simulation' });
  }
});

// Reset simulation
router.post('/simulation/reset', async (req, res) => {
  try {
    // Stop simulation if running
    simulationState.isSimulationRunning = false;
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    
    // Reset to September 1, 2024
    simulationState.simulationDate = new Date('2024-09-01T00:00:00Z');
    simulationState.currentWeek = 1;
    simulationState.completedGames = 0;
    simulationState.lastSimulationUpdate = Date.now();
    
    // Reset all user scores and locks in database
    await resetSeasonData();
    
    // Broadcast to all connected admin clients
    broadcastAdminUpdate();
    
    res.json({ success: true, message: 'Simulation reset to September 1, 2024' });
  } catch (error) {
    console.error('Error resetting simulation:', error);
    res.status(500).json({ error: 'Failed to reset simulation' });
  }
});

// Set time acceleration
router.post('/simulation/speed', async (req, res) => {
  try {
    const { speed } = req.body;
    
    if (!speed || speed < 1 || speed > 86400) {
      return res.status(400).json({ error: 'Invalid speed value' });
    }
    
    // Update simulation time before changing speed
    if (simulationState.isSimulationRunning) {
      const now = Date.now();
      const timePassed = (now - simulationState.lastSimulationUpdate) * simulationState.timeAcceleration;
      simulationState.simulationDate = new Date(simulationState.simulationDate.getTime() + timePassed);
      simulationState.lastSimulationUpdate = now;
    }
    
    simulationState.timeAcceleration = speed;
    
    // Restart simulation loop with new speed if running
    if (simulationState.isSimulationRunning) {
      startSimulationLoop();
    }
    
    // Broadcast to all connected admin clients
    broadcastAdminUpdate();
    
    res.json({ success: true, message: `Time acceleration set to ${speed}x` });
  } catch (error) {
    console.error('Error setting time acceleration:', error);
    res.status(500).json({ error: 'Failed to set time acceleration' });
  }
});

// Jump to specific week
router.post('/simulation/jump-to-week', async (req, res) => {
  try {
    const { week } = req.body;
    
    if (!week || week < 1 || week > 22) {
      return res.status(400).json({ error: 'Invalid week number' });
    }
    
    // Calculate target date based on week
    const targetDate = getDateForWeek(week);
    simulationState.simulationDate = targetDate;
    simulationState.currentWeek = week;
    simulationState.lastSimulationUpdate = Date.now();
    
    // Process all games up to this point
    await processGamesUpToDate(targetDate);
    
    // Broadcast to all connected admin clients
    broadcastAdminUpdate();
    
    res.json({ success: true, message: `Jumped to Week ${week}` });
  } catch (error) {
    console.error('Error jumping to week:', error);
    res.status(500).json({ error: 'Failed to jump to week' });
  }
});

// Simulation loop - runs every second to check for games to process
function startSimulationLoop() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }
  
  simulationInterval = setInterval(async () => {
    if (!simulationState.isSimulationRunning) return;
    
    try {
      // Store previous time before update
      const previousTime = new Date(simulationState.simulationDate);
      
      // Update simulation time
      const now = Date.now();
      const timePassed = (now - simulationState.lastSimulationUpdate) * simulationState.timeAcceleration;
      simulationState.simulationDate = new Date(simulationState.simulationDate.getTime() + timePassed);
      simulationState.lastSimulationUpdate = now;
      
      // Check for games that should have started/completed between previousTime and current time
      await checkAndProcessGames(previousTime, simulationState.simulationDate);
      
      // Update current week based on date
      const newWeek = getWeekForDate(simulationState.simulationDate);
      if (newWeek !== simulationState.currentWeek) {
        simulationState.currentWeek = newWeek;
        broadcastAdminUpdate();
      }
      
    } catch (error) {
      console.error('Error in simulation loop:', error);
    }
  }, 1000); // Check every second
}

// Helper functions
async function getUpcomingGames(currentDate: Date, currentWeek: number) {
  try {
    const games = await db
      .select()
      .from(nflGames)
      .where(and(
        gte(nflGames.gameDate, currentDate),
        eq(nflGames.week, currentWeek)
      ))
      .limit(10)
      .orderBy(nflGames.gameDate);
    
    return games.map(game => ({
      id: game.id,
      awayTeam: game.awayTeamId,
      homeTeam: game.homeTeamId,
      gameTime: game.gameDate,
      week: game.week
    }));
  } catch (error) {
    console.error('Error getting upcoming games:', error);
    return [];
  }
}

async function getLeagueStandings() {
  try {
    const standings = await db
      .select({
        id: users.id,
        username: users.username,
        totalPoints: users.totalPoints,
        locksUsed: users.locksUsed
      })
      .from(users)
      .orderBy(desc(users.totalPoints))
      .limit(20);
    
    return standings;
  } catch (error) {
    console.error('Error getting league standings:', error);
    return [];
  }
}

async function resetSeasonData() {
  try {
    await db.update(users).set({
      totalPoints: 0,
      locksUsed: 0,
      weeklyPoints: []
    });
    
    await db.update(stables).set({
      locksUsed: 0,
      lockAndLoadUsed: false
    });
    
  } catch (error) {
    console.error('Error resetting season data:', error);
  }
}

async function checkAndProcessGames(previousTime: Date, currentTime: Date) {
  try {
    // Only process games that should start between the previous tick and current tick
    // This ensures games are processed only when their scheduled time is crossed
    const gamesToProcess = await db
      .select()
      .from(nflGames)
      .where(and(
        gt(nflGames.gameDate, previousTime),
        lte(nflGames.gameDate, currentTime),
        eq(nflGames.isCompleted, false)
      ));
    
    for (const game of gamesToProcess) {
      console.log(`🏈 Game starting NOW: Week ${game.week} - ${new Date(game.gameDate).toLocaleString()}`);
      console.log(`   Time window: ${previousTime.toISOString()} → ${currentTime.toISOString()}`);
      await processGame(game);
      simulationState.completedGames++;
    }
    
    if (gamesToProcess.length > 0) {
      console.log(`✅ Processed ${gamesToProcess.length} games. Total completed: ${simulationState.completedGames}`);
      broadcastAdminUpdate();
    }
    
  } catch (error) {
    console.error('Error checking and processing games:', error);
  }
}

async function processGame(game: any) {
  // Process a single game - fetch real 2024 scores and calculate Mok points
  try {
    console.log(`Processing game: ${game.awayTeamId} @ ${game.homeTeamId} (Week ${game.week})`);
    
    // Fetch real 2024 scores (this will integrate with your existing scoring system)
    const gameResult = await fetchGame2024Scores(game.id);
    
    if (gameResult) {
      // Update game with actual scores
      await db.update(nflGames)
        .set({
          awayScore: gameResult.awayScore,
          homeScore: gameResult.homeScore,
          isCompleted: true
        })
        .where(eq(nflGames.id, game.id));
      
      // Calculate and apply Mok scoring
      await calculateAndApplyMokScoring(game, gameResult);
      
      // Broadcast game completion
      broadcastGameCompleted(game, gameResult);
    }
    
  } catch (error) {
    console.error(`Error processing game ${game.id}:`, error);
  }
}

async function fetchGame2024Scores(espnGameId: string) {
  // This will integrate with your existing Tank01/ESPN scoring system
  try {
    const { getGameResult } = await import("../routes/scoring.js");
    return await getGameResult(espnGameId, 2024);
  } catch (error) {
    console.error('Error fetching real game scores:', error);
    // Return mock scores as fallback
    return {
      awayScore: Math.floor(Math.random() * 35) + 7,
      homeScore: Math.floor(Math.random() * 35) + 7
    };
  }
}

async function calculateAndApplyMokScoring(game: any, gameResult: any) {
  try {
    const { calculateMokPoints } = await import("../utils/mokScoring.js");
    await calculateMokPoints(game, gameResult);
    console.log(`Mok points calculated for game: ${game.awayTeam} ${gameResult.awayScore} - ${game.homeTeam} ${gameResult.homeScore}`);
  } catch (error) {
    console.error('Error calculating Mok scoring:', error);
  }
}

function getDateForWeek(week: number): Date {
  // Calculate the date for the start of a given NFL week in 2024
  const season2024Start = new Date('2024-09-05T00:00:00Z'); // Week 1 starts
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
  return new Date(season2024Start.getTime() + (week - 1) * millisecondsPerWeek);
}

function getWeekForDate(date: Date): number {
  // Calculate which NFL week a given date falls in
  const season2024Start = new Date('2024-09-05T00:00:00Z');
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksDiff = Math.floor((date.getTime() - season2024Start.getTime()) / millisecondsPerWeek);
  return Math.max(1, Math.min(22, weeksDiff + 1));
}

async function processGamesUpToDate(targetDate: Date) {
  try {
    const gamesToProcess = await db
      .select()
      .from(nflGames)
      .where(and(
        lte(nflGames.gameDate, targetDate),
        eq(nflGames.isCompleted, false)
      ));
    
    for (const game of gamesToProcess) {
      await processGame(game);
      simulationState.completedGames++;
    }
    
  } catch (error) {
    console.error('Error processing games up to date:', error);
  }
}

function broadcastAdminUpdate() {
  try {
    // Integrate with existing WebSocket system
    const message = {
      type: 'admin-update',
      data: {
        ...simulationState,
        timestamp: Date.now()
      }
    };
    
    // This will be enhanced to use the actual WebSocket broadcasting
    console.log('Broadcasting admin update to connected clients:', message);
  } catch (error) {
    console.error('Error broadcasting admin update:', error);
  }
}

function broadcastGameCompleted(game: any, result: any) {
  try {
    const message = {
      type: 'game-completed',
      data: {
        gameId: game.id,
        awayTeam: game.awayTeamId,
        homeTeam: game.homeTeamId,
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        week: game.week,
        timestamp: Date.now()
      }
    };
    
    console.log('Broadcasting game completion:', message);
  } catch (error) {
    console.error('Error broadcasting game completion:', error);
  }
}

// Register admin routes
export function registerAdminRoutes(app: any) {
  app.use('/api/admin', router);
}

export default router;