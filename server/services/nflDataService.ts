// Using native fetch (Node.js 18+) - no import needed

// Tank01 RapidAPI configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';

interface Tank01Game {
  gameID: string;
  season: number;
  week: number;
  gameDate: string;
  gameTime: string;
  awayTeam: string;
  homeTeam: string;
  awayPts: number | null;
  homePts: number | null;
  gameStatus: string;
  gameWeek: string;
}

interface Tank01BettingOdds {
  gameID: string;
  gameDate: string;
  teamAbv: string;
  pointSpreadAway: number;
  pointSpreadHome: number;
  totalOver: number;
  totalUnder: number;
  moneyLineAway: number;
  moneyLineHome: number;
  lastUpdated: string;
}

interface NFLGameData {
  id: string;
  week: number;
  season: number;
  gameDate: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isCompleted: boolean;
  status: 'scheduled' | 'live' | 'completed';
  pointSpread?: number; // Point spread (positive means home team is favored)
}

class NFLDataService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async makeRapidAPIRequest(endpoint: string): Promise<any> {
    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY not found in environment variables');
    }

    const cacheKey = endpoint;
    const now = Date.now();
    
    // Check cache
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`https://${RAPIDAPI_HOST}${endpoint}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
      });

      if (!response.ok) {
        throw new Error(`Tank01 API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the response
      this.cache.set(cacheKey, data);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
      
      return data;
    } catch (error) {
      console.error(`Tank01 API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getScheduleForSeason(season: number = 2025): Promise<NFLGameData[]> {
    try {
      console.log(`[NFLDataService] Getting schedule for ${season} season...`);
      
      // Get NFL teams first to understand the API structure
      const teamsData = await this.getTeamsData();
      console.log(`[NFLDataService] Got ${teamsData.length} teams from API`);
      
      const games: NFLGameData[] = [];
      
      // Get games for 2025 preseason dates
      const preseason2025Dates = [
        '2025-08-08', // Preseason Week 1 starts
        '2025-08-10', // More Preseason Week 1 games
        '2025-08-15', // Preseason Week 2 starts
        '2025-08-16', // More Preseason Week 2 games
        '2025-08-17', // More Preseason Week 2 games
        '2025-08-22', // Preseason Week 3 starts
        '2025-08-23', // More Preseason Week 3 games
        '2025-08-29', // Preseason Week 4 (if exists)
        '2025-08-30', // More Preseason Week 4 games
      ];

      for (const gameDate of preseason2025Dates) {
        try {
          console.log(`[NFLDataService] Fetching games for ${gameDate}...`);
          const dateGames = await this.makeRapidAPIRequest(
            `/getNFLGamesForDate?gameDate=${gameDate.replace(/-/g, '')}`
          );
          
          if (dateGames && dateGames.body) {
            console.log(`[NFLDataService] Found ${dateGames.body.length} games for ${gameDate}`);
            for (const gameData of dateGames.body) {
              const game: NFLGameData = {
                id: gameData.gameID || `${gameData.awayTeam}@${gameData.homeTeam}_${gameDate}`,
                week: this.getWeekFromDate(gameDate),
                season,
                gameDate: new Date(gameData.gameDate || gameDate),
                homeTeam: gameData.homeTeam,
                awayTeam: gameData.awayTeam,
                homeScore: gameData.homePts,
                awayScore: gameData.awayPts,
                isCompleted: gameData.gameStatus === 'Completed' || gameData.gameStatus === 'Final',
                status: this.mapGameStatus(gameData.gameStatus),
              };
              games.push(game);
            }
          } else {
            console.log(`[NFLDataService] No games found for ${gameDate}`);
          }
        } catch (error) {
          console.warn(`[NFLDataService] Failed to get games for ${gameDate}:`, error);
        }
      }
      
      console.log(`[NFLDataService] Total games loaded: ${games.length}`);
      return games;
    } catch (error) {
      console.error('[NFLDataService] Failed to get NFL schedule:', error);
      return [];
    }
  }

  private getWeekFromDate(dateStr: string): number {
    const date = new Date(dateStr);
    const preseasonStart = new Date('2025-08-08'); // Preseason Week 1 starts Aug 8, 2025
    const diffTime = date.getTime() - preseasonStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.ceil(diffDays / 7) + 1);
  }

  async getWeekData(season: number, week: number): Promise<NFLGameData[]> {
    try {
      // Calculate approximate date for the week
      const startDate = new Date('2025-08-08'); // Preseason Week 1 starts Aug 8, 2025
      const weekStart = new Date(startDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const dateStr = weekStart.toISOString().split('T')[0];
      
      const data = await this.makeRapidAPIRequest(
        `/getNFLGamesForDate?gameDate=${dateStr.replace(/-/g, '')}`
      );
      
      const games: NFLGameData[] = [];
      
      if (data && data.body) {
        for (const gameData of data.body) {
          const game: NFLGameData = {
            id: gameData.gameID || `${gameData.awayTeam}@${gameData.homeTeam}_${dateStr}`,
            week,
            season,
            gameDate: new Date(gameData.gameDate || dateStr),
            homeTeam: gameData.homeTeam,
            awayTeam: gameData.awayTeam,
            homeScore: gameData.homePts,
            awayScore: gameData.awayPts,
            isCompleted: gameData.gameStatus === 'Completed' || gameData.gameStatus === 'Final',
            status: this.mapGameStatus(gameData.gameStatus),
          };
          games.push(game);
        }
      }
      
      return games;
    } catch (error) {
      console.error(`Failed to get week ${week} data:`, error);
      return [];
    }
  }

  private mapGameStatus(status: string): 'scheduled' | 'live' | 'completed' {
    const statusLower = (status || '').toLowerCase();
    
    if (statusLower.includes('final') || statusLower.includes('completed')) {
      return 'completed';
    } else if (statusLower.includes('live') || statusLower.includes('in progress')) {
      return 'live';
    } else {
      return 'scheduled';
    }
  }

  async getTeamsData(): Promise<any[]> {
    try {
      const data = await this.makeRapidAPIRequest('/getNFLTeams?rosters=false&schedules=false&topPerformers=false&teamStats=false');
      return data?.body || [];
    } catch (error) {
      console.error('Failed to get teams data:', error);
      return [];
    }
  }

  async getBettingOddsForDate(gameDate: string): Promise<Tank01BettingOdds[]> {
    try {
      console.log(`[NFLDataService] Fetching betting odds for ${gameDate}...`);
      const data = await this.makeRapidAPIRequest(`/getNFLBettingOdds?gameDate=${gameDate}&itemFormat=list&impliedTotals=true`);
      
      if (data && data.statusCode === 200 && data.body && Array.isArray(data.body)) {
        console.log(`[NFLDataService] Got betting odds for ${data.body.length} games on ${gameDate}`);
        return data.body.map((odds: any) => ({
          gameID: odds.gameID || '',
          gameDate: odds.gameDate || gameDate,
          teamAbv: odds.teamAbv || '',
          pointSpreadAway: parseFloat(odds.pointSpreadAway) || 0,
          pointSpreadHome: parseFloat(odds.pointSpreadHome) || 0,
          totalOver: parseFloat(odds.totalOver) || 0,
          totalUnder: parseFloat(odds.totalUnder) || 0,
          moneyLineAway: parseFloat(odds.moneyLineAway) || 0,
          moneyLineHome: parseFloat(odds.moneyLineHome) || 0,
          lastUpdated: odds.lastUpdated || new Date().toISOString()
        }));
      }
      
      console.log(`[NFLDataService] No betting odds found for ${gameDate}`);
      return [];
    } catch (error) {
      console.warn(`[NFLDataService] Failed to get betting odds for ${gameDate}:`, error);
      return [];
    }
  }

  async getBettingOddsForGame(gameID: string): Promise<Tank01BettingOdds | null> {
    try {
      console.log(`[NFLDataService] Fetching betting odds for game ${gameID}...`);
      const data = await this.makeRapidAPIRequest(`/getNFLBettingOdds?gameID=${gameID}`);
      
      if (data && data.body && Object.keys(data.body).length > 0) {
        const odds = Object.values(data.body)[0] as Tank01BettingOdds;
        console.log(`[NFLDataService] Got betting odds for game ${gameID}: spread ${odds.pointSpreadHome}`);
        return odds;
      }
      
      console.log(`[NFLDataService] No betting odds found for game ${gameID}`);
      return null;
    } catch (error) {
      console.warn(`[NFLDataService] Failed to get betting odds for game ${gameID}:`, error);
      return null;
    }
  }

  // Get games that should be "completed" based on the simulated current time
  async getGamesForTimeSimulation(simulatedWeek: number, simulatedDay: string, simulatedTime: string): Promise<NFLGameData[]> {
    try {
      const allGames = await this.getScheduleForSeason(2024);
      
      // Filter games based on the simulated time
      return allGames.filter(game => {
        // If we're simulating a time past this game's week, it should be "completed"
        if (game.week < simulatedWeek) {
          return true;
        }
        
        // If we're in the same week, check day/time logic
        if (game.week === simulatedWeek) {
          // For simplicity, if we're past Thursday 8:20 PM, show all games as completed
          if (simulatedDay === 'thursday') {
            const [hour, minute] = simulatedTime.split(':').map(Number);
            return hour > 20 || (hour === 20 && minute >= 20);
          }
          // If it's Friday or later, show completed
          const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const currentDayIndex = dayOrder.indexOf(simulatedDay);
          return currentDayIndex > 3; // Past Thursday
        }
        
        return false;
      });
    } catch (error) {
      console.error('Failed to get games for time simulation:', error);
      return [];
    }
  }
}

export const nflDataService = new NFLDataService();
export type { NFLGameData };