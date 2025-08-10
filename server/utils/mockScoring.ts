// Mock scoring system for Mok Sports
// This creates realistic team performance data for testing

export interface TeamScore {
  teamCode: string;
  week: number;
  wins: number;
  losses: number;
  ties: number;
  points: number; // Final score in game
  opponentPoints: number;
  isBlowout: boolean; // Won by 20+ points
  isShutout: boolean; // Held opponent to 0 points
  weeklyHigh: boolean; // Highest score this week
  weeklyLow: boolean; // Lowest score this week
  mokPoints: number; // Total Mok Sports points for this performance
}

export interface WeeklyStats {
  week: number;
  highestScore: number;
  lowestScore: number;
  highestScoringTeam: string;
  lowestScoringTeam: string;
  totalGames: number;
}

// Mock scoring calculation based on Mok Sports rules
export function calculateMokPoints(score: TeamScore, weekStats: WeeklyStats): number {
  let mokPoints = 0;
  
  // Base points for wins/ties
  mokPoints += score.wins * 1; // +1 for wins
  mokPoints += score.ties * 0.5; // +0.5 for ties
  
  // Bonus points
  if (score.isBlowout) mokPoints += 1; // +1 for blowout win (20+ points)
  if (score.isShutout) mokPoints += 1; // +1 for shutout defense
  if (score.weeklyHigh) mokPoints += 1; // +1 for weekly high score
  if (score.weeklyLow) mokPoints -= 1; // -1 for weekly low score
  
  return mokPoints;
}

// Generate realistic NFL scores for a week
export function generateWeeklyScores(teams: string[], week: number): TeamScore[] {
  const scores: TeamScore[] = [];
  const gameResults: { teamCode: string; points: number; opponentPoints: number; won: boolean }[] = [];
  
  // Shuffle teams for random matchups
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  
  // Create matchups (assuming even number of teams)
  for (let i = 0; i < shuffledTeams.length; i += 2) {
    if (i + 1 < shuffledTeams.length) {
      const team1 = shuffledTeams[i];
      const team2 = shuffledTeams[i + 1];
      
      // Generate realistic NFL scores (10-45 point range)
      const score1 = Math.floor(Math.random() * 35) + 10;
      const score2 = Math.floor(Math.random() * 35) + 10;
      
      // Determine winner (or tie)
      const team1Won = score1 > score2;
      const isTie = score1 === score2;
      
      gameResults.push({
        teamCode: team1,
        points: score1,
        opponentPoints: score2,
        won: team1Won
      });
      
      gameResults.push({
        teamCode: team2,
        points: score2,
        opponentPoints: score1,
        won: !team1Won && !isTie
      });
    }
  }
  
  // Find weekly high/low
  const allScores = gameResults.map(r => r.points);
  const highestScore = Math.max(...allScores);
  const lowestScore = Math.min(...allScores);
  
  const weekStats: WeeklyStats = {
    week,
    highestScore,
    lowestScore,
    highestScoringTeam: gameResults.find(r => r.points === highestScore)?.teamCode || '',
    lowestScoringTeam: gameResults.find(r => r.points === lowestScore)?.teamCode || '',
    totalGames: gameResults.length / 2
  };
  
  // Convert game results to TeamScore format
  for (const result of gameResults) {
    const isBlowout = result.won && (result.points - result.opponentPoints) >= 20;
    const isShutout = result.won && result.opponentPoints === 0;
    const weeklyHigh = result.points === weekStats.highestScore;
    const weeklyLow = result.points === weekStats.lowestScore;
    
    const teamScore: TeamScore = {
      teamCode: result.teamCode,
      week,
      wins: result.won ? 1 : 0,
      losses: !result.won ? 1 : 0,
      ties: 0, // Simplified - no ties for now
      points: result.points,
      opponentPoints: result.opponentPoints,
      isBlowout,
      isShutout,
      weeklyHigh,
      weeklyLow,
      mokPoints: 0 // Will be calculated below
    };
    
    // Calculate Mok points
    teamScore.mokPoints = calculateMokPoints(teamScore, weekStats);
    scores.push(teamScore);
  }
  
  return scores;
}

