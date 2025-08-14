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

// Add broadcast method that delegates to WebSocket manager
(globalDraftManager as any).broadcast = function(message: any) {
  console.log('[GlobalDraftManager] Broadcast request:', message.type);
  
  if (this.webSocketManager && typeof this.webSocketManager.broadcast === 'function') {
    console.log('[GlobalDraftManager] Delegating to WebSocket manager broadcast');
    this.webSocketManager.broadcast(message);
  } else {
    console.log('[GlobalDraftManager] ❌ WebSocket manager or broadcast method not available');
    console.log('[GlobalDraftManager] webSocketManager exists:', !!this.webSocketManager);
    console.log('[GlobalDraftManager] webSocketManager.broadcast exists:', !!(this.webSocketManager && this.webSocketManager.broadcast));
  }
};

// Export for use in routes
export default globalDraftManager;