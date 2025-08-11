import type { Express } from "express";

// Shared admin state for real-time sync
let adminState = {
  timerStartTime: null as number | null,
  timerElapsed: 0,
  isTimerRunning: false,
  lastUpdate: Date.now()
};

// WebSocket connections for real-time updates
const adminConnections = new Set<any>();

export function registerAdminRoutes(app: Express) {
  // Get current admin state
  app.get("/api/admin/state", async (req, res) => {
    try {
      // Calculate current elapsed time if timer is running
      let currentElapsed = adminState.timerElapsed;
      if (adminState.isTimerRunning && adminState.timerStartTime) {
        currentElapsed += Math.floor((Date.now() - adminState.timerStartTime) / 1000);
      }

      res.json({
        isTimerRunning: adminState.isTimerRunning,
        timerElapsed: currentElapsed,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin state error:', error);
      res.status(500).json({ error: "Failed to get admin state" });
    }
  });

  // Start timer
  app.post("/api/admin/timer/start", async (req, res) => {
    try {
      if (!adminState.isTimerRunning) {
        adminState.timerStartTime = Date.now();
        adminState.isTimerRunning = true;
        
        // Broadcast to all connected clients
        broadcastAdminUpdate();
      }
      
      res.json({ 
        success: true, 
        message: "Timer started",
        isRunning: adminState.isTimerRunning 
      });
    } catch (error) {
      console.error('Timer start error:', error);
      res.status(500).json({ error: "Failed to start timer" });
    }
  });

  // Stop timer
  app.post("/api/admin/timer/stop", async (req, res) => {
    try {
      if (adminState.isTimerRunning && adminState.timerStartTime) {
        // Save elapsed time before stopping
        adminState.timerElapsed += Math.floor((Date.now() - adminState.timerStartTime) / 1000);
        adminState.isTimerRunning = false;
        adminState.timerStartTime = null;
        
        // Broadcast to all connected clients
        broadcastAdminUpdate();
      }
      
      res.json({ 
        success: true, 
        message: "Timer stopped",
        isRunning: adminState.isTimerRunning,
        elapsed: adminState.timerElapsed
      });
    } catch (error) {
      console.error('Timer stop error:', error);
      res.status(500).json({ error: "Failed to stop timer" });
    }
  });

  // Reset timer
  app.post("/api/admin/timer/reset", async (req, res) => {
    try {
      adminState.timerStartTime = null;
      adminState.timerElapsed = 0;
      adminState.isTimerRunning = false;
      
      // Broadcast to all connected clients
      broadcastAdminUpdate();
      
      res.json({ 
        success: true, 
        message: "Timer reset",
        isRunning: false,
        elapsed: 0
      });
    } catch (error) {
      console.error('Timer reset error:', error);
      res.status(500).json({ error: "Failed to reset timer" });
    }
  });
}

// Broadcast admin updates to all connected clients
function broadcastAdminUpdate() {
  let currentElapsed = adminState.timerElapsed;
  if (adminState.isTimerRunning && adminState.timerStartTime) {
    currentElapsed += Math.floor((Date.now() - adminState.timerStartTime) / 1000);
  }

  const update = {
    type: 'admin-update',
    data: {
      isTimerRunning: adminState.isTimerRunning,
      timerElapsed: currentElapsed,
      timestamp: new Date().toISOString()
    }
  };

  // Send to all admin connections
  adminConnections.forEach((ws) => {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(update));
      }
    } catch (error) {
      console.error('Failed to broadcast admin update:', error);
      adminConnections.delete(ws);
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