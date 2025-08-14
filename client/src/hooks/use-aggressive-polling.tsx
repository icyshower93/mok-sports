import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Aggressive polling hook that forces data refresh every few seconds
// This ensures the PWA always has fresh data regardless of WebSocket issues
export function useAggressivePolling() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[AggressivePolling] Starting aggressive data refresh polling');
    
    // Start aggressive polling every 3 seconds to force fresh data
    intervalRef.current = setInterval(async () => {
      console.log('[AggressivePolling] 🔄 Force refreshing all critical data');
      try {
        // Force active refetch of all critical queries
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['/api/leagues'] }),
          queryClient.refetchQueries({ queryKey: ['/api/scoring'] }),
          queryClient.refetchQueries({ queryKey: ['/api/user/stable'] }),
        ]);
        console.log('[AggressivePolling] ✅ All data refreshed successfully');
      } catch (error) {
        console.error('[AggressivePolling] ❌ Refresh failed:', error);
      }
    }, 3000); // Very frequent polling (3 seconds) to ensure immediate updates

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('[AggressivePolling] Stopped aggressive polling');
      }
    };
  }, [queryClient]);

  return null;
}