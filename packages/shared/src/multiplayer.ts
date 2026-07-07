import { z } from "zod";
import { heroIdSchema } from "./schemas";
import { townServerIds } from "./types";

const realtimeCoordinateSchema = z.number().finite().min(-32).max(1400);
const realtimeFacingSchema = z.number().finite().min(-1).max(1);
const realtimeSequenceSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

export const heroAppearanceRealtimeSchema = z.object({
  hairStyle: z.enum(["storm-swept", "soft-bob", "crest"]),
  hairColor: hexColorSchema,
  skinTone: hexColorSchema,
  outfitVariant: z.enum(["village-defender", "traveler", "ceremonial"]),
  accentColor: hexColorSchema,
  backAccessory: z.enum(["starter-cloak", "long-cloak", "wing-cape"]),
  weaponAccent: hexColorSchema
});

export const townRealtimePlayerSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().min(2).max(80),
  displayName: z.string().min(2).max(24),
  heroId: heroIdSchema,
  appearance: heroAppearanceRealtimeSchema,
  townChannel: z.enum(townServerIds),
  x: realtimeCoordinateSchema,
  y: realtimeCoordinateSchema,
  facingX: realtimeFacingSchema,
  facingY: realtimeFacingSchema,
  moving: z.boolean(),
  running: z.boolean(),
  sequence: realtimeSequenceSchema,
  sentAt: z.number().int().positive()
});

export const townMovementBroadcastSchema = townRealtimePlayerSchema.pick({
  sessionId: true,
  playerId: true,
  x: true,
  y: true,
  facingX: true,
  facingY: true,
  moving: true,
  running: true,
  sequence: true,
  sentAt: true
});

export const raidRealtimeEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("raid_start"),
    runId: z.string().uuid(),
    lobbyId: z.string().uuid(),
    stageId: z.string().min(3).max(80),
    startsAt: z.number().int().positive(),
    sentAt: z.number().int().positive()
  }),
  z.object({
    kind: z.literal("combat_snapshot"),
    runId: z.string().uuid(),
    sequence: realtimeSequenceSchema,
    elapsedMs: z.number().int().nonnegative(),
    waveIndex: z.number().int().nonnegative(),
    baseHp: z.number().int().nonnegative(),
    status: z.enum(["ACTIVE", "VICTORY", "DEFEAT"]),
    enemies: z
      .array(
        z.object({
          id: z.string().min(1).max(120),
          hp: z.number().finite().nonnegative(),
          progress: z.number().finite().min(0).max(1)
        })
      )
      .max(100),
    sentAt: z.number().int().positive()
  }),
  z.object({
    kind: z.literal("combat_action"),
    runId: z.string().uuid(),
    playerId: z.string().min(2).max(80),
    action: z.enum(["ATTACK", "ABILITY", "HIT", "DEFEAT_ENEMY", "BASE_DAMAGE"]),
    targetId: z.string().min(1).max(120).optional(),
    sequence: realtimeSequenceSchema,
    sentAt: z.number().int().positive()
  })
]);

export type TownRealtimePlayer = z.infer<typeof townRealtimePlayerSchema>;
export type TownMovementBroadcast = z.infer<typeof townMovementBroadcastSchema>;
export type RaidRealtimeEvent = z.infer<typeof raidRealtimeEventSchema>;
