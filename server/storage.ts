import { 
  users, leagues, leagueMembers, nflTeams, pushSubscriptions,
  type User, type InsertUser,
  type League, type InsertLeague,
  type LeagueMember, type InsertLeagueMember,
  type NflTeam, type PushSubscription, type InsertPushSubscription
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import webpush from "web-push";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateLastLogin(id: string): Promise<void>;
  
  // League methods
  createLeague(league: InsertLeague & { joinCode: string }): Promise<League>;
  getLeague(id: string): Promise<(League & { memberCount: number; members: Array<{ id: string; name: string; avatar: string | null; joinedAt: string }> }) | undefined>;
  getLeagueByName(name: string): Promise<League | undefined>;
  getLeagueByJoinCode(joinCode: string): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean }>>;
  joinLeague(member: InsertLeagueMember): Promise<LeagueMember>;
  leaveLeague(userId: string, leagueId: string): Promise<void>;
  isUserInLeague(userId: string, leagueId: string): Promise<boolean>;
  getLeagueMemberCount(leagueId: string): Promise<number>;
  
  // NFL Teams methods
  getAllNflTeams(): Promise<NflTeam[]>;
  
  // Push notification methods
  getVapidKeys(): { publicKey: string; privateKey: string };
  createPushSubscription(userId: string, subscription: any): Promise<PushSubscription>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  removePushSubscription(userId: string, endpoint: string): Promise<void>;
  deactivatePushSubscriptions(userId: string): Promise<void>;
  sendPushNotification(subscriptions: PushSubscription[], notification: any): Promise<any[]>;
  getLeagueMembers(leagueId: string): Promise<Array<{ userId: string; joinedAt: string }>>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  // League methods
  async createLeague(league: InsertLeague & { joinCode: string }): Promise<League> {
    const [newLeague] = await db
      .insert(leagues)
      .values(league)
      .returning();
    
    // Add creator as first member
    await db
      .insert(leagueMembers)
      .values({
        leagueId: newLeague.id,
        userId: league.creatorId,
      });
    
    return newLeague;
  }

  async getLeague(id: string): Promise<(League & { memberCount: number; members: Array<{ id: string; name: string; avatar: string | null; joinedAt: string }> }) | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    if (!league) return undefined;
    
    const memberCount = await this.getLeagueMemberCount(id);
    
    // Get league members with user details
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        avatar: users.avatar,
        joinedAt: leagueMembers.joinedAt,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.id))
      .where(eq(leagueMembers.leagueId, id))
      .orderBy(leagueMembers.joinedAt);
    
    return { 
      ...league, 
      memberCount,
      members: members.map(member => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      }))
    };
  }

  async getLeagueByName(name: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.name, name));
    return league || undefined;
  }

  async getLeagueByJoinCode(joinCode: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.joinCode, joinCode));
    return league || undefined;
  }

  async getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean }>> {
    try {
      const userLeagues = await db
        .select({
          id: leagues.id,
          name: leagues.name,
          joinCode: leagues.joinCode,
          maxTeams: leagues.maxTeams,
          creatorId: leagues.creatorId,
          isActive: leagues.isActive,
          draftScheduledAt: leagues.draftScheduledAt,
          draftStarted: leagues.draftStarted,
          createdAt: leagues.createdAt,
          memberCount: sql<number>`COUNT(${leagueMembers.userId})::int`,
          isCreator: sql<boolean>`${leagues.creatorId} = ${userId}`,
        })
        .from(leagues)
        .innerJoin(leagueMembers, eq(leagues.id, leagueMembers.leagueId))
        .where(eq(leagueMembers.userId, userId))
        .groupBy(leagues.id);

      return userLeagues;
    } catch (error) {
      // Return empty array if there's an error instead of throwing
      return [];
    }
  }

  async joinLeague(member: InsertLeagueMember): Promise<LeagueMember> {
    const [newMember] = await db
      .insert(leagueMembers)
      .values(member)
      .returning();
    return newMember;
  }

  async leaveLeague(userId: string, leagueId: string): Promise<void> {
    const result = await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.leagueId, leagueId)));
  }

  async scheduleDraft(leagueId: string, draftDateTime: Date): Promise<void> {
    await db.update(leagues)
      .set({ 
        draftScheduledAt: draftDateTime 
      })
      .where(eq(leagues.id, leagueId));
  }

  async isUserInLeague(userId: string, leagueId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.leagueId, leagueId)));
    return !!existing;
  }

  async getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
    return await db
      .select()
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
  }

  async getLeagueMemberCount(leagueId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
    return result.count;
  }

  // NFL Teams methods
  async getAllNflTeams(): Promise<NflTeam[]> {
    return await db.select().from(nflTeams);
  }

  // Push notification methods
  getVapidKeys(): { publicKey: string; privateKey: string } {
    try {
      // Use environment variables or generate valid VAPID keys
      let publicKey: string = process.env.VAPID_PUBLIC_KEY || '';
      let privateKey: string = process.env.VAPID_PRIVATE_KEY || '';
      
      // If no environment keys, generate new ones
      if (!publicKey || !privateKey) {
        const vapidKeys = webpush.generateVAPIDKeys();
        publicKey = vapidKeys.publicKey;
        privateKey = vapidKeys.privateKey;
        
      }
      
      // Set up web-push with VAPID details
      webpush.setVapidDetails(
        'mailto:admin@moksports.com',
        publicKey,
        privateKey
      );
      
      return { publicKey, privateKey };
    } catch (error) {
      throw new Error('Failed to generate VAPID keys');
    }
  }

  async createPushSubscription(userId: string, subscription: any): Promise<PushSubscription> {
    const subscriptionData: InsertPushSubscription = {
      userId,
      endpoint: subscription.endpoint,
      p256dhKey: subscription.keys.p256dh,
      authKey: subscription.keys.auth,
      isActive: true  // CRITICAL FIX: Explicitly set isActive to true
    };

    console.log(`[Storage] Creating push subscription for user ${userId}:`, {
      endpoint: subscription.endpoint?.substring(0, 50) + '...',
      hasKeys: !!subscription.keys
    });

    // First, deactivate any existing subscriptions for this user
    await db.update(pushSubscriptions)
      .set({ isActive: false })
      .where(eq(pushSubscriptions.userId, userId));

    // Create new subscription with isActive: true
    const [pushSub] = await db
      .insert(pushSubscriptions)
      .values(subscriptionData)
      .returning();
    
    console.log(`[Storage] Successfully created subscription with ID: ${pushSub.id}, isActive: ${pushSub.isActive}`);
    return pushSub;
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db.select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await db.update(pushSubscriptions)
      .set({ isActive: false })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
  }

  async deactivatePushSubscriptions(userId: string): Promise<void> {
    await db.update(pushSubscriptions)
      .set({ isActive: false })
      .where(eq(pushSubscriptions.userId, userId));
  }

  async sendPushNotification(subscriptions: PushSubscription[], notification: any): Promise<any[]> {
    const results = [];
    
    console.log(`[Push] Sending notifications to ${subscriptions.length} subscriptions`);
    console.log(`[Push] Notification payload:`, JSON.stringify(notification, null, 2));
    
    for (const subscription of subscriptions) {
      try {
        // CRITICAL FIX: Correct key mapping for web-push library
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dhKey,  // Fixed: was subscription.p256dhKey
            auth: subscription.authKey       // Fixed: was subscription.authKey
          }
        };

        console.log(`[Push] Sending to endpoint: ${subscription.endpoint.substring(0, 50)}...`);

        // Enhanced notification options for iOS compatibility
        const options = {
          TTL: 86400, // 24 hours
          urgency: 'high',
          vapidDetails: {
            subject: 'mailto:mokfantasysports@gmail.com',
            publicKey: this.getVapidKeys().publicKey,
            privateKey: this.getVapidKeys().privateKey
          }
        };

        const result = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notification),
          options
        );
        
        console.log(`[Push] Success - Status: ${result.statusCode}, Subscription: ${subscription.id}`);
        
        // Update last used timestamp
        await db.update(pushSubscriptions)
          .set({ lastUsed: new Date() })
          .where(eq(pushSubscriptions.id, subscription.id));
        
        results.push({ 
          success: true, 
          subscriptionId: subscription.id,
          statusCode: result.statusCode
        });
      } catch (error: any) {
        console.error(`[Push] Failed to send to subscription ${subscription.id}:`, error);
        
        // If subscription is invalid, deactivate it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push] Deactivating invalid subscription ${subscription.id}`);
          await db.update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, subscription.id));
        }
        
        results.push({ 
          success: false, 
          subscriptionId: subscription.id, 
          error: error.message,
          statusCode: error.statusCode
        });
      }
    }
    
    console.log(`[Push] Results: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  async getLeagueMembers(leagueId: string): Promise<Array<{ userId: string; joinedAt: string }>> {
    console.log(`[Storage] Getting members for league ${leagueId}`);
    const members = await db.select({
      userId: leagueMembers.userId,
      joinedAt: leagueMembers.joinedAt
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
    
    console.log(`[Storage] Found ${members.length} members for league ${leagueId}`);
    return members.map(m => ({
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString()
    }));
  }
}

export const storage = new DatabaseStorage();
