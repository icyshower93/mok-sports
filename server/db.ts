import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimize connection pool for scalability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Fail fast if connection takes > 2 seconds
});

export const db = drizzle({ client: pool, schema });

// Add connection pool monitoring
pool.on('connect', () => {
  console.log('[DB] New client connected to pool');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err);
});

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length === 1;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}