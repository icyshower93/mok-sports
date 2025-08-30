// server/utils/week.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function isWeekComplete(season: number, week: number): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT
      SUM(CASE WHEN is_completed THEN 1 ELSE 0 END)::int AS completed,
      COUNT(*)::int AS total
    FROM nfl_games
    WHERE season = ${season} AND week = ${week}
  `);
  
  const row = result.rows[0] as any;
  const completed = Number(row?.completed ?? 0);
  const total = Number(row?.total ?? 0);
  return total > 0 && completed === total;
}