import type { Express } from "express";

// Simple admin routes with basic functionality
export function registerAdminRoutes(app: Express) {
  // Basic health check endpoint for admin
  app.get("/api/admin/health", async (req, res) => {
    try {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        message: "Admin panel is operational"
      });
    } catch (error) {
      console.error('Admin health check error:', error);
      res.status(500).json({ 
        status: "unhealthy", 
        error: "Admin panel error" 
      });
    }
  });
}