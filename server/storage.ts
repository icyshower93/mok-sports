import { 
  users, leagues, leagueMembers, nflTeams, nflGames, pushSubscriptions, drafts, draftPicks, draftTimers, stables,
  type User, type InsertUser,
  type League, type InsertLeague,
  type LeagueMember, type InsertLeagueMember,
  type NflTeam, type PushSubscription, type InsertPushSubscription,
  type Draft, type InsertDraft,
  type DraftPick, type InsertDraftPick,
  type DraftTimer, type InsertDraftTimer,
  type Stable, type InsertStable
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  getLeague(id: string): Promise<(League & { memberCount: number; members: Array<{ id: string; name: string; avatar: string | null; joinedAt: string }>; draftId?: string; draftStatus?: string }) | undefined>;
  getLeagueByName(name: string): Promise<League | undefined>;
  getLeagueByJoinCode(joinCode: string): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean; draftId?: string; draftStatus?: string }>>;
  joinLeague(member: InsertLeagueMember): Promise<LeagueMember>;
  leaveLeague(userId: string, leagueId: string): Promise<void>;
  isUserInLeague(userId: string, leagueId: string): Promise<boolean>;
  getLeagueMemberCount(leagueId: string): Promise<number>;
  
  // NFL Teams methods
  getAllNflTeams(): Promise<NflTeam[]>;
  getNflTeamsByConference(conference: 'AFC' | 'NFC'): Promise<NflTeam[]>;
  getAvailableNflTeams(draftId: string): Promise<NflTeam[]>;
  
  // Draft methods
  createDraft(draft: InsertDraft): Promise<Draft>;
  getDraft(draftId: string): Promise<Draft | undefined>;
  getLeagueDraft(leagueId: string): Promise<Draft | undefined>;
  updateDraftStatus(draftId: string, status: string): Promise<void>;
  updateDraftProgress(draftId: string, round: number, pick: number): Promise<void>;
  startDraft(draftId: string): Promise<void>;
  setDraftStatus(draftId: string, status: string): Promise<void>;
  completeDraft(draftId: string): Promise<void>;
  
  // Draft picks methods
  createDraftPick(pick: InsertDraftPick): Promise<DraftPick>;
  getDraftPicks(draftId: string): Promise<Array<DraftPick & { user: User; nflTeam: NflTeam }>>;
  getUserDraftPicks(draftId: string, userId: string): Promise<Array<DraftPick & { nflTeam: NflTeam }>>;
  
  // User statistics methods
  getAllUserDraftPicks(userId: string): Promise<Array<DraftPick & { nflTeam: NflTeam }>>;
  getUserCompletedDrafts(userId: string): Promise<Array<Draft & { leagueName: string }>>;
  getUserRecentDrafts(userId: string, limit: number): Promise<Array<{ id: string; leagueName: string; status: string; completedAt: string; totalPicks: number; finalRound: number }>>;
  
  // Draft timer methods
  createDraftTimer(timer: InsertDraftTimer): Promise<DraftTimer>;
  updateDraftTimer(draftId: string, userId: string, timeRemaining: number): Promise<void>;
  deactivateAllDraftTimers(draftId: string): Promise<void>;
  getActiveDraftTimer(draftId: string): Promise<DraftTimer | undefined>;
  deactivateTimer(draftId: string, userId: string): Promise<void>;
  
  // Push notification methods
  getVapidKeys(): { publicKey: string; privateKey: string };
  createPushSubscription(userId: string, subscription: any): Promise<PushSubscription>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  removePushSubscription(userId: string, endpoint: string): Promise<void>;
  deactivatePushSubscriptions(userId: string): Promise<void>;
  sendPushNotification(subscriptions: PushSubscription[], notification: any): Promise<any[]>;
  getLeagueMembers(leagueId: string): Promise<Array<{ userId: string; joinedAt: string }>>;
  
  // Stable methods (user's teams)
  createStableTeam(stable: InsertStable): Promise<Stable>;
  getUserStable(userId: string, leagueId: string): Promise<Array<Stable & { nflTeam: NflTeam }>>;
  removeStableTeam(userId: string, leagueId: string, nflTeamId: string): Promise<void>;
  updateStableLocks(userId: string, leagueId: string, nflTeamId: string, locksUsed: number): Promise<void>;
  updateStableLockAndLoad(userId: string, leagueId: string, nflTeamId: string, used: boolean): Promise<void>;
  initializeStableFromDraft(draftId: string): Promise<void>;
  addFreeAgentToStable(userId: string, leagueId: string, nflTeamId: string): Promise<void>;
  
  // Additional methods for draft management
  updateLeague(leagueId: string, updates: Partial<League>): Promise<void>;
  deleteDraft(draftId: string): Promise<void>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // Scoring methods
  getUserLockHistory(userId: string, leagueId: string, season: number): Promise<any[]>;
  setWeeklyLocks(userId: string, leagueId: string, season: number, week: number, locks: { lockedTeamId?: string; lockAndLoadTeamId?: string }): Promise<void>;
  
  // NFL Game methods for opponent data
  getTeamUpcomingGame(teamCode: string, week: number): Promise<{ homeTeam: string; awayTeam: string; gameDate: string; gameTime: string; spread?: number } | null>;
  getTeamByCode(teamCode: string): Promise<NflTeam | null>;
  getTimerState(): Promise<any>;
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

  async getLeague(id: string): Promise<(League & { memberCount: number; members: Array<{ id: string; name: string; avatar: string | null; joinedAt: string }>; draftId?: string; draftStatus?: string }) | undefined> {
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
    
    // Get draft information if it exists
    const draft = await this.getLeagueDraft(id);

    return { 
      ...league, 
      memberCount,
      members: members.map(member => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      })),
      draftId: draft?.id,
      draftStatus: draft?.status,
      draftStarted: !!draft && draft.status !== 'not_started'
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

  async getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean; draftId?: string; draftStatus?: string }>> {
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
          memberCount: sql<number>`COUNT(DISTINCT ${leagueMembers.userId})::int`,
          isCreator: sql<boolean>`${leagues.creatorId} = ${userId}`,
          draftId: drafts.id,
          draftStatus: drafts.status,
        })
        .from(leagues)
        .innerJoin(leagueMembers, eq(leagues.id, leagueMembers.leagueId))
        .leftJoin(drafts, eq(leagues.id, drafts.leagueId))
        .where(eq(leagueMembers.userId, userId))
        .groupBy(leagues.id, drafts.id, drafts.status);

      // Convert null values to undefined for TypeScript compatibility
      return userLeagues.map(league => ({
        ...league,
        draftId: league.draftId || undefined,
        draftStatus: league.draftStatus || undefined,
      }));
    } catch (error) {
      console.error('[Storage] Error fetching user leagues:', error);
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
    console.log(`[Storage] Checking if user ${userId} is in league ${leagueId}`);
    const [existing] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.leagueId, leagueId)));
    console.log(`[Storage] Membership check result:`, existing ? 'MEMBER' : 'NOT MEMBER');
    return !!existing;
  }

  async updateLeague(leagueId: string, updates: Partial<League>): Promise<void> {
    await db.update(leagues)
      .set(updates)
      .where(eq(leagues.id, leagueId));
  }

  async deleteDraft(draftId: string): Promise<void> {
    // Delete all related data
    await db.delete(draftTimers).where(eq(draftTimers.draftId, draftId));
    await db.delete(draftPicks).where(eq(draftPicks.draftId, draftId));
    await db.delete(drafts).where(eq(drafts.id, draftId));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getLeagueMembers(leagueId: string): Promise<Array<{ id: string; userId: string; joinedAt: string }>> {
    console.log(`[Storage] Getting members for league ${leagueId}`);
    const members = await db.select({
      id: leagueMembers.userId, // Use userId as id for draft order
      userId: leagueMembers.userId,
      joinedAt: leagueMembers.joinedAt
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, leagueId));
    
    console.log(`[Storage] Found ${members.length} members for league ${leagueId}:`, members.map(m => m.userId));
    return members.map(m => ({
      id: m.userId,
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString()
    }));
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

  async getNflTeamsByConference(conference: 'AFC' | 'NFC'): Promise<NflTeam[]> {
    return await db.select()
      .from(nflTeams)
      .where(eq(nflTeams.conference, conference));
  }

  async getAvailableNflTeams(draftId: string): Promise<NflTeam[]> {
    // Get all teams that haven't been picked in this draft
    const pickedTeamIds = await db.select({ nflTeamId: draftPicks.nflTeamId })
      .from(draftPicks)
      .where(eq(draftPicks.draftId, draftId));
    
    const pickedIds = pickedTeamIds.map(p => p.nflTeamId);
    
    if (pickedIds.length === 0) {
      return await this.getAllNflTeams();
    }
    
    return await db.select()
      .from(nflTeams)
      .where(notInArray(nflTeams.id, pickedIds));
  }

  // Draft methods
  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db
      .insert(drafts)
      .values(draft)
      .returning();
    return newDraft;
  }

  async getDraft(draftId: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
    return draft || undefined;
  }

  async getDraftByLeagueId(leagueId: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.leagueId, leagueId));
    return draft || undefined;
  }

  async getLeagueDraft(leagueId: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.leagueId, leagueId));
    return draft || undefined;
  }

  async updateDraftStatus(draftId: string, status: string): Promise<void> {
    await db.update(drafts)
      .set({ status })
      .where(eq(drafts.id, draftId));
  }

  async updateDraftProgress(draftId: string, round: number, pick: number): Promise<void> {
    console.log(`🔄 [Storage] Updating draft ${draftId} to Round ${round}, Pick ${pick}`);
    try {
      const result = await db.update(drafts)
        .set({ currentRound: round, currentPick: pick })
        .where(eq(drafts.id, draftId))
        .returning({ id: drafts.id, currentRound: drafts.currentRound, currentPick: drafts.currentPick });
      
      if (result.length > 0) {
        console.log(`✅ [Storage] Database updated successfully:`, result[0]);
      } else {
        console.error(`❌ [Storage] No draft found with ID ${draftId} for update`);
      }
    } catch (error) {
      console.error(`❌ [Storage] Failed to update draft progress:`, error);
      throw error;
    }
  }

  async startDraft(draftId: string): Promise<void> {
    await db.update(drafts)
      .set({ 
        status: 'active',
        startedAt: new Date()
      })
      .where(eq(drafts.id, draftId));
  }

  async setDraftStatus(draftId: string, status: string): Promise<void> {
    await db.update(drafts)
      .set({ status })
      .where(eq(drafts.id, draftId));
  }

  async completeDraft(draftId: string): Promise<void> {
    await db.update(drafts)
      .set({ 
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(drafts.id, draftId));
  }

  // Draft picks methods
  async createDraftPick(pick: InsertDraftPick): Promise<DraftPick> {
    const [newPick] = await db
      .insert(draftPicks)
      .values(pick)
      .returning();
    return newPick;
  }

  async getDraftPicks(draftId: string): Promise<Array<DraftPick & { user: User; nflTeam: NflTeam }>> {
    return await db.select({
      id: draftPicks.id,
      draftId: draftPicks.draftId,
      userId: draftPicks.userId,
      nflTeamId: draftPicks.nflTeamId,
      round: draftPicks.round,
      pickNumber: draftPicks.pickNumber,
      pickTime: draftPicks.pickTime,
      isAutoPick: draftPicks.isAutoPick,
      createdAt: draftPicks.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        googleId: users.googleId,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt
      },
      nflTeam: {
        id: nflTeams.id,
        code: nflTeams.code,
        name: nflTeams.name,
        city: nflTeams.city,
        conference: nflTeams.conference,
        division: nflTeams.division,
        logoUrl: nflTeams.logoUrl,
        createdAt: nflTeams.createdAt
      }
    })
    .from(draftPicks)
    .innerJoin(users, eq(draftPicks.userId, users.id))
    .innerJoin(nflTeams, eq(draftPicks.nflTeamId, nflTeams.id))
    .where(eq(draftPicks.draftId, draftId))
    .orderBy(draftPicks.pickNumber);
  }

  async getUserDraftPicks(draftId: string, userId: string): Promise<Array<DraftPick & { nflTeam: NflTeam }>> {
    return await db.select({
      id: draftPicks.id,
      draftId: draftPicks.draftId,
      userId: draftPicks.userId,
      nflTeamId: draftPicks.nflTeamId,
      round: draftPicks.round,
      pickNumber: draftPicks.pickNumber,
      pickTime: draftPicks.pickTime,
      isAutoPick: draftPicks.isAutoPick,
      createdAt: draftPicks.createdAt,
      nflTeam: {
        id: nflTeams.id,
        code: nflTeams.code,
        name: nflTeams.name,
        city: nflTeams.city,
        conference: nflTeams.conference,
        division: nflTeams.division,
        logoUrl: nflTeams.logoUrl,
        createdAt: nflTeams.createdAt
      }
    })
    .from(draftPicks)
    .innerJoin(nflTeams, eq(draftPicks.nflTeamId, nflTeams.id))
    .where(and(
      eq(draftPicks.draftId, draftId),
      eq(draftPicks.userId, userId)
    ))
    .orderBy(draftPicks.round);
  }

  // User statistics methods
  async getAllUserDraftPicks(userId: string): Promise<Array<DraftPick & { nflTeam: NflTeam }>> {
    return await db.select({
      id: draftPicks.id,
      draftId: draftPicks.draftId,
      userId: draftPicks.userId,
      nflTeamId: draftPicks.nflTeamId,
      round: draftPicks.round,
      pickNumber: draftPicks.pickNumber,
      pickTime: draftPicks.pickTime,
      isAutoPick: draftPicks.isAutoPick,
      createdAt: draftPicks.createdAt,
      nflTeam: {
        id: nflTeams.id,
        code: nflTeams.code,
        name: nflTeams.name,
        city: nflTeams.city,
        conference: nflTeams.conference,
        division: nflTeams.division,
        logoUrl: nflTeams.logoUrl,
        createdAt: nflTeams.createdAt
      }
    })
    .from(draftPicks)
    .innerJoin(nflTeams, eq(draftPicks.nflTeamId, nflTeams.id))
    .where(eq(draftPicks.userId, userId))
    .orderBy(draftPicks.createdAt);
  }

  async getUserCompletedDrafts(userId: string): Promise<Array<Draft & { leagueName: string }>> {
    return await db.select({
      id: drafts.id,
      leagueId: drafts.leagueId,
      status: drafts.status,
      currentRound: drafts.currentRound,
      currentPick: drafts.currentPick,
      draftOrder: drafts.draftOrder,
      pickTimeLimit: drafts.pickTimeLimit,
      totalRounds: drafts.totalRounds,
      startedAt: drafts.startedAt,
      completedAt: drafts.completedAt,
      createdAt: drafts.createdAt,
      leagueName: leagues.name
    })
    .from(drafts)
    .innerJoin(leagues, eq(drafts.leagueId, leagues.id))
    .innerJoin(leagueMembers, eq(leagues.id, leagueMembers.leagueId))
    .where(and(
      eq(leagueMembers.userId, userId),
      eq(drafts.status, 'completed')
    ))
    .orderBy(drafts.completedAt);
  }

  async getUserRecentDrafts(userId: string, limit: number): Promise<Array<{ id: string; leagueName: string; status: string; completedAt: string; totalPicks: number; finalRound: number }>> {
    const recentDrafts = await db.select({
      id: drafts.id,
      leagueId: drafts.leagueId,
      status: drafts.status,
      currentRound: drafts.currentRound,
      completedAt: drafts.completedAt,
      leagueName: leagues.name
    })
    .from(drafts)
    .innerJoin(leagues, eq(drafts.leagueId, leagues.id))
    .innerJoin(leagueMembers, eq(leagues.id, leagueMembers.leagueId))
    .where(and(
      eq(leagueMembers.userId, userId),
      eq(drafts.status, 'completed')
    ))
    .orderBy(drafts.completedAt)
    .limit(limit);

    // Get pick counts for each draft
    const draftsWithPicks = await Promise.all(recentDrafts.map(async (draft) => {
      const pickCount = await db.select({ count: sql<number>`count(*)` })
        .from(draftPicks)
        .where(eq(draftPicks.draftId, draft.id));

      return {
        id: draft.id,
        leagueName: draft.leagueName,
        status: draft.status,
        completedAt: draft.completedAt?.toISOString() || '',
        totalPicks: pickCount[0]?.count || 0,
        finalRound: draft.currentRound
      };
    }));

    return draftsWithPicks;
  }

  // Draft timer methods
  async createDraftTimer(timer: InsertDraftTimer): Promise<DraftTimer> {
    const [newTimer] = await db
      .insert(draftTimers)
      .values(timer)
      .returning();
    return newTimer;
  }

  async updateDraftTimer(draftId: string, userId: string, timeRemaining: number): Promise<void> {
    await db.update(draftTimers)
      .set({ timeRemaining })
      .where(and(
        eq(draftTimers.draftId, draftId),
        eq(draftTimers.userId, userId),
        eq(draftTimers.isActive, true)
      ));
  }

  async getActiveDraftTimer(draftId: string): Promise<DraftTimer | undefined> {
    const [timer] = await db.select()
      .from(draftTimers)
      .where(and(
        eq(draftTimers.draftId, draftId),
        eq(draftTimers.isActive, true)
      ));
    return timer || undefined;
  }

  async deactivateAllDraftTimers(draftId: string): Promise<void> {
    await db.update(draftTimers)
      .set({ isActive: false })
      .where(
        and(
          eq(draftTimers.draftId, draftId),
          eq(draftTimers.isActive, true)
        )
      );
  }

  async deactivateTimer(draftId: string, userId: string): Promise<void> {
    await db.update(draftTimers)
      .set({ isActive: false })
      .where(and(
        eq(draftTimers.draftId, draftId),
        eq(draftTimers.userId, userId)
      ));
  }

  async getActiveTimers(): Promise<DraftTimer[]> {
    return await db.select()
      .from(draftTimers)
      .where(eq(draftTimers.isActive, true))
      .orderBy(draftTimers.timerStartedAt);
  }

  // Push notification methods
  getVapidKeys(): { publicKey: string; privateKey: string } {
    try {
      // Use environment variables or generate valid VAPID keys
      let publicKey: string = process.env.VAPID_PUBLIC_KEY?.trim() || '';
      let privateKey: string = process.env.VAPID_PRIVATE_KEY?.trim() || '';
      
      console.log(`[VAPID] Environment check - Public key length: ${publicKey.length}, Private key length: ${privateKey.length}`);
      
      // If no environment keys or they're too short, generate new ones
      if (!publicKey || !privateKey || publicKey.length < 80 || privateKey.length < 40) {
        console.log(`[VAPID] Generating new VAPID keys (env keys invalid/missing)`);
        const vapidKeys = webpush.generateVAPIDKeys();
        publicKey = vapidKeys.publicKey;
        privateKey = vapidKeys.privateKey;
        console.log(`[VAPID] Generated keys - Public: ${publicKey.length} chars, Private: ${privateKey.length} chars`);
        console.log(`[VAPID] WARNING: Using temporary keys - notifications may fail for existing subscriptions`);
      } else {
        console.log(`[VAPID] Using environment VAPID keys`);
      }
      
      // Set up web-push with VAPID details
      webpush.setVapidDetails(
        'mailto:mokfantasysports@gmail.com',
        publicKey,
        privateKey
      );
      
      return { publicKey, privateKey };
    } catch (error) {
      console.error(`[VAPID] Failed to configure VAPID keys:`, error);
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
    console.log(`[Push] Notification payload size: ${JSON.stringify(notification).length} bytes`);
    console.log(`[Push] Notification payload:`, JSON.stringify(notification, null, 2));
    
    // Validate VAPID keys before sending
    const vapidKeys = this.getVapidKeys();
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      console.error(`[Push] VAPID keys missing - public: ${!!vapidKeys.publicKey}, private: ${!!vapidKeys.privateKey}`);
      return [{ success: false, error: 'VAPID keys not configured' }];
    }
    
    console.log(`[Push] VAPID public key length: ${vapidKeys.publicKey.length}`);
    console.log(`[Push] VAPID private key length: ${vapidKeys.privateKey.length}`);
    
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      console.log(`[Push] Processing subscription ${i + 1}/${subscriptions.length}: ${subscription.id}`);
      
      try {
        // Validate subscription data before sending
        if (!subscription.endpoint) {
          throw new Error('Missing endpoint');
        }
        if (!subscription.p256dhKey) {
          throw new Error('Missing p256dhKey');
        }
        if (!subscription.authKey) {
          throw new Error('Missing authKey');
        }
        
        console.log(`[Push] Subscription validation passed for ${subscription.id}`);
        console.log(`[Push] Endpoint: ${subscription.endpoint}`);
        console.log(`[Push] p256dhKey length: ${subscription.p256dhKey.length}`);
        console.log(`[Push] authKey length: ${subscription.authKey.length}`);
        console.log(`[Push] Created: ${subscription.createdAt}`);
        console.log(`[Push] Last used: ${subscription.lastUsed || 'Never'}`);
        
        // Build push subscription object
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dhKey,
            auth: subscription.authKey
          }
        };

        // Validate JSON payload
        let payloadString;
        try {
          payloadString = JSON.stringify(notification);
          console.log(`[Push] JSON payload validated, size: ${payloadString.length} bytes`);
        } catch (jsonError) {
          console.error(`[Push] JSON serialization failed:`, jsonError);
          throw new Error(`Invalid JSON payload: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        }

        // Enhanced notification options for iOS compatibility
        const options = {
          TTL: 86400, // 24 hours
          urgency: 'high' as const,
          vapidDetails: {
            subject: 'mailto:mokfantasysports@gmail.com',
            publicKey: vapidKeys.publicKey,
            privateKey: vapidKeys.privateKey
          }
        };

        console.log(`[Push] Sending to ${subscription.endpoint.substring(0, 50)}... with options:`, {
          TTL: options.TTL,
          urgency: options.urgency,
          vapidSubject: options.vapidDetails.subject
        });

        const startTime = Date.now();
        const result = await webpush.sendNotification(
          pushSubscription,
          payloadString,
          options
        );
        const duration = Date.now() - startTime;
        
        console.log(`[Push] SUCCESS - Subscription ${subscription.id}`);
        console.log(`[Push] - Status Code: ${result.statusCode}`);
        console.log(`[Push] - Duration: ${duration}ms`);
        console.log(`[Push] - Headers:`, result.headers);
        console.log(`[Push] - Body:`, result.body);
        
        // Update last used timestamp
        await db.update(pushSubscriptions)
          .set({ lastUsed: new Date() })
          .where(eq(pushSubscriptions.id, subscription.id));
        
        results.push({ 
          success: true, 
          subscriptionId: subscription.id,
          statusCode: result.statusCode,
          duration,
          headers: result.headers,
          body: result.body
        });
        
      } catch (error: any) {
        console.error(`[Push] FAILED - Subscription ${subscription.id}:`);
        console.error(`[Push] - Error Message: ${error.message}`);
        console.error(`[Push] - Status Code: ${error.statusCode}`);
        console.error(`[Push] - Response Body: ${error.body}`);
        console.error(`[Push] - Headers: ${JSON.stringify(error.headers)}`);
        console.error(`[Push] - Full Error:`, error);
        
        // Handle specific error codes
        if (error.statusCode === 400) {
          console.error(`[Push] HTTP 400 BAD REQUEST for subscription ${subscription.id}`);
          console.error(`[Push] - Endpoint: ${subscription.endpoint}`);
          console.error(`[Push] - p256dh length: ${subscription.p256dhKey?.length || 'MISSING'}`);
          console.error(`[Push] - auth length: ${subscription.authKey?.length || 'MISSING'}`);
          console.error(`[Push] - Payload size: ${JSON.stringify(notification).length} bytes`);
          
          // Mark as problematic but don't deactivate immediately for 400 errors
          // 400 errors might be temporary or configuration issues
        } else if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push] Deactivating invalid subscription ${subscription.id} (${error.statusCode})`);
          await db.update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, subscription.id));
        } else if (error.statusCode === 413) {
          console.error(`[Push] Payload too large (413) for subscription ${subscription.id}`);
        } else if (error.statusCode === 429) {
          console.error(`[Push] Rate limited (429) for subscription ${subscription.id}`);
        }
        
        results.push({ 
          success: false, 
          subscriptionId: subscription.id, 
          error: error.message,
          statusCode: error.statusCode,
          responseBody: error.body,
          headers: error.headers,
          endpoint: subscription.endpoint.substring(0, 50) + '...'
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    console.log(`[Push] SUMMARY: ${successCount} successful, ${failureCount} failed out of ${results.length} total`);
    
    // Log error breakdown
    const errorBreakdown = results
      .filter(r => !r.success)
      .reduce((acc, r) => {
        const status = r.statusCode || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    if (Object.keys(errorBreakdown).length > 0) {
      console.log(`[Push] Error breakdown:`, errorBreakdown);
    }
    
    return results;
  }

  // Stable methods implementation
  async createStableTeam(stable: InsertStable): Promise<Stable> {
    const [newStable] = await db
      .insert(stables)
      .values(stable)
      .returning();
    return newStable;
  }

  async getUserStable(userId: string, leagueId: string): Promise<Array<Stable & { nflTeam: NflTeam }>> {
    return await db.select({
      id: stables.id,
      userId: stables.userId,
      leagueId: stables.leagueId,
      nflTeamId: stables.nflTeamId,
      acquiredVia: stables.acquiredVia,
      acquiredAt: stables.acquiredAt,
      locksUsed: stables.locksUsed,
      lockAndLoadUsed: stables.lockAndLoadUsed,
      createdAt: stables.createdAt,
      nflTeam: {
        id: nflTeams.id,
        code: nflTeams.code,
        name: nflTeams.name,
        city: nflTeams.city,
        conference: nflTeams.conference,
        division: nflTeams.division,
        logoUrl: nflTeams.logoUrl,
        createdAt: nflTeams.createdAt
      }
    })
    .from(stables)
    .innerJoin(nflTeams, eq(stables.nflTeamId, nflTeams.id))
    .where(and(
      eq(stables.userId, userId),
      eq(stables.leagueId, leagueId)
    ))
    .orderBy(stables.acquiredAt);
  }

  async removeStableTeam(userId: string, leagueId: string, nflTeamId: string): Promise<void> {
    await db.delete(stables)
      .where(and(
        eq(stables.userId, userId),
        eq(stables.leagueId, leagueId),
        eq(stables.nflTeamId, nflTeamId)
      ));
  }

  async updateStableLocks(userId: string, leagueId: string, nflTeamId: string, locksUsed: number): Promise<void> {
    await db.update(stables)
      .set({ locksUsed })
      .where(and(
        eq(stables.userId, userId),
        eq(stables.leagueId, leagueId),
        eq(stables.nflTeamId, nflTeamId)
      ));
  }

  async updateStableLockAndLoad(userId: string, leagueId: string, nflTeamId: string, used: boolean): Promise<void> {
    await db.update(stables)
      .set({ lockAndLoadUsed: used })
      .where(and(
        eq(stables.userId, userId),
        eq(stables.leagueId, leagueId),
        eq(stables.nflTeamId, nflTeamId)
      ));
  }

  async initializeStableFromDraft(draftId: string): Promise<void> {
    // Get the draft and league info
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    // Get all picks from the completed draft
    const picks = await this.getDraftPicks(draftId);
    
    console.log(`🔄 Initializing stable from draft ${draftId} with ${picks.length} picks`);
    
    // Check which stable entries already exist for this league
    const existingStables = await db
      .select()
      .from(stables)
      .where(eq(stables.leagueId, draft.leagueId));
    
    console.log(`📋 Found ${existingStables.length} existing stable entries for league ${draft.leagueId}`);
    
    // Create a Set of existing combinations for fast lookup
    const existingKeys = new Set(
      existingStables.map(s => `${s.userId}-${s.nflTeamId}`)
    );
    
    // Filter out picks that already have stable entries
    const newStableEntries: InsertStable[] = picks
      .filter(pick => !existingKeys.has(`${pick.userId}-${pick.nflTeamId}`))
      .map(pick => ({
        userId: pick.userId,
        leagueId: draft.leagueId,
        nflTeamId: pick.nflTeamId,
        acquiredVia: "draft" as const
      }));

    console.log(`➕ Creating ${newStableEntries.length} new stable entries`);

    // Insert new stable entries only
    if (newStableEntries.length > 0) {
      await db.insert(stables).values(newStableEntries);
      console.log(`✅ Successfully created ${newStableEntries.length} stable entries`);
    } else {
      console.log(`ℹ️ No new stable entries needed - all teams already in stable`);
    }
  }

  // Add free agent team to user's stable (for trading)
  async addFreeAgentToStable(userId: string, leagueId: string, nflTeamId: string): Promise<void> {
    // Check if user already has this team
    const existing = await db
      .select()
      .from(stables)
      .where(
        and(
          eq(stables.userId, userId),
          eq(stables.leagueId, leagueId),
          eq(stables.nflTeamId, nflTeamId)
        )
      );

    if (existing.length > 0) {
      throw new Error('User already owns this team');
    }

    await db.insert(stables).values({
      userId,
      leagueId,
      nflTeamId,
      acquiredVia: 'free_agent'
    });
  }

  // Scoring methods - stub implementations
  async getUserLockHistory(userId: string, leagueId: string, season: number): Promise<any[]> {
    // TODO: Implement with weeklyLocks table
    return [];
  }

  async setWeeklyLocks(userId: string, leagueId: string, season: number, week: number, locks: { lockedTeamId?: string; lockAndLoadTeamId?: string }): Promise<void> {
    // TODO: Implement with weeklyLocks table
    console.log(`Setting locks for user ${userId} in league ${leagueId}, season ${season}, week ${week}:`, locks);
  }

  // NFL Game methods for opponent data
  async getTeamUpcomingGame(teamCode: string, week: number): Promise<{ homeTeam: string; awayTeam: string; gameDate: string; gameTime: string; spread?: number } | null> {
    try {
      // Find the team by code first
      const team = await this.getTeamByCode(teamCode);
      if (!team) return null;

      // Create table aliases for the join
      const homeTeam = alias(nflTeams, 'home_team');
      const awayTeam = alias(nflTeams, 'away_team');

      // Query for the game in the specified week for 2024 season
      const game = await db
        .select({
          homeTeamCode: homeTeam.code,
          awayTeamCode: awayTeam.code,
          gameDate: nflGames.gameDate,
          gameId: nflGames.id,
        })
        .from(nflGames)
        .innerJoin(homeTeam, eq(nflGames.homeTeamId, homeTeam.id))
        .innerJoin(awayTeam, eq(nflGames.awayTeamId, awayTeam.id))
        .where(
          and(
            eq(nflGames.season, 2024),
            eq(nflGames.week, week),
            sql`(${nflGames.homeTeamId} = ${team.id} OR ${nflGames.awayTeamId} = ${team.id})`
          )
        )
        .limit(1);

      if (game.length === 0) return null;

      const gameData = game[0];
      const gameDate = new Date(gameData.gameDate);
      
      // Get real point spread from RapidAPI with fallback to realistic historical data
      let pointSpread = 0;
      try {
        const { nflDataService } = await import('./services/nflDataService.js');
        const dateStr = gameDate.toISOString().split('T')[0];
        
        // Fetch betting odds for this game date
        const odds = await nflDataService.getBettingOddsForDate(dateStr);
        
        // Find odds for this specific game
        const gameOdds = odds.find(odd => 
          odd.gameDate === dateStr &&
          (odd.teamAbv === gameData.homeTeamCode || odd.teamAbv === gameData.awayTeamCode)
        );
        
        if (gameOdds) {
          pointSpread = gameOdds.pointSpreadHome || 0;
          console.log(`[Storage] Found point spread for ${gameData.homeTeamCode} vs ${gameData.awayTeamCode}: ${pointSpread}`);
        } else {
          // Historical 2024 NFL point spreads for realistic demo data
          const historicalSpreads = {
            'BUF-ARI': 6.5,  // Bills favored by 6.5 at home vs Cardinals
            'CIN-NE': 7.5,   // Bengals favored by 7.5 on road vs Patriots  
            'CLE-DAL': 2.5,  // Browns favored by 2.5 on road vs Cowboys
            'LAC-LV': 3,     // Chargers favored by 3 at home vs Raiders
            'TB-WAS': 3.5    // Buccaneers favored by 3.5 at home vs Commanders
          };
          
          const gameKey = `${gameData.homeTeamCode}-${gameData.awayTeamCode}`;
          pointSpread = historicalSpreads[gameKey] || 0;
          
          if (pointSpread > 0) {
            console.log(`[Storage] Using historical point spread for ${gameData.homeTeamCode} vs ${gameData.awayTeamCode}: ${pointSpread}`);
          } else {
            console.log(`[Storage] No point spread found for ${gameData.homeTeamCode} vs ${gameData.awayTeamCode} on ${dateStr}`);
          }
        }
      } catch (error) {
        console.warn('Failed to get point spread from API, using historical data:', error);
        pointSpread = 0;
      }
      
      return {
        homeTeam: gameData.homeTeamCode,
        awayTeam: gameData.awayTeamCode,
        gameDate: gameDate.toISOString().split('T')[0],
        gameTime: gameDate.toTimeString().slice(0, 5),
        spread: pointSpread
      };
    } catch (error) {
      console.error('Error getting team upcoming game:', error);
      return null;
    }
  }

  async getTeamByCode(teamCode: string): Promise<NflTeam | null> {
    try {
      const [team] = await db.select().from(nflTeams).where(eq(nflTeams.code, teamCode));
      return team || null;
    } catch (error) {
      console.error('Error getting team by code:', error);
      return null;
    }
  }

  async getTimerState(): Promise<any> {
    // Connect to the existing admin state management
    try {
      const { getAdminState } = await import('./routes/admin.js');
      return getAdminState();
    } catch (error) {
      console.error('Error getting timer state:', error);
      // Fallback to basic state - using Week 1 since games start September 5th
      return {
        currentWeek: 1,
        currentDay: 'tuesday', 
        currentTime: '15:00',
        season: 2024
      };
    }
  }
}

export const storage = new DatabaseStorage();
