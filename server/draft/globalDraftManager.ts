/**
 * Global Draft Manager Singleton
 * 
 * Provides a single shared instance of SnakeDraftManager to ensure
 * timer state is consistent across all API routes and endpoints.
 */

import { SnakeDraftManager } from './snakeDraftManager.js';
import { storage } from '../storage.js';

// Create global singleton instance
export const globalDraftManager = new SnakeDraftManager(
  storage, 
  undefined, 
  undefined, // WebSocket manager will be injected later
  undefined  // Robot manager will be injected later
);

// Export for use in routes
export default globalDraftManager;