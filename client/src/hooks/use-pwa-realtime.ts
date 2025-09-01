// Debug imports removed
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// PWA-optimized real-time updates using aggressive polling
// This eliminates WebSocket dependency issues in PWA environments
// Replaces WebSocket broadcasts with comprehensive query invalidation
export function usePWARealtime() {
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    console.log('[PWARealtime] Starting PWA-optimized polling for real-time updates');
    
    // Start aggressive polling (every 2 seconds) for PWA reliability
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // PWA-optimized comprehensive query invalidation (replaces WebSocket broadcasts)
        // This ensures all data updates from admin actions are immediately visible
        await queryClient.invalidateQueries();
        
        // Silent success - no console spam for production reliability
      } catch (error) {
        // Only log actual errors, not normal polling
        console.error('[PWARealtime] Polling error:', error);
      }
    }, 2000); // Very aggressive polling (2 seconds) for PWA
    
    return () => {
      console.log('[PWARealtime] Stopping PWA polling');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [queryClient]);

  return {
    connectionStatus: 'connected' as const, // Always report connected for PWA polling
    isConnected: true
  };
}