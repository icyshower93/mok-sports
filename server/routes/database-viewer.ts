import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerDatabaseViewerRoutes(app: Express) {
  // Get all tables and their data
  app.get("/api/debug/database", async (req, res) => {
    try {
      const tables = [
        'users',
        'leagues', 
        'league_members',
        'nfl_teams',
        'nfl_games',
        'drafts',
        'draft_picks',
        'stables',
        'weekly_locks',
        'user_weekly_scores'
      ];

      const result: any = {};

      for (const tableName of tables) {
        try {
          const data = await db.execute(sql.raw(`SELECT * FROM ${tableName} LIMIT 10`));
          result[tableName] = {
            count: data.rows?.length || 0,
            sample: data.rows || []
          };
        } catch (error) {
          result[tableName] = {
            error: `Table might not exist: ${error}`
          };
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Database viewer error:', error);
      res.status(500).json({ error: 'Failed to fetch database data' });
    }
  });

  // Get table counts
  app.get("/api/debug/database/counts", async (req, res) => {
    try {
      const tables = [
        'users',
        'leagues', 
        'league_members',
        'nfl_teams',
        'nfl_games',
        'drafts',
        'draft_picks',
        'stables',
        'weekly_locks',
        'user_weekly_scores'
      ];

      const counts: any = {};

      for (const tableName of tables) {
        try {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
          counts[tableName] = result.rows?.[0]?.count || 0;
        } catch (error) {
          counts[tableName] = `Error: ${error}`;
        }
      }

      res.json(counts);
    } catch (error) {
      console.error('Database counts error:', error);
      res.status(500).json({ error: 'Failed to fetch table counts' });
    }
  });

  // Get specific table data
  app.get("/api/debug/database/:table", async (req, res) => {
    try {
      const { table } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const validTables = [
        'users', 'leagues', 'league_members', 'nfl_teams', 'nfl_games',
        'drafts', 'draft_picks', 'stables', 'weekly_locks', 'user_weekly_scores'
      ];

      if (!validTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }

      const data = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT ${limit}`));
      
      res.json({
        table,
        count: data.rows?.length || 0,
        data: data.rows || []
      });
    } catch (error) {
      console.error(`Error fetching ${req.params.table}:`, error);
      res.status(500).json({ error: `Failed to fetch ${req.params.table} data` });
    }
  });
}