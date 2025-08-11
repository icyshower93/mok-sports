#!/usr/bin/env tsx

import { db } from '../db';
import { nflGames, nflTeams } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

async function checkGameStatus() {
  try {
    console.log('📊 Checking 2024 NFL game database status...');

    // Get database statistics
    const totalGames = await db.select({ count: sql`count(*)` }).from(nflGames).where(eq(nflGames.season, 2024));
    const completedGames = await db.select({ count: sql`count(*)` }).from(nflGames).where(eq(nflGames.isCompleted, true));
    const uncompletedGames = await db.select({ count: sql`count(*)` }).from(nflGames).where(eq(nflGames.isCompleted, false));

    console.log(`Total 2024 games: ${totalGames[0].count}`);
    console.log(`Completed games: ${completedGames[0].count}`);
    console.log(`Uncompleted games: ${uncompletedGames[0].count}`);

    // Get sample games with team codes
    const sampleGames = await db
      .select({
        week: nflGames.week,
        gameDate: nflGames.gameDate,
        isCompleted: nflGames.isCompleted,
        homeScore: nflGames.homeScore,
        awayScore: nflGames.awayScore,
        homeTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.homeTeamId})`,
        awayTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.awayTeamId})`
      })
      .from(nflGames)
      .where(eq(nflGames.season, 2024))
      .orderBy(nflGames.week, nflGames.gameDate)
      .limit(10);

    console.log('\nSample games:');
    sampleGames.forEach((game, i) => {
      const date = game.gameDate.toISOString().split('T')[0];
      const scores = `${game.awayScore || 0}-${game.homeScore || 0}`;
      console.log(`${i + 1}. Week ${game.week}: ${game.awayTeamCode} @ ${game.homeTeamCode} (${scores}) - ${game.isCompleted ? 'Complete' : 'Pending'} - ${date}`);
    });

    // Check specific Week 1 games for testing
    const week1Games = await db
      .select({
        week: nflGames.week,
        gameDate: nflGames.gameDate,
        isCompleted: nflGames.isCompleted,
        homeScore: nflGames.homeScore,
        awayScore: nflGames.awayScore,
        homeTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.homeTeamId})`,
        awayTeamCode: sql<string>`(SELECT code FROM nfl_teams WHERE id = ${nflGames.awayTeamId})`
      })
      .from(nflGames)
      .where(eq(nflGames.week, 1))
      .orderBy(nflGames.gameDate);

    console.log('\nWeek 1 games:');
    week1Games.forEach((game, i) => {
      const date = game.gameDate.toISOString().split('T')[0];
      const scores = `${game.awayScore || 0}-${game.homeScore || 0}`;
      console.log(`${i + 1}. ${game.awayTeamCode} @ ${game.homeTeamCode} (${scores}) - ${game.isCompleted ? 'Complete' : 'Pending'} - ${date}`);
    });

    console.log('\n✅ Database check completed');

  } catch (error) {
    console.error('❌ Failed to check game status:', error);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  checkGameStatus()
    .then(() => {
      console.log('✅ Check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { checkGameStatus };