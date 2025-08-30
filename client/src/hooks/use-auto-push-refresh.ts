import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSubscriptionManager } from '@/hooks/use-subscription-manager';

/**
 * Legacy auto-refresh hook - now delegates to the new SubscriptionManager
 * Maintains backward compatibility while using the enhanced system
 */
export function useAutoPushRefresh() {
  const { isAuthenticated } = useAuth();
  const subscriptionManager = useSubscriptionManager();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasInitialized.current) {
      return;
    }

    // Mark as initialized to prevent double-initialization
    hasInitialized.current = true;

    console.log('[AutoPushRefresh] Legacy hook delegating to SubscriptionManager');
    
    // The SubscriptionManager handles all the auto-refresh logic now
    // This hook just ensures it's initialized when the user is authenticated
    
    return () => {
      hasInitialized.current = false;
    };
  }, [isAuthenticated]);

  // Return subscription manager state for backward compatibility
  return {
    isRefreshing: subscriptionManager.isRefreshing,
    hasActiveSubscription: subscriptionManager.hasActiveSubscription,
    lastRefreshTime: subscriptionManager.lastRefreshTime,
    refreshCount: subscriptionManager.refreshCount,
    manualRefresh: subscriptionManager.manualRefresh
  };
}