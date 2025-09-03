/**
 * Draft-related types and constants for breaking circular imports
 * This file contains ONLY types, interfaces, and constants - no React components or hooks
 */

// Draft message types for WebSocket communication
export interface DraftWebSocketMessage {
  type: 'pick_made' | 'timer_update' | 'draft_state' | 'auto_pick' | 'draft_completed' | 'connected' | 'pong';
  draftId: string;
  data?: any;
  timestamp: number;
  turnId?: string;
  seq?: number;
  pickId?: string;
  userId?: string;
  teamId?: string;
  timeRemaining?: number;
}

// Draft status constants
export type DraftStatus = 'not_started' | 'starting' | 'active' | 'paused' | 'completed' | 'cancelled';

// WebSocket connection status
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'connected' | 'disconnected' | 'draft_not_found' | 'error';

// Timer constants
export const TIMER_CONSTANTS = {
  BASE_DELAY: 750,
  MAX_DELAY: 10_000,
  HEARTBEAT_INTERVAL: 25_000, // 25 seconds
  GRACE_PERIOD: 1500, // 1.5 seconds
  DEFAULT_PICK_TIME_LIMIT: 120, // 2 minutes
} as const;

// Draft UI state constants
export const DRAFT_UI_CONSTANTS = {
  MINIMUM_SWIPE_DISTANCE: 50,
  TIMER_WARNING_THRESHOLDS: {
    URGENT: 5, // seconds
    WARNING: 10, // seconds
    CAUTION: 30, // seconds
  },
  NOTIFICATION_COOLDOWN: 30000, // 30 seconds
  VIBRATION_PATTERNS: {
    WARNING: 100,
    URGENT: [100, 50, 100],
    CRITICAL: [200, 100, 200, 100, 200],
    YOUR_TURN: [300, 100, 300],
  },
} as const;

// Team status types
export type TeamStatus = 'available' | 'taken' | 'conflict';

// Conference types  
export type Conference = 'AFC' | 'NFC';

// Common draft utility types
export interface DraftTimerUpdate {
  timeRemaining: number;
  draftId: string;
  currentPlayerId: string;
  turnId?: string;
  seq?: number;
}

export interface DraftStateUpdate {
  draftId: string;
  status: DraftStatus;
  currentPlayerId: string;
  round: number;
  pick: number;
  turnId?: string;
}

export interface PickMadeUpdate {
  draftId: string;
  pickId: string;
  userId: string;
  teamId: string;
  teamName: string;
  userName: string;
  round: number;
  pick: number;
}