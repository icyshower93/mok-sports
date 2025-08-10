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
  status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started, starting, active, completed, paused
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

export const stables = pgTable("stables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  nflTeamId: varchar("nfl_team_id").notNull().references(() => nflTeams.id),
  acquiredVia: varchar("acquired_via").notNull().default("draft"), // draft, trade
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  locksUsed: integer("locks_used").notNull().default(0), // How many weekly locks used on this team
  lockAndLoadUsed: boolean("lock_and_load_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFL Games - stores real NFL game results
export const nflGames = pgTable("nfl_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  gameDate: timestamp("game_date").notNull(),
  homeTeamId: varchar("home_team_id").notNull().references(() => nflTeams.id),
  awayTeamId: varchar("away_team_id").notNull().references(() => nflTeams.id),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  isCompleted: boolean("is_completed").notNull().default(false),
  isTie: boolean("is_tie").notNull().default(false),
  winnerTeamId: varchar("winner_team_id").references(() => nflTeams.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Weekly Stats - aggregated data for each week (high/low scores, etc.)
export const weeklyStats = pgTable("weekly_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  highestScore: integer("highest_score").notNull(),
  lowestScore: integer("lowest_score").notNull(),
  highestScoringTeamId: varchar("highest_scoring_team_id").notNull().references(() => nflTeams.id),
  lowestScoringTeamId: varchar("lowest_scoring_team_id").notNull().references(() => nflTeams.id),
  totalGames: integer("total_games").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team Performance - calculated Mok points for each team each week
export const teamPerformance = pgTable("team_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nflTeamId: varchar("nfl_team_id").notNull().references(() => nflTeams.id),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  gameId: varchar("game_id").notNull().references(() => nflGames.id),
  teamScore: integer("team_score").notNull(),
  opponentScore: integer("opponent_score").notNull(),
  isWin: boolean("is_win").notNull(),
  isTie: boolean("is_tie").notNull(),
  isBlowout: boolean("is_blowout").notNull().default(false), // Won by 20+ points
  isShutout: boolean("is_shutout").notNull().default(false), // Held opponent to 0
  isWeeklyHigh: boolean("is_weekly_high").notNull().default(false),
  isWeeklyLow: boolean("is_weekly_low").notNull().default(false),
  baseMokPoints: integer("base_mok_points").notNull(), // Points without lock bonuses
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Weekly User Locks - tracks user's lock selections each week
export const weeklyLocks = pgTable("weekly_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  lockedTeamId: varchar("locked_team_id").references(() => nflTeams.id), // Regular lock selection
  lockAndLoadTeamId: varchar("lock_and_load_team_id").references(() => nflTeams.id), // Lock & Load selection
  lockPoints: integer("lock_points").notNull().default(0), // Points earned from locks
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Weekly Scores - calculated total scores for each user each week
export const userWeeklyScores = pgTable("user_weekly_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  leagueId: varchar("league_id").notNull().references(() => leagues.id),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  basePoints: integer("base_points").notNull().default(0), // Points without lock bonuses
  lockBonusPoints: integer("lock_bonus_points").notNull().default(0),
  lockAndLoadBonusPoints: integer("lock_and_load_bonus_points").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0), // Sum of all points
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdLeagues: many(leagues),
  leagueMemberships: many(leagueMembers),
  pushSubscriptions: many(pushSubscriptions),
  draftPicks: many(draftPicks),
  draftTimers: many(draftTimers),
  stableTeams: many(stables),
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

export const stablesRelations = relations(stables, ({ one }) => ({
  user: one(users, {
    fields: [stables.userId],
    references: [users.id],
  }),
  league: one(leagues, {
    fields: [stables.leagueId],
    references: [leagues.id],
  }),
  nflTeam: one(nflTeams, {
    fields: [stables.nflTeamId],
    references: [nflTeams.id],
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

export const insertNflGameSchema = createInsertSchema(nflGames).pick({
  season: true,
  week: true,
  gameDate: true,
  homeTeamId: true,
  awayTeamId: true,
  homeScore: true,
  awayScore: true,
  isCompleted: true,
  isTie: true,
  winnerTeamId: true,
});

export const insertWeeklyLockSchema = createInsertSchema(weeklyLocks).pick({
  userId: true,
  leagueId: true,
  season: true,
  week: true,
  lockedTeamId: true,
  lockAndLoadTeamId: true,
  lockPoints: true,
});

export const insertStableSchema = createInsertSchema(stables).pick({
  userId: true,
  leagueId: true,
  nflTeamId: true,
  acquiredVia: true,
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
export type Stable = typeof stables.$inferSelect;
export type InsertStable = z.infer<typeof insertStableSchema>;

export type NflGame = typeof nflGames.$inferSelect;
export type InsertNflGame = z.infer<typeof insertNflGameSchema>;
export type WeeklyStats = typeof weeklyStats.$inferSelect;
export type TeamPerformance = typeof teamPerformance.$inferSelect;
export type WeeklyLocks = typeof weeklyLocks.$inferSelect;
export type InsertWeeklyLocks = z.infer<typeof insertWeeklyLockSchema>;
export type UserWeeklyScores = typeof userWeeklyScores.$inferSelect;
