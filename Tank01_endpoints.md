# Tank01 NFL API Endpoints Documentation

## Overview
Tank01 NFL API provides comprehensive NFL data including games, teams, scores, betting odds, and player statistics. This documentation compiles all Tank01/RapidAPI integration code used in the Mok Sports fantasy application.

## API Configuration

### Environment Setup
```typescript
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
```

### Base Request Function
```typescript
private async makeRapidAPIRequest(endpoint: string): Promise<any> {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY not found in environment variables');
  }

  const cacheKey = endpoint;
  const now = Date.now();
  
  // Check cache (1 hour cache duration)
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
    
    // Cache the response (1 hour)
    this.cache.set(cacheKey, data);
    this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
    
    return data;
  } catch (error) {
    console.error(`Tank01 API request failed for ${endpoint}:`, error);
    throw error;
  }
}
```

## Core Endpoints

### 1. Get NFL Games for Date
**Endpoint:** `/getNFLGamesForDate`

**Usage:**
```typescript
async getGamesForDate(gameDate: string): Promise<any[]> {
  try {
    console.log(`[NFLDataService] Fetching games for date ${gameDate}...`);
    const data = await this.makeRapidAPIRequest(`/getNFLGamesForDate?gameDate=${gameDate}`);
    
    if (data && data.statusCode === 200 && data.body && Array.isArray(data.body)) {
      console.log(`[NFLDataService] Got ${data.body.length} games for ${gameDate}`);
      return data.body;
    }
    
    console.log(`[NFLDataService] No games found for ${gameDate}`);
    return [];
  } catch (error) {
    console.warn(`[NFLDataService] Failed to get games for ${gameDate}:`, error);
    return [];
  }
}
```

**Parameters:**
- `gameDate`: Date in format YYYYMMDD (e.g., "20241001")

**Example Response:**
```json
{
  "statusCode": 200,
  "body": [
    {
      "gameID": "20241001_DAL@PIT",
      "gameDate": "2024-10-01",
      "homeTeam": "PIT",
      "awayTeam": "DAL",
      "homePts": "14",
      "awayPts": "21",
      "gameStatus": "Final"
    }
  ]
}
```

### 2. Get NFL Teams
**Endpoint:** `/getNFLTeams`

**Usage:**
```typescript
async getTeamsData(): Promise<any[]> {
  try {
    const data = await this.makeRapidAPIRequest('/getNFLTeams?rosters=false&schedules=false&topPerformers=false&teamStats=false');
    return data?.body || [];
  } catch (error) {
    console.error('Failed to get teams data:', error);
    return [];
  }
}
```

**Parameters:**
- `rosters`: boolean (default: false)
- `schedules`: boolean (default: false)
- `topPerformers`: boolean (default: false)
- `teamStats`: boolean (default: false)

### 3. Get NFL Betting Odds
**Endpoint:** `/getNFLBettingOdds`

**Usage by Date:**
```typescript
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
```

**Usage by Game ID:**
```typescript
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
```

**Parameters:**
- `gameDate`: Date in YYYYMMDD format
- `gameID`: Specific game identifier
- `itemFormat`: "list" or "object"
- `impliedTotals`: boolean

### 4. Get NFL Box Score
**Endpoint:** `/getNFLBoxScore`

**Usage:**
```typescript
async getGameBoxScore(gameID: string): Promise<any> {
  try {
    console.log(`[NFLDataService] Fetching box score for game ${gameID}...`);
    const data = await this.makeRapidAPIRequest(`/getNFLBoxScore?gameID=${gameID}&playByPlay=false&fantasyPoints=false`);
    
    if (data && data.statusCode === 200 && data.body) {
      console.log(`[NFLDataService] Got box score for game ${gameID}`);
      return data.body;
    }
    
    console.log(`[NFLDataService] No box score found for game ${gameID}`);
    return null;
  } catch (error) {
    console.warn(`[NFLDataService] Failed to get box score for game ${gameID}:`, error);
    return null;
  }
}
```

**Parameters:**
- `gameID`: Game identifier
- `playByPlay`: boolean (default: false)
- `fantasyPoints`: boolean (default: false)

### 5. Get NFL Game Info
**Endpoint:** `/getNFLGameInfo`

