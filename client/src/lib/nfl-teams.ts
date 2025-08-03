export interface NFLTeam {
  id: number;
  name: string;
  displayName: string;
  shortName: string;
  abbreviation: string;
  color: string;
  secondaryColor: string;
  logo: string;
}

export const NFL_TEAMS: NFLTeam[] = [
  { id: 1, name: 'Cardinals', displayName: 'Arizona Cardinals', shortName: 'Cardinals', abbreviation: 'ARI', color: '#97233F', secondaryColor: '#000000', logo: '/team-logos/cardinals.svg' },
  { id: 2, name: 'Falcons', displayName: 'Atlanta Falcons', shortName: 'Falcons', abbreviation: 'ATL', color: '#A71930', secondaryColor: '#000000', logo: '/team-logos/falcons.svg' },
  { id: 3, name: 'Ravens', displayName: 'Baltimore Ravens', shortName: 'Ravens', abbreviation: 'BAL', color: '#241773', secondaryColor: '#000000', logo: '/team-logos/ravens.svg' },
  { id: 4, name: 'Bills', displayName: 'Buffalo Bills', shortName: 'Bills', abbreviation: 'BUF', color: '#00338D', secondaryColor: '#C60C30', logo: '/team-logos/bills.svg' },
  { id: 5, name: 'Panthers', displayName: 'Carolina Panthers', shortName: 'Panthers', abbreviation: 'CAR', color: '#0085CA', secondaryColor: '#101820', logo: '/team-logos/panthers.svg' },
  { id: 6, name: 'Bears', displayName: 'Chicago Bears', shortName: 'Bears', abbreviation: 'CHI', color: '#0B162A', secondaryColor: '#C83803', logo: '/team-logos/bears.svg' },
  { id: 7, name: 'Bengals', displayName: 'Cincinnati Bengals', shortName: 'Bengals', abbreviation: 'CIN', color: '#FB4F14', secondaryColor: '#000000', logo: '/team-logos/bengals.svg' },
  { id: 8, name: 'Browns', displayName: 'Cleveland Browns', shortName: 'Browns', abbreviation: 'CLE', color: '#311D00', secondaryColor: '#FF3C00', logo: '/team-logos/browns.svg' },
  { id: 9, name: 'Cowboys', displayName: 'Dallas Cowboys', shortName: 'Cowboys', abbreviation: 'DAL', color: '#003594', secondaryColor: '#869397', logo: '/team-logos/cowboys.svg' },
  { id: 10, name: 'Broncos', displayName: 'Denver Broncos', shortName: 'Broncos', abbreviation: 'DEN', color: '#FB4F14', secondaryColor: '#002244', logo: '/team-logos/broncos.svg' },
  { id: 11, name: 'Lions', displayName: 'Detroit Lions', shortName: 'Lions', abbreviation: 'DET', color: '#0076B6', secondaryColor: '#B0B7BC', logo: '/team-logos/lions.svg' },
  { id: 12, name: 'Packers', displayName: 'Green Bay Packers', shortName: 'Packers', abbreviation: 'GB', color: '#203731', secondaryColor: '#FFB612', logo: '/team-logos/packers.svg' },
  { id: 13, name: 'Texans', displayName: 'Houston Texans', shortName: 'Texans', abbreviation: 'HOU', color: '#03202F', secondaryColor: '#A71930', logo: '/team-logos/texans.svg' },
  { id: 14, name: 'Colts', displayName: 'Indianapolis Colts', shortName: 'Colts', abbreviation: 'IND', color: '#002C5F', secondaryColor: '#A2AAAD', logo: '/team-logos/colts.svg' },
  { id: 15, name: 'Jaguars', displayName: 'Jacksonville Jaguars', shortName: 'Jaguars', abbreviation: 'JAC', color: '#006778', secondaryColor: '#9F792C', logo: '/team-logos/jaguars.svg' },
  { id: 16, name: 'Chiefs', displayName: 'Kansas City Chiefs', shortName: 'Chiefs', abbreviation: 'KC', color: '#E31837', secondaryColor: '#FFB81C', logo: '/team-logos/chiefs.svg' },
  { id: 17, name: 'Raiders', displayName: 'Las Vegas Raiders', shortName: 'Raiders', abbreviation: 'LV', color: '#000000', secondaryColor: '#A5ACAF', logo: '/team-logos/raiders.svg' },
  { id: 18, name: 'Chargers', displayName: 'Los Angeles Chargers', shortName: 'Chargers', abbreviation: 'LAC', color: '#0080C6', secondaryColor: '#FFC20E', logo: '/team-logos/chargers.svg' },
  { id: 19, name: 'Rams', displayName: 'Los Angeles Rams', shortName: 'Rams', abbreviation: 'LAR', color: '#003594', secondaryColor: '#FFA300', logo: '/team-logos/rams.svg' },
  { id: 20, name: 'Dolphins', displayName: 'Miami Dolphins', shortName: 'Dolphins', abbreviation: 'MIA', color: '#008E97', secondaryColor: '#FC4C02', logo: '/team-logos/dolphins.svg' },
  { id: 21, name: 'Vikings', displayName: 'Minnesota Vikings', shortName: 'Vikings', abbreviation: 'MIN', color: '#4F2683', secondaryColor: '#FFC62F', logo: '/team-logos/vikings.svg' },
  { id: 22, name: 'Patriots', displayName: 'New England Patriots', shortName: 'Patriots', abbreviation: 'NE', color: '#002244', secondaryColor: '#C60C30', logo: '/team-logos/patriots.svg' },
  { id: 23, name: 'Saints', displayName: 'New Orleans Saints', shortName: 'Saints', abbreviation: 'NO', color: '#D3BC8D', secondaryColor: '#101820', logo: '/team-logos/saints.svg' },
  { id: 24, name: 'Giants', displayName: 'New York Giants', shortName: 'Giants', abbreviation: 'NYG', color: '#0B2265', secondaryColor: '#A71930', logo: '/team-logos/giants.svg' },
  { id: 25, name: 'Jets', displayName: 'New York Jets', shortName: 'Jets', abbreviation: 'NYJ', color: '#125740', secondaryColor: '#000000', logo: '/team-logos/jets.svg' },
  { id: 26, name: 'Eagles', displayName: 'Philadelphia Eagles', shortName: 'Eagles', abbreviation: 'PHI', color: '#004C54', secondaryColor: '#A5ACAF', logo: '/team-logos/eagles.svg' },
  { id: 27, name: 'Steelers', displayName: 'Pittsburgh Steelers', shortName: 'Steelers', abbreviation: 'PIT', color: '#FFB612', secondaryColor: '#101820', logo: '/team-logos/steelers.svg' },
  { id: 28, name: '49ers', displayName: 'San Francisco 49ers', shortName: '49ers', abbreviation: 'SF', color: '#AA0000', secondaryColor: '#B3995D', logo: '/team-logos/49ers.svg' },
  { id: 29, name: 'Seahawks', displayName: 'Seattle Seahawks', shortName: 'Seahawks', abbreviation: 'SEA', color: '#002244', secondaryColor: '#69BE28', logo: '/team-logos/seahawks.svg' },
  { id: 30, name: 'Buccaneers', displayName: 'Tampa Bay Buccaneers', shortName: 'Buccaneers', abbreviation: 'TB', color: '#D50A0A', secondaryColor: '#FF7900', logo: '/team-logos/buccaneers.svg' },
  { id: 31, name: 'Titans', displayName: 'Tennessee Titans', shortName: 'Titans', abbreviation: 'TEN', color: '#0C2340', secondaryColor: '#4B92DB', logo: '/team-logos/titans.svg' },
  { id: 32, name: 'Commanders', displayName: 'Washington Commanders', shortName: 'Commanders', abbreviation: 'WAS', color: '#5A1414', secondaryColor: '#FFB612', logo: '/team-logos/commanders.svg' }
];

export function getTeamById(id: number): NFLTeam | undefined {
  return NFL_TEAMS.find(team => team.id === id);
}

export function getTeamByAbbreviation(abbreviation: string): NFLTeam | undefined {
  return NFL_TEAMS.find(team => team.abbreviation === abbreviation);
}

export function getRandomTeams(count: number): NFLTeam[] {
  const shuffled = [...NFL_TEAMS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function getFullTeamName(team: NFLTeam): string {
  return team.displayName;
}