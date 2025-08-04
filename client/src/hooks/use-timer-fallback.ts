import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Fallback timer polling for when WebSocket fails to deliver timer updates
 * This ensures the timer displays correctly even if WebSocket messages don't reach the client
 */
export function useTimerFallback(draftId: string | null, connectionStatus: string) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!draftId) return;

    // Start fallback polling if WebSocket connection issues detected
    const startFallbackPolling = () => {
      if (intervalRef.current) return;

      console.log('[Timer Fallback] Starting timer polling for draft:', draftId);
      
      intervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/drafts/${draftId}`);
          const data = await response.json();
          
          if (data.success && data.data.state.timeRemaining !== undefined) {
            console.log('[Timer Fallback] Polled timer:', data.data.state.timeRemaining, 'seconds');
            
            // Update the draft cache with fresh timer data
            queryClient.setQueryData(['draft', draftId], (oldData: any) => {
              if (oldData) {
                return {
                  ...oldData,
                  state: {
                    ...oldData.state,
                    timeRemaining: data.data.state.timeRemaining,
                    lastUpdate: Date.now()
                  }
                };
              }
              return data.data;
            });
          }
        } catch (error) {
          console.error('[Timer Fallback] Polling error:', error);
        }
      }, 2000); // Poll every 2 seconds
    };

    const stopFallbackPolling = () => {
      if (intervalRef.current) {
        console.log('[Timer Fallback] Stopping timer polling');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start fallback polling after 5 seconds if we haven't received WebSocket timer updates
    const fallbackTimeout = setTimeout(() => {
      if (connectionStatus === 'connected') {
        console.log('[Timer Fallback] WebSocket connected but no timer updates - starting fallback polling');
        startFallbackPolling();
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimeout);
      stopFallbackPolling();
    };
  }, [draftId, connectionStatus, queryClient]);

  return null;
}