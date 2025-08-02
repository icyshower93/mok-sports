import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at").defaultNow().notNull(),
});

export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  maxTeams: integer("max_teams").notNull().default(6),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leagueMembers = pgTable("league_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdLeagues: many(leagues),
  leagueMemberships: many(leagueMembers),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  creator: one(users, {
    fields: [leagues.creatorId],
    references: [users.id],
  }),
  members: many(leagueMembers),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, {
    fields: [leagueMembers.leagueId],
    references: [leagues.id],
  }),
  user: one(users, {
    fields: [leagueMembers.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  googleId: true,
  email: true,
  name: true,
  avatar: true,
});

export const insertLeagueSchema = createInsertSchema(leagues).pick({
  name: true,
  maxTeams: true,
  creatorId: true,
});

export const insertLeagueMemberSchema = createInsertSchema(leagueMembers).pick({
  leagueId: true,
  userId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type League = typeof leagues.$inferSelect;
export type InsertLeagueMember = z.infer<typeof insertLeagueMemberSchema>;
export type LeagueMember = typeof leagueMembers.$inferSelect;
