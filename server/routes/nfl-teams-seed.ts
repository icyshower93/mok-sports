import { Router } from 'express';
import { db } from '../db';
import { nflTeams } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Complete NFL teams data with proper division information
const NFL_TEAMS_DATA = [
  // AFC East
  { code: 'BUF', name: 'Bills', city: 'Buffalo', conference: 'AFC', division: 'East' },
  { code: 'MIA', name: 'Dolphins', city: 'Miami', conference: 'AFC', division: 'East' },
  { code: 'NE', name: 'Patriots', city: 'New England', conference: 'AFC', division: 'East' },
  { code: 'NYJ', name: 'Jets', city: 'New York', conference: 'AFC', division: 'East' },
  
  // AFC North
  { code: 'BAL', name: 'Ravens', city: 'Baltimore', conference: 'AFC', division: 'North' },
  { code: 'CIN', name: 'Bengals', city: 'Cincinnati', conference: 'AFC', division: 'North' },
  { code: 'CLE', name: 'Browns', city: 'Cleveland', conference: 'AFC', division: 'North' },
  { code: 'PIT', name: 'Steelers', city: 'Pittsburgh', conference: 'AFC', division: 'North' },
  
  // AFC South
  { code: 'HOU', name: 'Texans', city: 'Houston', conference: 'AFC', division: 'South' },
  { code: 'IND', name: 'Colts', city: 'Indianapolis', conference: 'AFC', division: 'South' },
  { code: 'JAX', name: 'Jaguars', city: 'Jacksonville', conference: 'AFC', division: 'South' },
  { code: 'TEN', name: 'Titans', city: 'Tennessee', conference: 'AFC', division: 'South' },
  
  // AFC West
  { code: 'DEN', name: 'Broncos', city: 'Denver', conference: 'AFC', division: 'West' },
  { code: 'KC', name: 'Chiefs', city: 'Kansas City', conference: 'AFC', division: 'West' },
  { code: 'LV', name: 'Raiders', city: 'Las Vegas', conference: 'AFC', division: 'West' },
  { code: 'LAC', name: 'Chargers', city: 'Los Angeles', conference: 'AFC', division: 'West' },
  
  // NFC East
  { code: 'DAL', name: 'Cowboys', city: 'Dallas', conference: 'NFC', division: 'East' },
  { code: 'NYG', name: 'Giants', city: 'New York', conference: 'NFC', division: 'East' },
  { code: 'PHI', name: 'Eagles', city: 'Philadelphia', conference: 'NFC', division: 'East' },
  { code: 'WAS', name: 'Commanders', city: 'Washington', conference: 'NFC', division: 'East' },
  
  // NFC North
  { code: 'CHI', name: 'Bears', city: 'Chicago', conference: 'NFC', division: 'North' },
  { code: 'DET', name: 'Lions', city: 'Detroit', conference: 'NFC', division: 'North' },
  { code: 'GB', name: 'Packers', city: 'Green Bay', conference: 'NFC', division: 'North' },
  { code: 'MIN', name: 'Vikings', city: 'Minnesota', conference: 'NFC', division: 'North' },
  
  // NFC South
  { code: 'ATL', name: 'Falcons', city: 'Atlanta', conference: 'NFC', division: 'South' },
  { code: 'CAR', name: 'Panthers', city: 'Carolina', conference: 'NFC', division: 'South' },
  { code: 'NO', name: 'Saints', city: 'New Orleans', conference: 'NFC', division: 'South' },
  { code: 'TB', name: 'Buccaneers', city: 'Tampa Bay', conference: 'NFC', division: 'South' },
  
  // NFC West
  { code: 'ARI', name: 'Cardinals', city: 'Arizona', conference: 'NFC', division: 'West' },
  { code: 'LAR', name: 'Rams', city: 'Los Angeles', conference: 'NFC', division: 'West' },
  { code: 'SF', name: '49ers', city: 'San Francisco', conference: 'NFC', division: 'West' },
  { code: 'SEA', name: 'Seahawks', city: 'Seattle', conference: 'NFC', division: 'West' }
];

// Seed NFL teams into the database
router.post('/seed-teams', async (req, res) => {
  try {
    console.log('[NFL Teams] Starting to seed NFL teams...');
    
    // Check if teams already exist
    const existingTeams = await db.select().from(nflTeams);
    
    if (existingTeams.length >= 32) {
      console.log(`[NFL Teams] Teams already exist (${existingTeams.length} teams found). Updating if needed...`);
      
      // Update existing teams with correct data
      for (const teamData of NFL_TEAMS_DATA) {
        const existingTeam = existingTeams.find(t => t.code === teamData.code);
        if (existingTeam) {
          // Update the team data
          await db.update(nflTeams)
            .set({
              name: teamData.name,
              city: teamData.city,
              conference: teamData.conference,
              division: teamData.division,
              logoUrl: `/images/nfl/team_logos/${teamData.code}.png`
            })
            .where(eq(nflTeams.code, teamData.code));
        } else {
          // Insert missing team
          await db.insert(nflTeams).values({
            code: teamData.code,
            name: teamData.name,
            city: teamData.city,
            conference: teamData.conference,
            division: teamData.division,
            logoUrl: `/images/nfl/team_logos/${teamData.code}.png`,
            createdAt: new Date()
          });
        }
      }
    } else {
      console.log('[NFL Teams] Inserting missing teams...');
      
      // Insert missing teams only
      const existingCodes = new Set(existingTeams.map(t => t.code));
      const missingTeams = NFL_TEAMS_DATA.filter(team => !existingCodes.has(team.code));
      
      if (missingTeams.length > 0) {
        const teamsToInsert = missingTeams.map(team => ({
          code: team.code,
          name: team.name,
          city: team.city,
          conference: team.conference,
          division: team.division,
          logoUrl: `/images/nfl/team_logos/${team.code}.png`,
          createdAt: new Date()
        }));
        
        // Insert missing teams
        await db.insert(nflTeams).values(teamsToInsert);
        console.log(`[NFL Teams] Inserted ${teamsToInsert.length} missing teams`);
      }
    }
    
    // Get final count of teams
    const finalTeams = await db.select().from(nflTeams);
    console.log(`[NFL Teams] Successfully processed NFL teams. Total: ${finalTeams.length}`);
    
    res.json({
      success: true,
      message: `Successfully processed NFL teams. Total: ${finalTeams.length}`,
      totalTeams: finalTeams.length,
      teams: finalTeams.map(t => ({ code: t.code, name: t.name, city: t.city }))
    });
    
  } catch (error) {
    console.error('[NFL Teams] Error seeding teams:', error);
    res.status(500).json({
      error: 'Failed to seed NFL teams',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get team mapping (code to ID mapping for schedule import)
router.get('/team-mapping', async (req, res) => {
  try {
    const teams = await db.select().from(nflTeams);
    
    const mapping = teams.reduce((acc, team) => {
      acc[team.code] = team.id;
      return acc;
    }, {} as Record<string, string>);
    
    res.json({
      success: true,
      mapping,
      totalTeams: teams.length
    });
    
  } catch (error) {
    console.error('[NFL Teams] Error getting team mapping:', error);
    res.status(500).json({
      error: 'Failed to get team mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router };
export default router;