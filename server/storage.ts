import { 
  users, leagues, leagueMembers, nflTeams,
  type User, type InsertUser,
  type League, type InsertLeague,
  type LeagueMember, type InsertLeagueMember,
  type NflTeam
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

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
          createdAt: leagues.createdAt,
          memberCount: sql<number>`COUNT(${leagueMembers.userId})::int`,
          isCreator: sql<boolean>`${leagues.creatorId} = ${userId}`,
        })
        .from(leagues)
        .innerJoin(leagueMembers, eq(leagues.id, leagueMembers.leagueId))
        .where(eq(leagueMembers.userId, userId))
        .groupBy(leagues.id);

      console.log(`Found ${userLeagues.length} leagues for user ${userId}`);
      return userLeagues;
    } catch (error) {
      console.error('Error in getUserLeagues:', error);
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
    console.log(`Leave league result for user ${userId} from league ${leagueId}:`, result);
  }

  async isUserInLeague(userId: string, leagueId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.userId, userId), eq(leagueMembers.leagueId, leagueId)));
    return !!existing;
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
}

export const storage = new DatabaseStorage();
