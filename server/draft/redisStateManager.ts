import { getRedisClient, isRedisAvailable } from '../redis';

interface TimerData {
  userId: string;
  startTime: number;
  duration: number;
}

interface DraftState {
  currentPick: number;
  currentUserId: string;
  picks: Array<{ teamId: string; userId: string; round: number; pick: number }>;
  availableTeams: string[];
}

export class RedisStateManager {
  private redis = getRedisClient();
  private inMemoryState = new Map<string, any>(); // Fallback for when Redis is not available
  
  constructor() {
    console.log('[RedisStateManager] Initialized');
    if (!this.redis) {
      console.log('[RedisStateManager] Using in-memory fallback mode');
    }
  }
  
  private isRedisAvailable(): boolean {
    return this.redis !== null && isRedisAvailable();
  }

  // Draft state management
  async setDraftState(draftId: string, state: DraftState): Promise<void> {
    if (this.isRedisAvailable()) {
      try {
        await this.redis!.set(`draft:${draftId}:state`, JSON.stringify(state));
      } catch (error) {
        console.error('[RedisStateManager] Failed to set draft state, using fallback:', error);
        this.inMemoryState.set(`draft:${draftId}:state`, state);
      }
    } else {
      this.inMemoryState.set(`draft:${draftId}:state`, state);
    }
  }

  async getDraftState(draftId: string): Promise<DraftState | null> {
    if (this.isRedisAvailable()) {
      try {
        const result = await this.redis!.get(`draft:${draftId}:state`);
        return result ? JSON.parse(result) : null;
      } catch (error) {
        console.error('[RedisStateManager] Failed to get draft state, using fallback:', error);
        return this.inMemoryState.get(`draft:${draftId}:state`) || null;
      }
    } else {
      return this.inMemoryState.get(`draft:${draftId}:state`) || null;
    }
  }

  async deleteDraftState(draftId: string): Promise<void> {
    if (this.isRedisAvailable()) {
      try {
        await this.redis!.del(`draft:${draftId}:state`);
      } catch (error) {
        console.error('[RedisStateManager] Failed to delete draft state:', error);
      }
    }
    this.inMemoryState.delete(`draft:${draftId}:state`);
  }

  // Timer management
  async setTimer(draftId: string, userId: string, duration: number): Promise<void> {
    const timerData: TimerData = {
      userId,
      startTime: Date.now(),
      duration
    };

    if (this.isRedisAvailable()) {
      try {
        await this.redis!.setex(`timer:${draftId}`, duration, JSON.stringify(timerData));
      } catch (error) {
        console.error('[RedisStateManager] Failed to set timer, using fallback:', error);
        this.inMemoryState.set(`timer:${draftId}`, { ...timerData, expires: Date.now() + (duration * 1000) });
      }
    } else {
      this.inMemoryState.set(`timer:${draftId}`, { ...timerData, expires: Date.now() + (duration * 1000) });
    }
  }

  async getTimer(draftId: string): Promise<TimerData | null> {
    if (this.isRedisAvailable()) {
      try {
        const result = await this.redis!.get(`timer:${draftId}`);
        return result ? JSON.parse(result) : null;
      } catch (error) {
        console.error('[RedisStateManager] Failed to get timer, using fallback:', error);
        const fallback = this.inMemoryState.get(`timer:${draftId}`);
        return fallback && Date.now() < fallback.expires ? fallback : null;
      }
    } else {
      const fallback = this.inMemoryState.get(`timer:${draftId}`);
      return fallback && Date.now() < fallback.expires ? fallback : null;
    }
  }

  async getTimeRemaining(draftId: string): Promise<number> {
    const timer = await this.getTimer(draftId);
    if (!timer) return 0;

    const elapsed = (Date.now() - timer.startTime) / 1000;
    const remaining = Math.max(0, timer.duration - elapsed);
    return Math.floor(remaining);
  }

  async updateTimeRemaining(draftId: string, timeRemaining: number): Promise<void> {
    const timer = await this.getTimer(draftId);
    if (!timer) return;

    // Update the timer with new remaining time
    const updatedTimer: TimerData = {
      ...timer,
      startTime: Date.now() - ((timer.duration - timeRemaining) * 1000)
    };

    if (this.isRedisAvailable()) {
      try {
        await this.redis!.setex(`timer:${draftId}`, timeRemaining, JSON.stringify(updatedTimer));
      } catch (error) {
        console.error('[RedisStateManager] Failed to update timer, using fallback:', error);
        this.inMemoryState.set(`timer:${draftId}`, { ...updatedTimer, expires: Date.now() + (timeRemaining * 1000) });
      }
    } else {
      this.inMemoryState.set(`timer:${draftId}`, { ...updatedTimer, expires: Date.now() + (timeRemaining * 1000) });
    }
  }

  async deleteTimer(draftId: string): Promise<void> {
    if (this.isRedisAvailable()) {
      try {
        await this.redis!.del(`timer:${draftId}`);
      } catch (error) {
        console.error('[RedisStateManager] Failed to delete timer:', error);
      }
    }
    this.inMemoryState.delete(`timer:${draftId}`);
  }

  // Active drafts tracking
  async addActiveDraft(draftId: string): Promise<void> {
    if (this.isRedisAvailable()) {
      try {
        await this.redis!.sadd('active_drafts', draftId);
      } catch (error) {
        console.error('[RedisStateManager] Failed to add active draft:', error);
        const activeDrafts = this.inMemoryState.get('active_drafts') || new Set();
        activeDrafts.add(draftId);
        this.inMemoryState.set('active_drafts', activeDrafts);
      }
    } else {
      const activeDrafts = this.inMemoryState.get('active_drafts') || new Set();
      activeDrafts.add(draftId);
      this.inMemoryState.set('active_drafts', activeDrafts);
    }
  }

  async removeActiveDraft(draftId: string): Promise<void> {
    if (this.isRedisAvailable()) {
      try {
        await this.redis!.srem('active_drafts', draftId);
      } catch (error) {
        console.error('[RedisStateManager] Failed to remove active draft:', error);
      }
    }
    
    const activeDrafts = this.inMemoryState.get('active_drafts') || new Set();
    activeDrafts.delete(draftId);
    this.inMemoryState.set('active_drafts', activeDrafts);
  }

  async getActiveDrafts(): Promise<string[]> {
    if (this.isRedisAvailable()) {
      try {
        return await this.redis!.smembers('active_drafts');
      } catch (error) {
        console.error('[RedisStateManager] Failed to get active drafts, using fallback:', error);
        const activeDrafts = this.inMemoryState.get('active_drafts') || new Set();
        return Array.from(activeDrafts);
      }
    } else {
      const activeDrafts = this.inMemoryState.get('active_drafts') || new Set();
      return Array.from(activeDrafts);
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    if (this.isRedisAvailable()) {
      try {
        const result = await this.redis!.ping();
        return result === 'PONG';
      } catch (error) {
        return false;
      }
    } else {
      return true; // In-memory is always available
    }
  }
}