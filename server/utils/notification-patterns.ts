import { storage } from "../storage";

/**
 * Reusable notification patterns for easy copying and consistent implementation
 */

export interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data: {
    url: string;
    type: string;
    timestamp: number;
    [key: string]: any;
  };
}

/**
 * Send notification to all members of a league
 * This pattern can be easily copied for any league-wide notification
 */
export async function sendLeagueNotification(
  leagueId: string,
  notification: NotificationConfig
): Promise<{ success: boolean; sentCount: number; errors: any[] }> {
  try {
    console.log(`Starting league notification for league ${leagueId}:`, notification.title);
    
    // Get all league members
    const leagueMembers = await storage.getLeagueMembers(leagueId);
    console.log(`Found ${leagueMembers.length} league members:`, leagueMembers.map(m => m.userId));
    
    const allSubscriptions = [];
    
    // Collect all push subscriptions from league members
    for (const member of leagueMembers) {
      const memberSubscriptions = await storage.getUserPushSubscriptions(member.userId);
      console.log(`User ${member.userId} has ${memberSubscriptions.length} active subscriptions`);
      allSubscriptions.push(...memberSubscriptions);
    }
    
    console.log(`Total active subscriptions found: ${allSubscriptions.length}`);
    
    if (allSubscriptions.length === 0) {
      console.log('No active push subscriptions found - notifications not sent');
      return { success: true, sentCount: 0, errors: [] };
    }
    
    console.log('Sending notification data:', JSON.stringify(notification, null, 2));
    const results = await storage.sendPushNotification(allSubscriptions, notification);
    
    const successCount = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success);
    
    console.log(`Notification results: ${successCount}/${results.length} successful`);
    if (errors.length > 0) {
      console.log('Notification errors:', errors);
    }
    
    return {
      success: true,
      sentCount: successCount,
      errors
    };
    
  } catch (error) {
    console.error('Failed to send league notification:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [error]
    };
  }
}

/**
 * Send notification to a specific user
 * This pattern can be easily copied for any user-specific notification
 */
export async function sendUserNotification(
  userId: string,
  notification: NotificationConfig
): Promise<{ success: boolean; sentCount: number; errors: any[] }> {
  try {
    console.log(`Starting user notification for user ${userId}:`, notification.title);
    
    const userSubscriptions = await storage.getUserPushSubscriptions(userId);
    console.log(`User ${userId} has ${userSubscriptions.length} active subscriptions`);
    
    if (userSubscriptions.length === 0) {
      console.log('No active push subscriptions found for user - notification not sent');
      return { success: true, sentCount: 0, errors: [] };
    }
    
    console.log('Sending notification data:', JSON.stringify(notification, null, 2));
    const results = await storage.sendPushNotification(userSubscriptions, notification);
    
    const successCount = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success);
    
    console.log(`User notification results: ${successCount}/${results.length} successful`);
    if (errors.length > 0) {
      console.log('User notification errors:', errors);
    }
    
    return {
      success: true,
      sentCount: successCount,
      errors
    };
    
  } catch (error) {
    console.error('Failed to send user notification:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [error]
    };
  }
}

/**
 * Pre-defined notification templates for common scenarios
 * Add new templates here for easy reuse
 */
export const NotificationTemplates = {
  leagueFull: (leagueName: string, leagueId: string): NotificationConfig => ({
    title: `${leagueName} is Full!`,
    body: "Your league is ready! The creator can now schedule the draft.",
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    data: {
      url: `/league/waiting?id=${leagueId}`,
      type: "league-full",
      leagueId,
      leagueName,
      timestamp: Date.now()
    }
  }),

  draftScheduled: (leagueName: string, leagueId: string, draftTime: string): NotificationConfig => ({
    title: `Draft Scheduled!`,
    body: `${leagueName} draft is set for ${draftTime}. Get ready!`,
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    data: {
      url: `/league/waiting?id=${leagueId}`,
      type: "draft-scheduled",
      leagueId,
      leagueName,
      draftTime,
      timestamp: Date.now()
    }
  }),

  welcome: (isFirstTime: boolean): NotificationConfig => ({
    title: isFirstTime ? "Welcome to Mok Sports!" : "Welcome back!",
    body: "You're all set to receive updates about your fantasy leagues.",
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    data: {
      url: "/dashboard",
      type: "welcome",
      timestamp: Date.now()
    }
  })
};