**Usage:**
```typescript
async getGameInfo(gameID: string): Promise<any> {
  try {
    console.log(`[NFLDataService] Fetching game info for ${gameID}...`);
    const data = await this.makeRapidAPIRequest(`/getNFLGameInfo?gameID=${gameID}`);
    
    if (data && data.statusCode === 200 && data.body) {
      console.log(`[NFLDataService] Got game info for ${gameID}`);
      return data.body;
    }
    
    console.log(`[NFLDataService] No game info found for ${gameID}`);
    return null;
  } catch (error) {
    console.warn(`[NFLDataService] Failed to get game info for ${gameID}:`, error);
    return null;
  }
}
```

**Parameters:**
- `gameID`: Game identifier

### 6. Get NFL Team Schedule
**Endpoint:** `/getNFLTeamSchedule`

**Usage:**
```typescript
async getTeamSchedule(teamAbv: string, season: number = 2024): Promise<any[]> {
  try {
    console.log(`[NFLDataService] Fetching team schedule for ${teamAbv} ${season}...`);
    const data = await this.makeRapidAPIRequest(`/getNFLTeamSchedule?teamAbv=${teamAbv}&season=${season}`);
    
    if (data && data.statusCode === 200 && data.body && Array.isArray(data.body)) {
      console.log(`[NFLDataService] Got ${data.body.length} games for ${teamAbv} ${season}`);
      return data.body;
    }
    
    console.log(`[NFLDataService] No schedule found for ${teamAbv} ${season}`);
    return [];
  } catch (error) {
    console.warn(`[NFLDataService] Failed to get team schedule for ${teamAbv}:`, error);
    return [];
  }
}
```

**Parameters:**
- `teamAbv`: Team abbreviation (e.g., "DAL", "PIT")
- `season`: Year (e.g., 2024)

### 7. Get NFL Scores Only (Daily Scoreboard)
**Endpoint:** `/getNFLScoresOnly`

**Usage:**
```typescript
async getDailyScoreboard(gameDate: string, topPerformers: boolean = true): Promise<any[]> {
  try {
    console.log(`[NFLDataService] Fetching daily scoreboard for ${gameDate}...`);
    const data = await this.makeRapidAPIRequest(`/getNFLScoresOnly?gameDate=${gameDate}&topPerformers=${topPerformers}`);
    
    if (data && data.statusCode === 200 && data.body && Array.isArray(data.body)) {
      console.log(`[NFLDataService] Got scoreboard with ${data.body.length} games for ${gameDate}`);
      return data.body;
    }
    
    console.log(`[NFLDataService] No scoreboard found for ${gameDate}`);
    return [];
  } catch (error) {
    console.warn(`[NFLDataService] Failed to get daily scoreboard for ${gameDate}:`, error);
    return [];
  }
}
```

**Parameters:**
- `gameDate`: Date in YYYYMMDD format
- `topPerformers`: boolean (default: true)

## Advanced Usage Examples

### Full Season Schedule Import
```typescript
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
```

### Weekly Game Data Retrieval
```typescript
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
```

## Data Types

### Tank01BettingOdds Interface
```typescript
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
```

### NFLGameData Interface
```typescript
interface NFLGameData {
  id: string;
  week: number;
  season: number;
  gameDate: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isCompleted: boolean;
  status: string;
}
```

## Error Handling Best Practices

1. **Always check for API response status codes**
2. **Implement proper caching to avoid rate limits**
3. **Log detailed error information for debugging**
4. **Provide fallback data when API is unavailable**
5. **Handle network timeouts gracefully**

## Rate Limiting & Caching

- **Cache Duration:** 1 hour (3600000ms)
- **Cache Strategy:** In-memory with expiry timestamps
- **Rate Limit:** Follow RapidAPI subscription limits
- **Error Backoff:** Implement exponential backoff for failed requests

## Production Deployment Notes

1. **Environment Variables:**
   - `RAPIDAPI_KEY`: Your RapidAPI subscription key
   - Store securely and never commit to version control

2. **Monitoring:**
   - Track API response times
   - Monitor error rates
   - Alert on API quota limits

3. **Fallback Strategy:**
   - ESPN API as secondary data source
   - Cached historical data for testing
   - Graceful degradation when APIs are unavailable

## Testing Strategy

- **Development:** Use 2024 completed season data for reliable testing
- **Production:** Switch to live 2025 season data
- **Cache Testing:** Verify cache invalidation and refresh logic
- **Error Testing:** Simulate API failures and network issues

This documentation provides a comprehensive reference for all Tank01 NFL API integrations used in the Mok Sports fantasy application.