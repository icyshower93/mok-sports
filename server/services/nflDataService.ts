import fetch from 'node-fetch';

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
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
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

  async getScheduleForSeason(season: number = 2024): Promise<NFLGameData[]> {
    try {
      console.log(`[NFLDataService] Getting schedule for ${season} season...`);
      
      // Get NFL teams first to understand the API structure
      const teamsData = await this.getTeamsData();
      console.log(`[NFLDataService] Got ${teamsData.length} teams from API`);
      
      const games: NFLGameData[] = [];
      
      // Try multiple approaches to get games
      // Approach 1: Get games for specific dates in the 2024 season
      const key2024Dates = [
        '2024-09-05', // Week 1 started Thursday Sept 5, 2024
        '2024-09-08', // Sunday Sept 8
        '2024-09-15', // Week 2
        '2024-09-22', // Week 3
        '2024-09-29', // Week 4
        '2024-10-06', // Week 5
        '2024-10-13', // Week 6
        '2024-10-20', // Week 7
      ];

      for (const gameDate of key2024Dates) {
        try {
          console.log(`[NFLDataService] Fetching games for ${gameDate}...`);
          const dateGames = await this.makeRapidAPIRequest(
            `/getNFLGamesForDate?teamAbv=all&gameDate=${gameDate}&topPerformers=false&twoPointConversions=false`
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
    const seasonStart = new Date('2024-09-05'); // Week 1 started Sept 5, 2024
    const diffTime = date.getTime() - seasonStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 7) + 1;
  }

  async getWeekData(season: number, week: number): Promise<NFLGameData[]> {
    try {
      // Calculate approximate date for the week
      const startDate = new Date('2024-09-05'); // Week 1 started Sept 5, 2024
      const weekStart = new Date(startDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      const dateStr = weekStart.toISOString().split('T')[0];
      
      const data = await this.makeRapidAPIRequest(
        `/getNFLGamesForDate?teamAbv=all&gameDate=${dateStr}&topPerformers=false&twoPointConversions=false`
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