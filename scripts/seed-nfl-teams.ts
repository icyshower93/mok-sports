#!/usr/bin/env tsx

/**
 * NFL Teams Data Seeder
 * Seeds the database with all 32 NFL teams using Fantasy Nerds structure
 * Logo URLs follow Fantasy Nerds format: https://www.fantasynerds.com/images/nfl/teams/{CODE}.png
 */

import { db } from "../server/db.js";
import { nflTeams } from "../shared/schema.js";

const NFL_TEAMS_DATA = [
  // AFC East
  { code: "BUF", name: "Bills", city: "Buffalo", conference: "AFC", division: "East" },
  { code: "MIA", name: "Dolphins", city: "Miami", conference: "AFC", division: "East" },
  { code: "NE", name: "Patriots", city: "New England", conference: "AFC", division: "East" },
  { code: "NYJ", name: "Jets", city: "New York", conference: "AFC", division: "East" },

  // AFC North
  { code: "BAL", name: "Ravens", city: "Baltimore", conference: "AFC", division: "North" },
  { code: "CIN", name: "Bengals", city: "Cincinnati", conference: "AFC", division: "North" },
  { code: "CLE", name: "Browns", city: "Cleveland", conference: "AFC", division: "North" },
  { code: "PIT", name: "Steelers", city: "Pittsburgh", conference: "AFC", division: "North" },

  // AFC South
  { code: "HOU", name: "Texans", city: "Houston", conference: "AFC", division: "South" },
  { code: "IND", name: "Colts", city: "Indianapolis", conference: "AFC", division: "South" },
  { code: "JAX", name: "Jaguars", city: "Jacksonville", conference: "AFC", division: "South" },
  { code: "TEN", name: "Titans", city: "Tennessee", conference: "AFC", division: "South" },

  // AFC West
  { code: "DEN", name: "Broncos", city: "Denver", conference: "AFC", division: "West" },
  { code: "KC", name: "Chiefs", city: "Kansas City", conference: "AFC", division: "West" },
  { code: "LV", name: "Raiders", city: "Las Vegas", conference: "AFC", division: "West" },
  { code: "LAC", name: "Chargers", city: "Los Angeles", conference: "AFC", division: "West" },

  // NFC East
  { code: "DAL", name: "Cowboys", city: "Dallas", conference: "NFC", division: "East" },
  { code: "NYG", name: "Giants", city: "New York", conference: "NFC", division: "East" },
  { code: "PHI", name: "Eagles", city: "Philadelphia", conference: "NFC", division: "East" },
  { code: "WAS", name: "Commanders", city: "Washington", conference: "NFC", division: "East" },

  // NFC North
  { code: "CHI", name: "Bears", city: "Chicago", conference: "NFC", division: "North" },
  { code: "DET", name: "Lions", city: "Detroit", conference: "NFC", division: "North" },
  { code: "GB", name: "Packers", city: "Green Bay", conference: "NFC", division: "North" },
  { code: "MIN", name: "Vikings", city: "Minnesota", conference: "NFC", division: "North" },

  // NFC South
  { code: "ATL", name: "Falcons", city: "Atlanta", conference: "NFC", division: "South" },
  { code: "CAR", name: "Panthers", city: "Carolina", conference: "NFC", division: "South" },
  { code: "NO", name: "Saints", city: "New Orleans", conference: "NFC", division: "South" },
  { code: "TB", name: "Buccaneers", city: "Tampa Bay", conference: "NFC", division: "South" },

  // NFC West
  { code: "ARI", name: "Cardinals", city: "Arizona", conference: "NFC", division: "West" },
  { code: "LAR", name: "Rams", city: "Los Angeles", conference: "NFC", division: "West" },
  { code: "SF", name: "49ers", city: "San Francisco", conference: "NFC", division: "West" },
  { code: "SEA", name: "Seahawks", city: "Seattle", conference: "NFC", division: "West" },
];

async function seedNflTeams() {
  console.log("🏈 Starting NFL teams seeding...");
  
  try {
    // Clear existing teams
    await db.delete(nflTeams);
    console.log("🗑️  Cleared existing NFL teams");

    // Insert all teams with Fantasy Nerds logo URLs
    const teamsWithLogos = NFL_TEAMS_DATA.map(team => ({
      ...team,
      logoUrl: `https://www.fantasynerds.com/images/nfl/teams/${team.code}.png`
    }));

    await db.insert(nflTeams).values(teamsWithLogos);
    
    console.log(`✅ Successfully seeded ${NFL_TEAMS_DATA.length} NFL teams`);
    console.log("📊 Teams by conference:");
    
    const afcCount = NFL_TEAMS_DATA.filter(t => t.conference === "AFC").length;
    const nfcCount = NFL_TEAMS_DATA.filter(t => t.conference === "NFC").length;
    
    console.log(`   AFC: ${afcCount} teams`);
    console.log(`   NFC: ${nfcCount} teams`);
    console.log(`   Total: ${afcCount + nfcCount} teams`);
    
    console.log("🎯 Logo URLs use Fantasy Nerds format: https://www.fantasynerds.com/images/nfl/teams/{CODE}.png");
    
  } catch (error) {
    console.error("❌ Error seeding NFL teams:", error);
    throw error;
  }
}

// Run the seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedNflTeams()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedNflTeams };