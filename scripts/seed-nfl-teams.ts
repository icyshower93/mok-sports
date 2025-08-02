#!/usr/bin/env tsx

import { db } from "../server/db";
import { nflTeams } from "../shared/schema";

const NFL_TEAMS = [
  { code: "ARI", name: "Cardinals", city: "Arizona" },
  { code: "ATL", name: "Falcons", city: "Atlanta" },
  { code: "BAL", name: "Ravens", city: "Baltimore" },
  { code: "BUF", name: "Bills", city: "Buffalo" },
  { code: "CAR", name: "Panthers", city: "Carolina" },
  { code: "CHI", name: "Bears", city: "Chicago" },
  { code: "CIN", name: "Bengals", city: "Cincinnati" },
  { code: "CLE", name: "Browns", city: "Cleveland" },
  { code: "DAL", name: "Cowboys", city: "Dallas" },
  { code: "DEN", name: "Broncos", city: "Denver" },
  { code: "DET", name: "Lions", city: "Detroit" },
  { code: "GB", name: "Packers", city: "Green Bay" },
  { code: "HOU", name: "Texans", city: "Houston" },
  { code: "IND", name: "Colts", city: "Indianapolis" },
  { code: "JAC", name: "Jaguars", city: "Jacksonville" },
  { code: "KC", name: "Chiefs", city: "Kansas City" },
  { code: "MIA", name: "Dolphins", city: "Miami" },
  { code: "MIN", name: "Vikings", city: "Minnesota" },
  { code: "NE", name: "Patriots", city: "New England" },
  { code: "NO", name: "Saints", city: "New Orleans" },
  { code: "NYG", name: "Giants", city: "New York" },
  { code: "NYJ", name: "Jets", city: "New York" },
  { code: "LV", name: "Raiders", city: "Las Vegas" },
  { code: "PHI", name: "Eagles", city: "Philadelphia" },
  { code: "PIT", name: "Steelers", city: "Pittsburgh" },
  { code: "LAC", name: "Chargers", city: "Los Angeles" },
  { code: "SEA", name: "Seahawks", city: "Seattle" },
  { code: "SF", name: "49ers", city: "San Francisco" },
  { code: "LAR", name: "Rams", city: "Los Angeles" },
  { code: "TB", name: "Buccaneers", city: "Tampa Bay" },
  { code: "TEN", name: "Titans", city: "Tennessee" },
  { code: "WAS", name: "Commanders", city: "Washington" },
];

async function seedNflTeams() {
  console.log("🏈 Starting NFL teams seeding...");
  
  try {
    // Clear existing teams
    console.log("🧹 Clearing existing NFL teams...");
    await db.delete(nflTeams);
    
    // Insert all teams
    console.log("📝 Inserting NFL teams...");
    await db.insert(nflTeams).values(NFL_TEAMS);
    
    console.log(`✅ Successfully seeded ${NFL_TEAMS.length} NFL teams!`);
    
    // Verify the insert
    const count = await db.select().from(nflTeams);
    console.log(`🔍 Verification: ${count.length} teams found in database`);
    
  } catch (error) {
    console.error("❌ Error seeding NFL teams:", error);
    process.exit(1);
  }
}

seedNflTeams()
  .then(() => {
    console.log("🎉 NFL teams seeding completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });