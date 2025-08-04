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
  draftScheduledAt: timestamp("draft_scheduled_at"),
  draftStarted: boolean("draft_started").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leagueMembers = pgTable("league_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const nflTeams = pgTable("nfl_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 3 }).notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  conference: varchar("conference", { length: 3 }).notNull(), // AFC or NFC
  division: varchar("division", { length: 10 }).notNull(), // East, West, North, South
  logoUrl: text("logo_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started, active, completed, paused
  currentRound: integer("current_round").notNull().default(1),
  currentPick: integer("current_pick").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(5),
  pickTimeLimit: integer("pick_time_limit").notNull().default(60), // seconds
  draftOrder: text("draft_order").array().notNull(), // array of user IDs in draft order
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const draftPicks = pgTable("draft_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftId: varchar("draft_id").notNull().references(() => drafts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  nflTeamId: varchar("nfl_team_id").notNull().references(() => nflTeams.id),
  round: integer("round").notNull(),
  pickNumber: integer("pick_number").notNull(),
  pickTime: timestamp("pick_time").defaultNow().notNull(),
  isAutoPick: boolean("is_auto_pick").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const draftTimers = pgTable("draft_timers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftId: varchar("draft_id").notNull().references(() => drafts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  round: integer("round").notNull(),
  pickNumber: integer("pick_number").notNull(),
  timeRemaining: integer("time_remaining").notNull(), // seconds
  timerStartedAt: timestamp("timer_started_at").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdLeagues: many(leagues),
  leagueMemberships: many(leagueMembers),
  pushSubscriptions: many(pushSubscriptions),
  draftPicks: many(draftPicks),
  draftTimers: many(draftTimers),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  creator: one(users, {
    fields: [leagues.creatorId],
    references: [users.id],
  }),
  members: many(leagueMembers),
  drafts: many(drafts),
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

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  league: one(leagues, {
    fields: [drafts.leagueId],
    references: [leagues.id],
  }),
  picks: many(draftPicks),
  timers: many(draftTimers),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  draft: one(drafts, {
    fields: [draftPicks.draftId],
    references: [drafts.id],
  }),
  user: one(users, {
    fields: [draftPicks.userId],
    references: [users.id],
  }),
  nflTeam: one(nflTeams, {
    fields: [draftPicks.nflTeamId],
    references: [nflTeams.id],
  }),
}));

export const draftTimersRelations = relations(draftTimers, ({ one }) => ({
  draft: one(drafts, {
    fields: [draftTimers.draftId],
    references: [drafts.id],
  }),
  user: one(users, {
    fields: [draftTimers.userId],
    references: [users.id],
  }),
}));

export const nflTeamsRelations = relations(nflTeams, ({ many }) => ({
  draftPicks: many(draftPicks),
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

export const insertNflTeamSchema = createInsertSchema(nflTeams).pick({
  code: true,
  name: true,
  city: true,
  conference: true,
  division: true,
  logoUrl: true,
});

export const insertDraftSchema = createInsertSchema(drafts).pick({
  leagueId: true,
  totalRounds: true,
  pickTimeLimit: true,
  draftOrder: true,
});

export const insertDraftPickSchema = createInsertSchema(draftPicks).pick({
  draftId: true,
  userId: true,
  nflTeamId: true,
  round: true,
  pickNumber: true,
  isAutoPick: true,
});

export const insertDraftTimerSchema = createInsertSchema(draftTimers).pick({
  draftId: true,
  userId: true,
  round: true,
  pickNumber: true,
  timeRemaining: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).pick({
  userId: true,
  endpoint: true,
  p256dhKey: true,
  authKey: true,
  userAgent: true,
  isActive: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type League = typeof leagues.$inferSelect;
export type InsertLeagueMember = z.infer<typeof insertLeagueMemberSchema>;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type InsertNflTeam = z.infer<typeof insertNflTeamSchema>;
export type NflTeam = typeof nflTeams.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type DraftPick = typeof draftPicks.$inferSelect;
export type InsertDraftPick = z.infer<typeof insertDraftPickSchema>;
export type DraftTimer = typeof draftTimers.$inferSelect;
export type InsertDraftTimer = z.infer<typeof insertDraftTimerSchema>;
