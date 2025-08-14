import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// PWA-optimized real-time updates using aggressive polling
// This eliminates WebSocket dependency issues in PWA environments
export function usePWARealtime() {
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    console.log('[PWARealtime] Starting PWA-optimized polling for real-time updates');
    
    // Start aggressive polling (every 2 seconds) for PWA reliability
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Force refetch all critical queries using direct refetch (most reliable for PWA)
        const refetchPromises = [
          queryClient.refetchQueries({ queryKey: ['/api/leagues'] }),
          queryClient.refetchQueries({ queryKey: ['/api/scoring'] }),
          queryClient.refetchQueries({ queryKey: ['/api/user/stable'] }),
          queryClient.refetchQueries({ queryKey: ['/api/admin/current-week'] }),
        ];
        
        await Promise.all(refetchPromises);
        // Silent success - no console spam
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
    connectionStatus: 'connected', // Always report connected for PWA polling
    isConnected: true
  };
}