import { z } from "zod";
import {
  adminRoles,
  balanceTypes,
  blackjackActions,
  buyOrderStatuses,
  chatChannels,
  heroIds,
  lobbyTypes,
  marketListingStatuses
} from "./types";

export const idSchema = z.string().min(2).max(80);
export const idempotencyKeySchema = z.string().min(8).max(160);
export const balanceTypeSchema = z.enum(balanceTypes);
export const heroIdSchema = z.enum(heroIds);

export const devLoginSchema = z.object({
  displayName: z.string().min(2).max(24).default("Marky")
});

export const walletPublicKeySchema = z
  .string()
  .min(32)
  .max(64)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Wallet public key must be base58");

export const displayNameSchema = z
  .string()
  .min(2)
  .max(24)
  .regex(/^[A-Za-z0-9_ -]+$/, "Display name may use letters, numbers, spaces, underscores, and hyphens");

export const walletNonceRequestSchema = z.object({
  publicKey: walletPublicKeySchema
});

export const walletVerifySchema = z.object({
  publicKey: walletPublicKeySchema,
  nonce: z.string().min(12).max(120),
  message: z.string().min(20).max(600),
  signature: z.string().min(16).max(200),
  displayName: displayNameSchema.optional(),
  walletName: z.string().min(2).max(40).optional()
});

export const displayNameAvailabilitySchema = z.object({
  displayName: displayNameSchema
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createMarketListingSchema = z.object({
  goldAmount: z.number().int().positive(),
  pricePerGold: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});

export const buyMarketListingSchema = z.object({
  idempotencyKey: idempotencyKeySchema
});

export const createBuyOrderSchema = z.object({
  goldAmount: z.number().int().positive(),
  pricePerGold: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});

export const fillBuyOrderSchema = z.object({
  goldAmount: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});

export const cancelBuyOrderSchema = z.object({
  reason: z.string().min(3).max(240),
  idempotencyKey: idempotencyKeySchema
});

export const blackjackDealSchema = z
  .object({
    balanceType: z.enum(["EARNED_GOLD", "LOCKED_GOLD"]),
    bet: z.number().int().nonnegative(),
    practice: z.boolean().default(false),
    idempotencyKey: idempotencyKeySchema
  })
  .superRefine((body, context) => {
    if (body.practice && body.bet !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Practice hands must use a zero wager",
        path: ["bet"]
      });
    }
    if (!body.practice && body.bet <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wagered hands require a positive bet",
        path: ["bet"]
      });
    }
  });

export const blackjackActionSchema = z.object({
  action: z.enum(blackjackActions),
  idempotencyKey: idempotencyKeySchema
});

export const equipItemSchema = z.object({
  equipmentId: idSchema
});

export const createLobbySchema = z.object({
  mapId: z.string().min(3),
  lobbyType: z.enum(lobbyTypes),
  recommendedPower: z.number().int().nonnegative(),
  heroId: heroIdSchema
});

export const lobbyReadySchema = z.object({
  ready: z.boolean()
});

export const chatMessageSchema = z.object({
  channel: z.enum(chatChannels),
  message: z.string().min(1).max(400),
  targetPlayerId: z.string().optional()
});

export const adminDevAdjustmentSchema = z.object({
  playerId: idSchema,
  balanceType: balanceTypeSchema,
  amount: z.number().int(),
  reason: z.string().min(8).max(300),
  idempotencyKey: idempotencyKeySchema
});

export const adminModerationSchema = z.object({
  playerId: idSchema,
  action: z.enum(["MUTE", "TEMP_SUSPEND", "BAN", "MARKET_FREEZE", "BLACKJACK_FREEZE", "NOTE"]),
  durationHours: z.number().int().positive().optional(),
  reason: z.string().min(8).max(300)
});

export const adminConfigPublishSchema = z.object({
  configId: idSchema,
  highRisk: z.boolean(),
  reason: z.string().min(8).max(300)
});

export const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  sort: z.string().optional(),
  status: z
    .union([z.enum(marketListingStatuses), z.enum(buyOrderStatuses), z.enum(adminRoles)])
    .optional()
});

export type CreateMarketListingInput = z.infer<typeof createMarketListingSchema>;
export type CreateBuyOrderInput = z.infer<typeof createBuyOrderSchema>;
export type FillBuyOrderInput = z.infer<typeof fillBuyOrderSchema>;
export type BlackjackDealInput = z.infer<typeof blackjackDealSchema>;
export type BlackjackActionInput = z.infer<typeof blackjackActionSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type WalletNonceRequestInput = z.infer<typeof walletNonceRequestSchema>;
export type WalletVerifyInput = z.infer<typeof walletVerifySchema>;
