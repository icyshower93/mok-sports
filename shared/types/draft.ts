import { z } from 'zod';

export const NflTeamSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  city: z.string(),
  conference: z.union([z.literal('AFC'), z.literal('NFC')]),
  division: z.string(),
  logoUrl: z.string().url()
});
export type NflTeam = z.infer<typeof NflTeamSchema>;

export const DraftPickSchema = z.object({
  id: z.string(),
  round: z.number().int().positive(),
  pickNumber: z.number().int().positive(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
  nflTeam: NflTeamSchema,
  isAutoPick: z.boolean()
});
export type DraftPick = z.infer<typeof DraftPickSchema>;

export const DraftStatusSchema = z.union([
  z.literal('not_started'),
  z.literal('starting'),
  z.literal('active'),
  z.literal('completed'),
]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export const DraftCoreSchema = z.object({
  id: z.string(),
  status: DraftStatusSchema,
  currentRound: z.number().int().nonnegative(),
  currentPick: z.number().int().nonnegative(),
  totalRounds: z.number().int().positive(),
  pickTimeLimit: z.number().int().positive(),
  draftOrder: z.array(z.string())
});
export type DraftCore = z.infer<typeof DraftCoreSchema>;

export const DraftStateSchema = z.object({
  draft: DraftCoreSchema,
  currentUserId: z.string().nullable(),
  timeRemaining: z.number().int().nonnegative(),
  picks: z.array(DraftPickSchema),
  availableTeams: z.array(NflTeamSchema),
  isUserTurn: z.boolean(),
  canMakePick: z.boolean(),
});
export type DraftState = z.infer<typeof DraftStateSchema>;

// WebSocket message schemas
export const DraftMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('draft_state_update'),
    data: DraftStateSchema
  }),
  z.object({
    type: z.literal('timer_update'), 
    data: z.object({
      timeRemaining: z.number().int().nonnegative(),
      isUserTurn: z.boolean()
    })
  }),
  z.object({
    type: z.literal('pick_made'),
    data: z.object({
      pick: DraftPickSchema,
      nextUserId: z.string().nullable()
    })
  }),
  z.object({
    type: z.literal('draft_completed'),
    data: z.object({
      draftId: z.string()
    })
  })
]);
export type DraftMessage = z.infer<typeof DraftMessageSchema>;