// NFL Teams utility functions and types

export interface NflTeam {
  id: string;
  code: string;
  name: string;
  city: string;
  logoSmall: string;  // 50x50px GIF
  logoLarge: string;  // 130x115px PNG
  createdAt: string;
}

/**
 * Get the small logo URL for an NFL team
 * @param teamCode - The 3-letter team code (e.g., "BUF", "GB")
 * @returns URL to the 50x50px GIF logo
 */
export function getSmallTeamLogo(teamCode: string): string {
  return `https://www.fantasynerds.com/images/nfl/teams/${teamCode}.gif`;
}

/**
 * Get the large logo URL for an NFL team
 * @param teamCode - The 3-letter team code (e.g., "BUF", "GB") 
 * @returns URL to the 130x115px PNG logo
 */
export function getLargeTeamLogo(teamCode: string): string {
  return `https://www.fantasynerds.com/images/nfl/team_logos/${teamCode}.png`;
}

/**
 * Get both logo sizes for an NFL team
 * @param teamCode - The 3-letter team code
 * @returns Object with both logo URLs
 */
export function getTeamLogos(teamCode: string) {
  return {
    small: getSmallTeamLogo(teamCode),
    large: getLargeTeamLogo(teamCode),
  };
}

/**
 * Format team display name with city and team name
 * @param team - NflTeam object
 * @returns Formatted string like "Buffalo Bills"
 */
export function getFullTeamName(team: Pick<NflTeam, 'city' | 'name'>): string {
  return `${team.city} ${team.name}`;
}