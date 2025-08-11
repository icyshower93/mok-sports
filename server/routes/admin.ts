import type { Express } from "express";
import { db } from "../db";
import { games } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// NFL Season simulation state starting September 1, 2024
const NFL_SEASON_START = new Date('2024-09-01T12:00:00Z');

let adminState = {
  simulationStartTime: null as number | null,
  currentSimulatedTime: NFL_SEASON_START.getTime(),
  isSimulationRunning: false,
  simulationSpeed: 1, // 1x = real time, 60x = 1 hour per minute, etc.
  lastUpdate: Date.now(),
  processedGames: 0,
  currentWeek: 0,
  currentDay: 'sunday'
};

// WebSocket connections for real-time updates
const adminConnections = new Set<any>();

export function registerAdminRoutes(app: Express) {
  // Get current admin state with NFL season simulation
  app.get("/api/admin/state", async (req, res) => {
    try {
      // Calculate current simulated time if simulation is running
      let currentTime = adminState.currentSimulatedTime;
      if (adminState.isSimulationRunning && adminState.simulationStartTime) {
        const realTimeElapsed = Date.now() - adminState.simulationStartTime;
        const simulatedTimeElapsed = realTimeElapsed * adminState.simulationSpeed;
        currentTime = adminState.currentSimulatedTime + simulatedTimeElapsed;
      }

      const currentDate = new Date(currentTime);
      
      res.json({
        isSimulationRunning: adminState.isSimulationRunning,
        simulationSpeed: adminState.simulationSpeed,
        currentSimulatedTime: currentTime,
        currentDate: currentDate.toISOString(),
        currentDateFormatted: currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        currentWeek: adminState.currentWeek,
        processedGames: adminState.processedGames,
        seasonStart: NFL_SEASON_START.toISOString(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin state error:', error);
      res.status(500).json({ error: "Failed to get admin state" });
    }
  });

  // Start NFL season simulation
  app.post("/api/admin/simulation/start", async (req, res) => {
    try {
      if (!adminState.isSimulationRunning) {
        adminState.simulationStartTime = Date.now();
        adminState.isSimulationRunning = true;
        
        // Start game processing interval
        startGameProcessing();
        
        // Broadcast to all connected clients
        broadcastAdminUpdate();
      }
      
      res.json({ 
        success: true, 
        message: "NFL season simulation started",
        state: getAdminStateSnapshot()
      });
    } catch (error) {
      console.error('Simulation start error:', error);
      res.status(500).json({ error: "Failed to start simulation" });
    }
  });

  // Stop NFL season simulation
  app.post("/api/admin/simulation/stop", async (req, res) => {
    try {
      if (adminState.isSimulationRunning && adminState.simulationStartTime) {
        // Update current simulated time before stopping
        const realTimeElapsed = Date.now() - adminState.simulationStartTime;
        const simulatedTimeElapsed = realTimeElapsed * adminState.simulationSpeed;
        adminState.currentSimulatedTime += simulatedTimeElapsed;
        
        adminState.isSimulationRunning = false;
        adminState.simulationStartTime = null;
        
        // Stop game processing
        stopGameProcessing();
        
        // Broadcast to all connected clients
        broadcastAdminUpdate();
      }
      
      res.json({ 
        success: true, 
        message: "NFL season simulation stopped",
        state: getAdminStateSnapshot()
      });
    } catch (error) {
      console.error('Simulation stop error:', error);
      res.status(500).json({ error: "Failed to stop simulation" });
    }
  });

  // Reset NFL season simulation to September 1, 2024
  app.post("/api/admin/simulation/reset", async (req, res) => {
    try {
      // Stop any running simulation
      stopGameProcessing();
      
      // Reset to season start
      adminState.simulationStartTime = null;
      adminState.currentSimulatedTime = NFL_SEASON_START.getTime();
      adminState.isSimulationRunning = false;
      adminState.simulationSpeed = 1;
      adminState.processedGames = 0;
      adminState.currentWeek = 0;
      adminState.currentDay = 'sunday';
      
      // Broadcast to all connected clients
      broadcastAdminUpdate();
      
      res.json({ 
        success: true, 
        message: "NFL season simulation reset to September 1, 2024",
        state: getAdminStateSnapshot()
      });
    } catch (error) {
      console.error('Simulation reset error:', error);
      res.status(500).json({ error: "Failed to reset simulation" });
    }
  });

  // Set simulation speed
  app.post("/api/admin/simulation/speed", async (req, res) => {
    try {
      const { speed } = req.body;
      if (!speed || speed < 1 || speed > 1000) {
        return res.status(400).json({ error: "Speed must be between 1 and 1000" });
      }

      // If simulation is running, update current time before changing speed
      if (adminState.isSimulationRunning && adminState.simulationStartTime) {
        const realTimeElapsed = Date.now() - adminState.simulationStartTime;
        const simulatedTimeElapsed = realTimeElapsed * adminState.simulationSpeed;
        adminState.currentSimulatedTime += simulatedTimeElapsed;
        adminState.simulationStartTime = Date.now(); // Reset start time for new speed
      }

      adminState.simulationSpeed = speed;
      broadcastAdminUpdate();
      
      res.json({ 
        success: true, 
        message: `Simulation speed set to ${speed}x`,
        state: getAdminStateSnapshot()
      });
    } catch (error) {
      console.error('Speed change error:', error);
      res.status(500).json({ error: "Failed to change speed" });
    }
  });
}

// Game processing interval
let gameProcessingInterval: NodeJS.Timeout | null = null;

function startGameProcessing() {
  if (gameProcessingInterval) {
    clearInterval(gameProcessingInterval);
  }

  // Check for games every 30 seconds
  gameProcessingInterval = setInterval(async () => {
    await processGames();
  }, 30000);
}

function stopGameProcessing() {
  if (gameProcessingInterval) {
    clearInterval(gameProcessingInterval);
    gameProcessingInterval = null;
  }
}

async function processGames() {
  try {
    // Calculate current simulated time
    let currentTime = adminState.currentSimulatedTime;
    if (adminState.isSimulationRunning && adminState.simulationStartTime) {
      const realTimeElapsed = Date.now() - adminState.simulationStartTime;
      const simulatedTimeElapsed = realTimeElapsed * adminState.simulationSpeed;
      currentTime = adminState.currentSimulatedTime + simulatedTimeElapsed;
    }

    // Find games that should be processed (games that started in simulated time but haven't been processed)
    const currentSimulatedDate = new Date(currentTime);
    const gamesQuery = await db
      .select()
      .from(games)
      .where(
        and(
          lte(games.startTime, currentSimulatedDate),
          eq(games.status, 'scheduled') // Only process games that haven't been processed yet
        )
      );

    if (gamesQuery.length > 0) {
      console.log(`[Admin] Processing ${gamesQuery.length} games for simulated date: ${currentSimulatedDate.toISOString()}`);
      
      for (const game of gamesQuery) {
        await simulateGame(game);
        adminState.processedGames++;
      }

      // Update current week based on processed games
      updateCurrentWeek(currentSimulatedDate);
      
      // Broadcast update to all connected clients
      broadcastAdminUpdate();
    }
  } catch (error) {
    console.error('Game processing error:', error);
  }
}

async function simulateGame(game: any) {
  try {
    console.log(`[Admin] Simulating game: ${game.homeTeam} vs ${game.awayTeam} (Week ${game.week})`);
    
    // For now, use the actual game results if available, otherwise simulate
    // This would integrate with your existing mokScoring system
    // TODO: Call mokScoring functions to calculate points for users
    
    // Mark game as completed
    await db
      .update(games)
      .set({
        status: 'final',
        // Add actual scores if you have them in your schema
      })
      .where(eq(games.id, game.id));
      
  } catch (error) {
    console.error(`Error simulating game ${game.id}:`, error);
  }
}

function updateCurrentWeek(currentDate: Date) {
  const seasonStart = new Date(NFL_SEASON_START);
  const daysDiff = Math.floor((currentDate.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const weeksDiff = Math.floor(daysDiff / 7);
  adminState.currentWeek = Math.min(weeksDiff + 1, 18); // NFL season is 18 weeks
}

function getAdminStateSnapshot() {
  let currentTime = adminState.currentSimulatedTime;
  if (adminState.isSimulationRunning && adminState.simulationStartTime) {
    const realTimeElapsed = Date.now() - adminState.simulationStartTime;
    const simulatedTimeElapsed = realTimeElapsed * adminState.simulationSpeed;
    currentTime = adminState.currentSimulatedTime + simulatedTimeElapsed;
  }

  return {
    isSimulationRunning: adminState.isSimulationRunning,
    simulationSpeed: adminState.simulationSpeed,
    currentSimulatedTime: currentTime,
    currentDate: new Date(currentTime).toISOString(),
    processedGames: adminState.processedGames,
    currentWeek: adminState.currentWeek
  };
}

// Broadcast admin updates to all connected clients
function broadcastAdminUpdate() {
  const update = {
    type: 'admin-update',
    data: getAdminStateSnapshot()
  };

  adminConnections.forEach(ws => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify(update));
      } catch (error) {
        console.error('Error broadcasting admin update:', error);
        adminConnections.delete(ws);
      }
    }
  });
}

// Export functions for WebSocket integration
export function addAdminConnection(ws: any) {
  adminConnections.add(ws);
}

export function removeAdminConnection(ws: any) {
  adminConnections.delete(ws);
}