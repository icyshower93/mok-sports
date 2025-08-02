import { 
  users, leagues, leagueMembers,
  type User, type InsertUser,
  type League, type InsertLeague,
  type LeagueMember, type InsertLeagueMember
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
  getLeagueByJoinCode(joinCode: string): Promise<League | undefined>;
  getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean }>>;
  joinLeague(member: InsertLeagueMember): Promise<LeagueMember>;
  isUserInLeague(userId: string, leagueId: string): Promise<boolean>;
  getLeagueMemberCount(leagueId: string): Promise<number>;
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

  async getLeagueByJoinCode(joinCode: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.joinCode, joinCode));
    return league || undefined;
  }

  async getUserLeagues(userId: string): Promise<Array<League & { memberCount: number; isCreator: boolean }>> {
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

    return userLeagues;
  }

  async joinLeague(member: InsertLeagueMember): Promise<LeagueMember> {
    const [newMember] = await db
      .insert(leagueMembers)
      .values(member)
      .returning();
    return newMember;
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
}

export const storage = new DatabaseStorage();