// Generate season-long stats for a team
export function generateSeasonStats(teamCode: string, currentWeek: number): {
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalMokPoints: number;
  weeklyBreakdown: TeamScore[];
  averagePointsFor: number;
  averagePointsAgainst: number;
  blowoutWins: number;
  shutouts: number;
  weeklyHighs: number;
  weeklyLows: number;
} {
  const weeklyBreakdown: TeamScore[] = [];
  let totalMokPoints = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalTies = 0;
  let totalPointsFor = 0;
  let totalPointsAgainst = 0;
  let blowoutWins = 0;
  let shutouts = 0;
  let weeklyHighs = 0;
  let weeklyLows = 0;
  
  // Generate performance for each completed week
  for (let week = 1; week <= currentWeek; week++) {
    // Generate a single team's performance (simplified)
    const points = Math.floor(Math.random() * 35) + 10;
    const opponentPoints = Math.floor(Math.random() * 35) + 10;
    const won = points > opponentPoints;
    const tie = points === opponentPoints;
    
    const isBlowout = won && (points - opponentPoints) >= 14;
    const isShutout = won && opponentPoints === 0;
    // Simplified: ~15% chance of weekly high/low
    const weeklyHigh = Math.random() < 0.15;
    const weeklyLow = Math.random() < 0.15;
    
    const teamScore: TeamScore = {
      teamCode,
      week,
      wins: won ? 1 : 0,
      losses: tie ? 0 : (won ? 0 : 1),
      ties: tie ? 1 : 0,
      points,
      opponentPoints,
      isBlowout,
      isShutout,
      weeklyHigh,
      weeklyLow,
      mokPoints: 0
    };
    
    // Calculate Mok points (simplified without full week context)
    let mokPoints = 0;
    mokPoints += teamScore.wins * 1;
    mokPoints += teamScore.ties * 0.5;
    if (isBlowout) mokPoints += 1;
    if (isShutout) mokPoints += 1;
    if (weeklyHigh) mokPoints += 1;
    if (weeklyLow) mokPoints -= 1;
    
    teamScore.mokPoints = mokPoints;
    weeklyBreakdown.push(teamScore);
    
    // Accumulate totals
    totalMokPoints += mokPoints;
    totalWins += teamScore.wins;
    totalLosses += teamScore.losses;
    totalTies += teamScore.ties;
    totalPointsFor += points;
    totalPointsAgainst += opponentPoints;
    if (isBlowout) blowoutWins++;
    if (isShutout) shutouts++;
    if (weeklyHigh) weeklyHighs++;
    if (weeklyLow) weeklyLows++;
  }
  
  return {
    totalWins,
    totalLosses,
    totalTies,
    totalMokPoints,
    weeklyBreakdown,
    averagePointsFor: currentWeek > 0 ? Math.round(totalPointsFor / currentWeek) : 0,
    averagePointsAgainst: currentWeek > 0 ? Math.round(totalPointsAgainst / currentWeek) : 0,
    blowoutWins,
    shutouts,
    weeklyHighs,
    weeklyLows
  };
}

// Generate mock team data with realistic performance metrics
export function generateTeamPerformanceData(teamCode: string, currentWeek: number) {
  const seasonStats = generateSeasonStats(teamCode, currentWeek);
  
  // Generate upcoming opponent and spread
  const opponents = ['vs. KC', 'vs. BUF', '@ DAL', 'vs. SF', '@ NE', 'vs. LAC', '@ MIA'];
  const upcomingOpponent = opponents[Math.floor(Math.random() * opponents.length)];
  const pointSpread = (Math.random() * 14 - 7).toFixed(1); // -7.0 to +7.0
  
  // Calculate locks remaining (max 4 per team, subtract random usage)
  const locksUsed = Math.floor(Math.random() * Math.min(currentWeek, 4));
  const locksRemaining = 4 - locksUsed;
  
  // Lock & Load availability (once per team per season)
  const lockAndLoadUsed = Math.random() < 0.3; // 30% chance it's been used
  
  return {
    ...seasonStats,
    upcomingOpponent,
    pointSpread: parseFloat(pointSpread),
    locksUsed,
    locksRemaining,
    lockAndLoadUsed,
    lockAndLoadAvailable: !lockAndLoadUsed,
    record: `${seasonStats.totalWins}-${seasonStats.totalLosses}${seasonStats.totalTies > 0 ? `-${seasonStats.totalTies}` : ''}`,
    isBye: false, // Simplified - no bye weeks for now
    isLocked: false // Will be determined by current user selections
  };
}