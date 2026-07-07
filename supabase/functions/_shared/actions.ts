import { z } from "npm:zod@3.25.67";
import bs58 from "npm:bs58@6.0.0";
import nacl from "npm:tweetnacl@1.0.3";
import {
  asRecord,
  HttpError,
  isDevMode,
  isRecord,
  optionalEnv,
  type EdgeContext,
  type EdgeHandler,
  type JsonRecord,
  requireUser,
  toBoolean,
  toNumber,
  toStringValue
} from "./http.ts";
import {
  consumableDefinitions,
  economyConfig,
  equipmentDefinitions,
  getBlackjackEarnedProfitCap,
  getBlackjackLimits,
  getBlackjackTableLimit,
  getDailySellCapacity
} from "./content.ts";
import {
  decodeBase64Signature,
  missingWalletVerificationFields,
  walletAuthFailureMessages,
  walletVerificationFailure,
  type WalletAuthFailureCode
} from "./walletVerification.ts";

type BalanceType = "EARNED_GOLD" | "LOCKED_GOLD" | "TEST_TOKEN";
type AdminRole = "OWNER" | "ADMIN" | "ECONOMY_MANAGER" | "GAME_DESIGNER" | "MODERATOR" | "SUPPORT";

interface Card {
  rank: string;
  suit: string;
}

const idempotencyKeySchema = z.string().min(8).max(160);
const walletPublicKeySchema = z.string().min(32).max(64).regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
const displayNameSchema = z.string().min(2).max(24).regex(/^[A-Za-z0-9_ -]+$/);
const starterHeroIdSchema = z.enum([
  "storm-archer",
  "tide-mage",
  "bombardier",
  "coral-alchemist",
  "starcaller"
]);
const townServerIds = [
  "solbloom-1",
  "solbloom-2",
  "solbloom-3",
  "solbloom-4",
  "solbloom-5"
] as const;
const TOWN_SERVER_CAPACITY = 40;
const TOWN_PRESENCE_STALE_AFTER_SECONDS = 20;
const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const townServerIdSchema = z.enum(townServerIds);
const lobbyNeededHeroIdsSchema = z
  .array(starterHeroIdSchema)
  .max(3)
  .default([])
  .transform((heroIds) => [...new Set(heroIds)]);
const walletNonceRequestSchema = z.object({
  publicKeyBase58: walletPublicKeySchema,
  requestId: z.string().min(8).max(120),
  provider: z.string().min(2).max(80)
});
const walletVerificationRequestSchema = z.object({
  publicKeyBase58: walletPublicKeySchema,
  currentWalletPublicKey: walletPublicKeySchema.optional(),
  challengeId: z.string().uuid(),
  signatureBase64: z.string().min(1).max(200),
  requestId: z.string().min(8).max(120),
  provider: z.string().min(2).max(80)
});
const createMarketListingSchema = z.object({
  goldAmount: z.number().int().positive(),
  pricePerGold: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});
const listingIdSchema = z.object({
  listingId: z.string().uuid(),
  idempotencyKey: idempotencyKeySchema
});
const createBuyOrderSchema = z.object({
  goldAmount: z.number().int().positive(),
  pricePerGold: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});
const fillBuyOrderSchema = z.object({
  orderId: z.string().uuid(),
  goldAmount: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema
});
const cancelBuyOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(3).max(240).default("Player cancelled buy order"),
  idempotencyKey: idempotencyKeySchema
});
const blackjackDealSchema = z
  .object({
    balanceType: z.enum(["EARNED_GOLD", "LOCKED_GOLD"]),
    bet: z.number().int().nonnegative(),
    practice: z.boolean().default(false),
    idempotencyKey: idempotencyKeySchema
  })
  .superRefine((body, refinement) => {
    if (body.practice && body.bet !== 0) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Practice hands must use a zero wager",
        path: ["bet"]
      });
    }
    if (!body.practice && body.bet <= 0) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wagered hands require a positive bet",
        path: ["bet"]
      });
    }
  });
const blackjackActionSchema = z.object({
  handId: z.string().uuid(),
  idempotencyKey: idempotencyKeySchema
});
const shopBuySchema = z.object({
  definitionId: z.string().min(2),
  idempotencyKey: idempotencyKeySchema
});
const equipItemSchema = z.object({
  equipmentId: z.string().min(2),
  slot: z.enum(["WEAPON", "ARMOR", "RELIC", "CHARM"]).optional(),
  idempotencyKey: idempotencyKeySchema.optional()
});
const swapEquipmentSchema = z.object({
  equipmentId: z.string().uuid(),
  slot: z.enum(["WEAPON", "ARMOR", "RELIC", "CHARM"]),
  idempotencyKey: idempotencyKeySchema
});
const starlightVaultStateSchema = z.object({
  includeDeveloperValidation: z.boolean().optional().default(false)
});
const starlightVaultDrawSchema = z.object({
  bannerId: z.enum([
    "featured-starlight-selection",
    "global-costume-collection-i",
    "active-hero-weapon",
    "active-hero-armor",
    "active-hero-relics-charms"
  ]),
  paymentBalanceType: z.enum(["LOCKED_GOLD", "EARNED_GOLD"]),
  drawCount: z.union([z.literal(1), z.literal(10)]),
  activeHeroId: z.string().min(3).max(80),
  idempotencyKey: idempotencyKeySchema
});
const equipFullCostumeSchema = z.object({
  heroId: z.string().min(3).max(80),
  costumeId: z.string().min(2).max(120).nullable()
});
const createPlayerProfileSchema = z.object({
  publicKey: walletPublicKeySchema,
  nonce: z.string().min(12).max(120),
  displayName: displayNameSchema,
  heroId: starterHeroIdSchema.default("storm-archer"),
  walletName: z.string().min(2).max(40).optional()
});
const bootstrapRequestSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("me") }),
  z.object({ section: z.literal("blackjack") }),
  z.object({ section: z.literal("public-stats") }),
  z.object({
    section: z.literal("raid-leaderboard"),
    period: z.enum(["daily", "weekly", "all-time"]).default("weekly")
  }),
  z.object({ section: z.literal("display-name-availability"), displayName: displayNameSchema })
]);
const lobbySchema = z.object({
  mapId: z.string().min(3),
  lobbyType: z.enum(["PUBLIC", "PRIVATE", "FRIENDS_ONLY"]).default("PUBLIC"),
  recommendedPower: z.number().int().nonnegative().default(0),
  heroId: z.string().min(3).default("storm-archer"),
  neededHeroIds: lobbyNeededHeroIdsSchema
});
const lobbyIdSchema = z.object({ lobbyId: z.string().uuid() });
const readySchema = z.object({ lobbyId: z.string().uuid(), ready: z.boolean() });
const kickSchema = z.object({ lobbyId: z.string().uuid(), playerId: z.string().min(2) });
const raidRunSchema = z.object({
  lobbyId: z.string().uuid().optional(),
  mapId: z.string().min(3).default("tower-1-1"),
  idempotencyKey: idempotencyKeySchema
});
const questClaimSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    achievementId: z.string().min(2).max(120).optional(),
    idempotencyKey: idempotencyKeySchema
  })
  .refine((body) => Boolean(body.assignmentId) !== Boolean(body.achievementId), {
    message: "Provide either assignmentId or achievementId"
  });
const chatSchema = z.object({
  channel: z.enum(["TOWN", "PARTY", "WHISPER", "SYSTEM"]),
  townChannel: townServerIdSchema.default("solbloom-1"),
  message: z.string().min(1).max(400),
  targetPlayerId: z.string().optional()
});
const townServerSchema = z.object({
  townChannel: townServerIdSchema.default("solbloom-1")
});
const townPositionSchema = z.object({
  townChannel: townServerIdSchema.default("solbloom-1"),
  x: z.number().int().min(54).max(1200),
  y: z.number().int().min(120).max(1208),
  facingX: z.number().min(-1).max(1),
  facingY: z.number().min(-1).max(1)
});
const friendRequestSchema = z.object({ targetPlayerId: z.string().min(2) });
const acceptFriendSchema = z.object({ requestId: z.string().uuid() });
const blockPlayerSchema = z.object({ targetPlayerId: z.string().min(2) });
const adminEconomySchema = z.object({
  playerId: z.string().min(2),
  balanceType: z.enum(["EARNED_GOLD", "LOCKED_GOLD", "TEST_TOKEN"]),
  amount: z.number().int(),
  reason: z.string().min(8).max(300),
  idempotencyKey: idempotencyKeySchema
});
const adminPlayerSchema = z.object({
  playerId: z.string().min(2),
  action: z.enum(["MUTE", "TEMP_SUSPEND", "BAN", "UNBAN", "NOTE", "MARKET_FREEZE", "BLACKJACK_FREEZE"]),
  reason: z.string().min(8).max(300)
});
const adminConfigSchema = z.object({
  configKey: z.string().min(2).max(80),
  config: z.record(z.unknown()),
  reason: z.string().min(8).max(300)
});

const activeRaidStageIds = new Set(Array.from({ length: 10 }, (_, index) => `tower-1-${index + 1}`));

function raidStageRequirement(mapId: string): {
  mapNumber: number;
  stageNumber: number;
  requiredAccountLevel: number;
  previousStageId: string | null;
  previousStageLabel: string | null;
} {
  const match = mapId.match(/^tower-(\d+)-(\d+)$/);
  if (!match) {
    throw new HttpError(400, "Unknown raid stage");
  }
  const mapNumber = Number.parseInt(match[1], 10);
  const stageNumber = Number.parseInt(match[2], 10);
  if (!Number.isInteger(mapNumber) || !Number.isInteger(stageNumber) || mapNumber < 1 || mapNumber > 3 || stageNumber < 1 || stageNumber > 10) {
    throw new HttpError(400, "Unknown raid stage");
  }
  const requiredAccountLevel = (mapNumber - 1) * 10 + stageNumber;
  const previousStageId = mapNumber === 1 && stageNumber === 1 ? null : stageNumber === 1 ? `tower-${mapNumber - 1}-10` : `tower-${mapNumber}-${stageNumber - 1}`;
  const previousStageLabel = previousStageId
    ? previousStageId.replace(/^tower-(\d+)-(\d+)$/, "Stage $1-$2")
    : null;
  return { mapNumber, stageNumber, requiredAccountLevel, previousStageId, previousStageLabel };
}

export const handlers: Record<string, EdgeHandler> = {
  "create-wallet-nonce": createWalletNonce,
  "verify-wallet-signature": verifyWalletSignature,
  "create-player-profile": createPlayerProfile,
  "get-player-bootstrap-data": getPlayerBootstrapData,
  "create-market-listing": createMarketListing,
  "cancel-market-listing": cancelMarketListing,
  "buy-market-listing": buyMarketListing,
  "create-buy-order": createBuyOrder,
  "cancel-buy-order": cancelBuyOrder,
  "fill-buy-order": fillBuyOrder,
  "start-blackjack-hand": startBlackjackHand,
  "blackjack-hit": (context) => actOnBlackjack(context, "HIT"),
  "blackjack-stand": (context) => actOnBlackjack(context, "STAND"),
  "blackjack-double-down": (context) => actOnBlackjack(context, "DOUBLE_DOWN"),
  "buy-bound-shop-item": buyBoundShopItem,
  "equip-item": equipItem,
  "swap-equipment": equipItem,
  "unequip-item": unequipItem,
  "starlight-vault-state": starlightVaultState,
  "starlight-vault-draw": starlightVaultDraw,
  "equip-full-costume": equipFullCostume,
  "create-lobby": createLobby,
  "join-lobby": joinLobby,
  "leave-lobby": leaveLobby,
  "set-ready-state": setReadyState,
  "kick-lobby-player": kickLobbyPlayer,
  "start-prototype-raid": startPrototypeRaid,
  "finalize-prototype-raid": startPrototypeRaid,
  "get-player-quests": getPlayerQuests,
  "claim-quest-reward": claimQuestReward,
  "select-town-server": selectTownServer,
  "save-town-position": saveTownPosition,
  "send-chat-message": sendChatMessage,
  "send-friend-request": sendFriendRequest,
  "accept-friend-request": acceptFriendRequest,
  "block-player": blockPlayer,
  "admin-player-action": adminPlayerAction,
  "admin-market-action": adminMarketAction,
  "admin-economy-action": adminEconomyAction,
  "admin-config-action": adminConfigAction,
  "admin-moderation-action": adminPlayerAction,
  "admin-bootstrap": adminBootstrap
};

export async function dispatchAction(name: string, context: EdgeContext): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) {
    throw new HttpError(404, `Unknown Edge Function action: ${name}`);
  }
  return handler(context);
}

async function createWalletNonce(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const parsed = walletNonceRequestSchema.safeParse(context.body);
  if (!parsed.success) {
    throw walletAuthError("missing_request_field");
  }
  const body = parsed.data;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const message = [
    "SolTower wallet login",
    `Wallet: ${body.publicKeyBase58}`,
    `Supabase user: ${user.id}`,
    `Nonce: ${nonce}`,
    `Request ID: ${body.requestId}`,
    `Provider: ${body.provider}`,
    `Issued at: ${issuedAt}`,
    "This signature verifies wallet ownership only. It does not move funds or approve a transaction."
  ].join("\n");
  const messageBytes = new TextEncoder().encode(message);
  const messageBase64 = bytesToBase64(messageBytes);
  const messageSha256 = await sha256Bytes(messageBytes);

  const insertResult = await checked(
    context.service.schema("private").from("wallet_login_nonces").insert({
      auth_user_id: user.id,
      public_key: body.publicKeyBase58,
      nonce,
      message,
      request_id: body.requestId,
      provider: body.provider,
      message_base64: messageBase64,
      message_sha256: messageSha256,
      expires_at: expiresAt
    }).select("id").single()
  );
  const challenge = asRecord(insertResult.data, "wallet challenge");

  return {
    publicKey: body.publicKeyBase58,
    challengeWalletPublicKey: body.publicKeyBase58,
    challengeId: toStringValue(challenge.id),
    nonce,
    messageBase64,
    messageSha256,
    expiresAt,
    requestId: body.requestId
  };
}

async function verifyWalletSignature(context: EdgeContext): Promise<JsonRecord> {
  const diagnostic: JsonRecord = {
    event: "wallet_signature_verification",
    provider: safeDiagnosticString(context.body.provider),
    challengeId: safeDiagnosticString(context.body.challengeId),
    challengeWalletPublicKey: null,
    submittedWalletPublicKey: safeDiagnosticString(context.body.publicKeyBase58),
    currentWalletPublicKey: safeDiagnosticString(context.body.currentWalletPublicKey),
    expectedSignatureEncoding: "base64",
    receivedSignatureEncoding: "unknown",
    verifierLibraryName: "tweetnacl"
  };
  try {
    const user = requireUser(context);
    if (missingWalletVerificationFields(context.body).length > 0) {
      if (isDevMode()) {
        console.error(JSON.stringify({ ...diagnostic, result: "missing_request_field" }));
      }
      throw walletAuthError("missing_request_field");
    }
    const parsed = walletVerificationRequestSchema.safeParse(context.body);
    if (!parsed.success) {
      if (isDevMode()) {
        console.error(JSON.stringify({ ...diagnostic, result: "missing_request_field" }));
      }
      throw walletAuthError("missing_request_field");
    }
    const body = parsed.data;
    const nonceResult = await checked(
      context.service
        .schema("private")
        .from("wallet_login_nonces")
        .select("*")
        .eq("auth_user_id", user.id)
        .eq("id", body.challengeId)
        .maybeSingle()
    );
    if (!nonceResult.data) {
      await failWalletVerification("stale_challenge", diagnostic);
    }
    const nonce = asRecord(nonceResult.data, "wallet nonce");
    const storedMessage = toStringValue(nonce.message);
    const storedMessageBase64 = toStringValue(nonce.message_base64, bytesToBase64(new TextEncoder().encode(storedMessage)));
    const storedMessageBytes = decodeBase64Bytes(storedMessageBase64);
    const storedMessageSha256 = toStringValue(nonce.message_sha256, await sha256Bytes(storedMessageBytes ?? new TextEncoder().encode(storedMessage)));
    const signatureBytes = decodeBase64Signature(body.signatureBase64);
    const publicKeyBytes = decodePublicKeyBytes(body.publicKeyBase58);
    Object.assign(diagnostic, {
      provider: body.provider,
      challengeId: body.challengeId,
      challengeWalletPublicKey: toStringValue(nonce.public_key),
      nonceId: maskDiagnosticValue(nonce.id),
      nonceCreatedTime: toStringValue(nonce.created_at),
      nonceExpiryTime: toStringValue(nonce.expires_at),
      nonceConsumed: Boolean(nonce.consumed_at),
      publicKeyByteLength: publicKeyBytes?.byteLength ?? 0,
      storedMessageByteLength: storedMessageBytes?.byteLength ?? 0,
      storedMessageSha256,
      submittedSignatureByteLength: signatureBytes?.byteLength ?? 0,
      receivedSignatureEncoding: signatureBytes ? "base64" : "invalid"
    });
    if (!storedMessageBytes) {
      await failWalletVerification("message_bytes_mismatch", diagnostic);
    }

    const verificationFailure = walletVerificationFailure({
      requestId: body.requestId,
      submittedWalletPublicKey: body.publicKeyBase58,
      currentWalletPublicKey: body.currentWalletPublicKey,
      challengeRequestId: toStringValue(nonce.request_id, challengeMessageField(storedMessage, "Request ID")),
      challengeWalletPublicKey: toStringValue(nonce.public_key),
      expiresAt: toStringValue(nonce.expires_at),
      consumedAt: typeof nonce.consumed_at === "string" ? nonce.consumed_at : null,
      signatureEncodingValid: Boolean(signatureBytes),
      signatureByteLength: signatureBytes?.byteLength ?? 0,
      publicKeyByteLength: publicKeyBytes?.byteLength ?? 0,
      signatureValid: Boolean(
        publicKeyBytes &&
          publicKeyBytes.byteLength === nacl.sign.publicKeyLength &&
        signatureBytes &&
          signatureBytes.byteLength === nacl.sign.signatureLength &&
          isValidWalletSignature(publicKeyBytes, signatureBytes, storedMessageBytes, body.provider, body.publicKeyBase58)
      ),
      now: Date.now()
    });
    if (verificationFailure) {
      await failWalletVerification(verificationFailure, diagnostic);
    }

    await assertWalletTowerBalance(
      body.publicKeyBase58,
      economyConfig.tokenGate.playMinimumTower,
      "Entering SolBloom Village"
    );

    const consumeResult = await checked(
      context.service
        .schema("private")
        .from("wallet_login_nonces")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", toStringValue(nonce.id))
        .is("consumed_at", null)
        .select("id")
        .maybeSingle()
    );
    if (!consumeResult.data) {
      await failWalletVerification("duplicate_submission", diagnostic);
    }
    console.info(JSON.stringify({ ...diagnostic, result: "success" }));

    const walletResult = await checked(
      context.service
        .from("wallet_public_keys")
        .select("player_id")
        .eq("public_key", body.publicKeyBase58)
        .maybeSingle()
    );
    if (!walletResult.data) {
      return {
        isNewPlayer: true,
        requiresProfile: true,
        intro: "Wallet verified. Create your guardian profile.",
        verifiedWallet: {
          publicKey: body.publicKeyBase58,
          nonce: toStringValue(nonce.nonce),
          expiresAt: toStringValue(nonce.expires_at)
        },
        selectedHeroId: "storm-archer",
        starterLockedGold: 50,
        starterEquipmentCount: 4
      };
    }

    const linkedWallet = asRecord(walletResult.data, "linked wallet");
    await checked(
      context.service
        .from("auth_user_mappings")
        .delete()
        .eq("player_id", toStringValue(linkedWallet.player_id))
    );
    const profileResult = await checked(
      context.service.schema("private").rpc("create_profile_for_wallet", {
        p_auth_user_id: user.id,
        p_wallet_public_key: body.publicKeyBase58,
        p_display_name: "Guardian",
        p_wallet_name: body.provider
      })
    );
    asRecord(profileResult.data, "create_profile_for_wallet");
    const bootstrap = await loadPlayerBootstrap(context, user.id);

    return {
      ...bootstrap,
      isNewPlayer: false,
      requiresProfile: false,
      intro: "Returning profile loaded."
    };
  } catch (error) {
    if (error instanceof HttpError && error.code) {
      throw error;
    }
    console.error(JSON.stringify({ ...diagnostic, result: "unknown_verification_error" }));
    throw walletAuthError("unknown_verification_error", error instanceof HttpError ? error.status : 500);
  }
}

async function createPlayerProfile(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = createPlayerProfileSchema.parse(context.body);
  const existing = await maybePlayerProfile(context, user.id);
  if (existing) {
    return {
      ...(await loadPlayerBootstrap(context, user.id)),
      isNewPlayer: false,
      requiresProfile: false,
      intro: "Returning profile loaded."
    };
  }

  const nonceResult = await checked(
    context.service
      .schema("private")
      .from("wallet_login_nonces")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("public_key", body.publicKey)
      .eq("nonce", body.nonce)
      .not("consumed_at", "is", null)
      .maybeSingle()
  );
  const nonce = nullableRecord(nonceResult.data, "Verified wallet login required");
  const expiresAt = Date.parse(toStringValue(nonce.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    throw new HttpError(400, "Verified wallet login expired");
  }
  await assertWalletTowerBalance(
    body.publicKey,
    economyConfig.tokenGate.playMinimumTower,
    "Entering SolBloom Village"
  );

  const profileResult = await checked(
    context.service.schema("private").rpc("create_profile_for_wallet", {
      p_auth_user_id: user.id,
      p_wallet_public_key: body.publicKey,
      p_display_name: body.displayName,
      p_wallet_name: body.walletName ?? "Solana Wallet",
      p_selected_hero_id: body.heroId
    })
  );
  const profile = asRecord(profileResult.data, "create_profile_for_wallet");
  return {
    ...(await loadPlayerBootstrap(context, user.id)),
    isNewPlayer: toBoolean(profile.isNewPlayer),
    requiresProfile: false,
    intro: toBoolean(profile.isNewPlayer)
      ? "Welcome to SolBloom Village."
      : "Returning profile loaded."
  };
}

async function getPlayerBootstrapData(context: EdgeContext): Promise<JsonRecord> {
  const body = bootstrapRequestSchema.parse({
    ...context.body,
    section: typeof context.body.section === "string" ? context.body.section : "me"
  });
  if (body.section === "public-stats") {
    const freshSince = new Date(Date.now() - TOWN_PRESENCE_STALE_AFTER_SECONDS * 1000).toISOString();
    const [presence, active] = await Promise.all([
      checked(context.service.from("player_presence").select("*", { count: "exact", head: true })),
      checked(
        context.service
          .from("player_presence")
          .select("*", { count: "exact", head: true })
          .eq("presence_status", "IN_TOWN")
          .gte("last_seen_at", freshSince)
      )
    ]);
    return {
      devMode: isDevMode(),
      testWorldActive: isDevMode(),
      demoPresenceCount: presence.count ?? 0,
      activeTownCount: active.count ?? 0
    };
  }

  const user = requireUser(context);
  if (body.section === "display-name-availability") {
    const result = await checked(context.service.from("player_profiles").select("display_name").limit(1000));
    const requested = body.displayName.trim().toLocaleLowerCase();
    return {
      displayName: body.displayName.trim(),
      available: !rows(result.data).some(
        (profile) => toStringValue(profile.display_name).toLocaleLowerCase() === requested
      )
    };
  }
  if (body.section === "blackjack") {
    return loadBlackjackState(context, user.id);
  }
  if (body.section === "raid-leaderboard") {
    return loadRaidLeaderboard(context, body.period);
  }
  return loadPlayerBootstrap(context, user.id);
}

async function loadRaidLeaderboard(
  context: EdgeContext,
  period: "daily" | "weekly" | "all-time"
): Promise<JsonRecord> {
  const now = new Date();
  const cutoff =
    period === "daily"
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      : period === "weekly"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : null;
  let query = context.service
    .from("raid_history")
    .select(
      "player_id,map_id,duration_seconds,wave_count,boss_defeated,reward_earned_gold,reward_xp,created_at"
    )
    .eq("success", true)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (cutoff) {
    query = query.gte("created_at", cutoff.toISOString());
  }
  const historyResult = await checked(query);
  const history = rows(historyResult.data);
  const playerIds = [...new Set(history.map((row) => toStringValue(row.player_id)).filter(Boolean))];
  const profilesResult = playerIds.length
    ? await checked(
        context.service
          .from("player_profiles")
          .select("player_id,display_name,selected_hero_id,account_level,power")
          .in("player_id", playerIds)
      )
    : { data: [] };
  const profiles = new Map(
    rows(profilesResult.data).map((profile) => [
      toStringValue(profile.player_id),
      profile
    ])
  );
  const totals = new Map<
    string,
    {
      clears: number;
      bosses: number;
      earnedGold: number;
      xp: number;
      fastestSeconds: number;
      latestClearAt: string;
    }
  >();
  for (const row of history) {
    const playerId = toStringValue(row.player_id);
    if (!playerId) continue;
    const current = totals.get(playerId) ?? {
      clears: 0,
      bosses: 0,
      earnedGold: 0,
      xp: 0,
      fastestSeconds: Number.MAX_SAFE_INTEGER,
      latestClearAt: ""
    };
    current.clears += 1;
    current.bosses += toBoolean(row.boss_defeated) ? 1 : 0;
    current.earnedGold += toNumber(row.reward_earned_gold);
    current.xp += toNumber(row.reward_xp);
    current.fastestSeconds = Math.min(
      current.fastestSeconds,
      Math.max(1, toNumber(row.duration_seconds))
    );
    current.latestClearAt =
      current.latestClearAt || toStringValue(row.created_at);
    totals.set(playerId, current);
  }
  return {
    period,
    generatedAt: now.toISOString(),
    entries: [...totals.entries()].map(([playerId, total]) => {
      const profile = profiles.get(playerId);
      return {
        playerId,
        displayName: profile
          ? toStringValue(profile.display_name, "Unknown Guardian")
          : "Unknown Guardian",
        heroId: profile
          ? toStringValue(profile.selected_hero_id, "storm-archer")
          : "storm-archer",
        accountLevel: profile ? toNumber(profile.account_level, 1) : 1,
        power: profile ? toNumber(profile.power) : 0,
        clears: total.clears,
        bosses: total.bosses,
        earnedGold: total.earnedGold,
        xp: total.xp,
        fastestSeconds:
          total.fastestSeconds === Number.MAX_SAFE_INTEGER
            ? 0
            : total.fastestSeconds,
        latestClearAt: total.latestClearAt
      };
    })
  };
}

async function createMarketListing(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = createMarketListingSchema.parse(context.body);
  await assertGoldSellerRequirements(context, user.id);
  const result = await checked(
    context.service.schema("private").rpc("create_market_listing_for_auth", {
      p_auth_user_id: user.id,
      p_gold_amount: body.goldAmount,
      p_price_per_gold: body.pricePerGold,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { listing: camelRecord(asRecord(result.data, "market listing")) };
}

async function cancelMarketListing(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = listingIdSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("cancel_market_listing_for_auth", {
      p_auth_user_id: user.id,
      p_listing_id: body.listingId,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { listing: camelRecord(asRecord(result.data, "market listing")) };
}

async function buyMarketListing(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = listingIdSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("buy_market_listing_for_auth", {
      p_auth_user_id: user.id,
      p_listing_id: body.listingId,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { trade: camelRecord(asRecord(result.data, "market trade")) };
}

async function createBuyOrder(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = createBuyOrderSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("create_buy_order_for_auth", {
      p_auth_user_id: user.id,
      p_gold_amount: body.goldAmount,
      p_price_per_gold: body.pricePerGold,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { buyOrder: camelRecord(asRecord(result.data, "buy order")) };
}

async function cancelBuyOrder(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = cancelBuyOrderSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("cancel_buy_order_for_auth", {
      p_auth_user_id: user.id,
      p_order_id: body.orderId,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { buyOrder: camelRecord(asRecord(result.data, "buy order")) };
}

async function fillBuyOrder(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = fillBuyOrderSchema.parse(context.body);
  await assertGoldSellerRequirements(context, user.id);
  const result = await checked(
    context.service.schema("private").rpc("fill_buy_order_for_auth", {
      p_auth_user_id: user.id,
      p_order_id: body.orderId,
      p_gold_amount: body.goldAmount,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { fill: camelRecord(asRecord(result.data, "buy order fill")) };
}

async function startBlackjackHand(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = blackjackDealSchema.parse(context.body);
  const practiceMode = body.practice;
  if (practiceMode && !isDevMode()) {
    throw new HttpError(403, "Practice Blackjack is available only in development and test environments");
  }
  const balance = await loadBalances(context, player.id);
  const limits = getBlackjackLimits(player.accountLevel, balance[body.balanceType]);
  if (!practiceMode && (body.bet < limits.minBet || body.bet > limits.actualMaxBet)) {
    throw new HttpError(400, `Bet must be between ${limits.minBet} and ${limits.actualMaxBet}`);
  }
  if (player.blackjackFrozen) {
    throw new HttpError(403, "Blackjack access is frozen");
  }

  const existing = await checked(
    context.service
      .schema("private")
      .from("blackjack_hands")
      .select("*")
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle()
  );
  if (existing.data) {
    return { hand: safeHand(asRecord(existing.data, "blackjack hand")) };
  }

  if (!practiceMode) {
    await applyBalance(context, {
      playerId: player.id,
      balanceType: body.balanceType,
      sourceType: "BLACKJACK_WAGER",
      direction: "DEBIT",
      amount: body.bet,
      reason: "Blackjack wager",
      idempotencyKey: `${body.idempotencyKey}:wager`,
      referenceEntityType: "blackjack_hand"
    });
  }

  const cards = drawCards(4);
  const seedHash = await hashText(`${crypto.randomUUID()}:${user.id}:${Date.now()}`);
  const insertResult = await checked(
    context.service
      .schema("private")
      .from("blackjack_hands")
      .insert({
        player_id: player.id,
        balance_type: body.balanceType,
        bet: body.bet,
        total_wager: body.bet,
        practice_mode: practiceMode,
        status: "ACTIVE",
        player_cards: [cards[0], cards[2]],
        dealer_cards: [cards[1], cards[3]],
        shoe_seed_hash: seedHash,
        idempotency_key: body.idempotencyKey
      })
      .select("*")
      .single()
  );

  return { hand: safeHand(asRecord(insertResult.data, "blackjack hand")) };
}

async function actOnBlackjack(context: EdgeContext, action: "HIT" | "STAND" | "DOUBLE_DOWN"): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = blackjackActionSchema.parse(context.body);
  const handResult = await checked(
    context.service
      .schema("private")
      .from("blackjack_hands")
      .select("*")
      .eq("id", body.handId)
      .eq("player_id", player.id)
      .single()
  );
  const hand = asRecord(handResult.data, "blackjack hand");
  if (toStringValue(hand.status) !== "ACTIVE") {
    return { hand: safeHand(hand) };
  }

  let playerCards = cardArray(hand.player_cards);
  let dealerCards = cardArray(hand.dealer_cards);
  let totalWager = toNumber(hand.total_wager);
  const balanceType = toStringValue(hand.balance_type) as "EARNED_GOLD" | "LOCKED_GOLD";
  const practiceMode = toBoolean(hand.practice_mode);
  const id = toStringValue(hand.id);
  let status = "ACTIVE";
  let metadata: JsonRecord = {};

  if (action === "DOUBLE_DOWN") {
    if (!practiceMode) {
      await applyBalance(context, {
        playerId: player.id,
        balanceType,
        sourceType: "BLACKJACK_WAGER",
        direction: "DEBIT",
        amount: toNumber(hand.bet),
        reason: "Blackjack double-down wager",
        idempotencyKey: `${body.idempotencyKey}:double-down`,
        referenceEntityType: "blackjack_hand",
        referenceEntityId: id
      });
      totalWager += toNumber(hand.bet);
    }
    playerCards = [...playerCards, drawCards(1)[0]];
    ({ status, metadata } = settleBlackjack(playerCards, dealerCards));
  } else if (action === "HIT") {
    playerCards = [...playerCards, drawCards(1)[0]];
    if (handTotal(playerCards) > 21) {
      status = "LOST";
      metadata = { result: "PLAYER_BUST" };
    }
  } else {
    ({ status, metadata, dealerCards } = settleBlackjack(playerCards, dealerCards));
  }

  if (status !== "ACTIVE" && !practiceMode) {
    await settleBlackjackLedger(context, {
      playerId: player.id,
      accountLevel: player.accountLevel,
      balanceType,
      totalWager,
      status,
      idempotencyKey: body.idempotencyKey,
      handId: id
    });
  }

  const updateResult = await checked(
    context.service
      .schema("private")
      .from("blackjack_hands")
      .update({
        player_cards: playerCards,
        dealer_cards: dealerCards,
        total_wager: totalWager,
        status,
        result_metadata: metadata,
        settled_at: status === "ACTIVE" ? null : new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single()
  );

  return { hand: safeHand(asRecord(updateResult.data, "blackjack hand")) };
}

async function buyBoundShopItem(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = shopBuySchema.parse(context.body);
  const definition = equipmentDefinitions.find((entry) => entry.id === body.definitionId && entry.priceGold > 0);
  if (!definition) {
    throw new HttpError(404, "Shop item not found");
  }
  const balances = await loadBalances(context, player.id);
  const balanceType: BalanceType = balances.LOCKED_GOLD >= definition.priceGold ? "LOCKED_GOLD" : "EARNED_GOLD";
  await applyBalance(context, {
    playerId: player.id,
    balanceType,
    sourceType: "EQUIPMENT_PURCHASE",
    direction: "DEBIT",
    amount: definition.priceGold,
    reason: "Bound Shop equipment purchase",
    idempotencyKey: body.idempotencyKey,
    referenceEntityType: "equipment_definition",
    referenceEntityId: definition.id
  });
  const itemResult = await checked(
    context.service
      .from("inventory_items")
      .insert({
        player_id: player.id,
        definition_id: definition.id,
        item_type: "EQUIPMENT",
        bound: true,
        acquired_from: "BOUND_SHOP"
      })
      .select("*")
      .single()
  );
  return { item: inventoryItem(asRecord(itemResult.data, "inventory item")) };
}

async function equipItem(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = swapEquipmentSchema.parse({
    ...equipItemSchema.parse(context.body),
    slot: toStringValue(context.body.slot),
    idempotencyKey: toStringValue(context.body.idempotencyKey, crypto.randomUUID())
  });
  const result = await checked(
    context.service.schema("private").rpc("swap_equipment_for_auth", {
      p_auth_user_id: user.id,
      p_new_item_id: body.equipmentId,
      p_slot: body.slot,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return asRecord(result.data, "equipment swap");
}

async function unequipItem(context: EdgeContext): Promise<JsonRecord> {
  requireUser(context);
  equipItemSchema.parse(context.body);
  throw new HttpError(400, "Core equipment slots cannot be unequipped. Choose a replacement item instead.");
}

async function starlightVaultState(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = starlightVaultStateSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("starlight_vault_state_for_auth", {
      p_auth_user_id: user.id
    })
  );
  const state = asRecord(result.data, "starlight vault state");
  if (body.includeDeveloperValidation && isDevMode()) {
    const validationResult = await checked(
      context.service
        .from("manual_asset_registry")
        .select("*")
        .in("asset_status", ["pending_manual_art", "partial", "disabled"])
        .order("asset_kind", { ascending: true })
        .limit(200)
    );
    return {
      ...state,
      assetValidation: rows(validationResult.data).map(camelRecord)
    };
  }
  return state;
}

async function starlightVaultDraw(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = starlightVaultDrawSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("perform_starlight_vault_draw_for_auth", {
      p_auth_user_id: user.id,
      p_banner_id: body.bannerId,
      p_payment_balance_type: body.paymentBalanceType,
      p_draw_count: body.drawCount,
      p_active_hero_id: body.activeHeroId,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return asRecord(result.data, "starlight vault draw");
}

async function equipFullCostume(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = equipFullCostumeSchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("equip_full_costume_for_auth", {
      p_auth_user_id: user.id,
      p_hero_id: body.heroId,
      p_costume_id: body.costumeId
    })
  );
  return asRecord(result.data, "full costume equip");
}

async function createLobby(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = lobbySchema.parse(context.body);
  await expireStaleRaidLobbies(context);
  const existingOpenLobby = await loadOpenLobbyMembership(context, player.id);
  if (existingOpenLobby) {
    throw new HttpError(409, "Leave or disband your current party before creating another.");
  }
  await assertRaidStageAccess(context, player, body.mapId);
  const lobbyResult = await checked(
    context.service
      .from("raid_lobbies")
      .insert({
        host_player_id: player.id,
        lobby_type: body.lobbyType,
        map_id: body.mapId,
        recommended_power: body.recommendedPower,
        needed_hero_ids: body.neededHeroIds,
        status: "OPEN"
      })
      .select("*")
      .single()
  );
  const lobby = asRecord(lobbyResult.data, "raid lobby");
  await checked(
    context.service.from("raid_lobby_members").insert({
      lobby_id: toStringValue(lobby.id),
      player_id: player.id,
      hero_id: body.heroId,
      account_level: player.accountLevel,
      power: player.power,
      ready: false,
      host: true
    })
  );
  return { lobby: await loadLobby(context, toStringValue(lobby.id)) };
}

async function joinLobby(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = lobbyIdSchema.parse(context.body);
  await expireStaleRaidLobbies(context);
  const lobbyResult = await checked(context.service.from("raid_lobbies").select("*").eq("id", body.lobbyId).single());
  const lobby = asRecord(lobbyResult.data, "raid lobby");
  const status = toStringValue(lobby.status, "OPEN");
  if (status !== "OPEN") {
    throw new HttpError(409, "Lobby is not open");
  }
  if (isExpiredLobby(lobby)) {
    await expireRaidLobby(context, body.lobbyId);
    throw new HttpError(409, "Lobby recruitment expired");
  }
  const membersResult = await checked(context.service.from("raid_lobby_members").select("player_id").eq("lobby_id", body.lobbyId));
  const memberRows = rows(membersResult.data);
  const alreadyJoined = memberRows.some((member) => toStringValue(member.player_id) === player.id);
  if (alreadyJoined) {
    return { lobby: await loadLobby(context, body.lobbyId) };
  }
  const existingOpenLobby = await loadOpenLobbyMembership(context, player.id, body.lobbyId);
  if (existingOpenLobby) {
    throw new HttpError(409, "Leave or disband your current party before joining another.");
  }
  if (memberRows.length >= 4) {
    throw new HttpError(409, "Lobby is full");
  }
  await assertRaidStageAccess(context, player, toStringValue(lobby.map_id));
  await checked(
    context.service.from("raid_lobby_members").upsert({
      lobby_id: body.lobbyId,
      player_id: player.id,
      hero_id: player.selectedHeroId,
      account_level: player.accountLevel,
      power: player.power,
      ready: false,
      host: false
    })
  );
  return { lobby: await loadLobby(context, body.lobbyId) };
}

async function leaveLobby(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = lobbyIdSchema.parse(context.body);
  await expireStaleRaidLobbies(context);
  const membershipResult = await checked(
    context.service
      .from("raid_lobby_members")
      .select("player_id,host")
      .eq("lobby_id", body.lobbyId)
      .eq("player_id", player.id)
      .maybeSingle()
  );
  if (!membershipResult.data) {
    return { ok: true };
  }
  const membership = asRecord(membershipResult.data, "lobby membership");
  if (toBoolean(membership.host)) {
    await checked(context.service.from("raid_lobbies").update({ status: "DISBANDED" }).eq("id", body.lobbyId).eq("status", "OPEN"));
    await checked(context.service.from("raid_lobby_members").delete().eq("lobby_id", body.lobbyId));
    return { ok: true, disbanded: true };
  }
  await checked(context.service.from("raid_lobby_members").delete().eq("lobby_id", body.lobbyId).eq("player_id", player.id));
  return { ok: true };
}

async function setReadyState(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = readySchema.parse(context.body);
  await expireStaleRaidLobbies(context);
  await checked(
    context.service
      .from("raid_lobby_members")
      .update({ ready: body.ready })
      .eq("lobby_id", body.lobbyId)
      .eq("player_id", player.id)
  );
  return { lobby: await loadLobby(context, body.lobbyId) };
}

async function kickLobbyPlayer(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = kickSchema.parse(context.body);
  await expireStaleRaidLobbies(context);
  const hostResult = await checked(
    context.service
      .from("raid_lobby_members")
      .select("*")
      .eq("lobby_id", body.lobbyId)
      .eq("player_id", player.id)
      .eq("host", true)
      .maybeSingle()
  );
  if (!hostResult.data) {
    throw new HttpError(403, "Only the lobby host can kick players");
  }
  const targetResult = await checked(
    context.service
      .from("raid_lobby_members")
      .select("player_id,host")
      .eq("lobby_id", body.lobbyId)
      .eq("player_id", body.playerId)
      .maybeSingle()
  );
  if (!targetResult.data) {
    return { lobby: await loadLobby(context, body.lobbyId) };
  }
  const target = asRecord(targetResult.data, "target lobby member");
  if (toBoolean(target.host) || toStringValue(target.player_id) === player.id) {
    throw new HttpError(400, "Use Disband Party instead of kicking the host.");
  }
  await checked(context.service.from("raid_lobby_members").delete().eq("lobby_id", body.lobbyId).eq("player_id", body.playerId));
  return { lobby: await loadLobby(context, body.lobbyId) };
}

async function startPrototypeRaid(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = raidRunSchema.parse(context.body);
  const existing = await checked(
    context.service
      .from("raid_history")
      .select("*")
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle()
  );
  if (existing.data) {
    return { raid: camelRecord(asRecord(existing.data, "raid history")) };
  }
  await expireStaleRaidLobbies(context);
  let partyPlayerIds = [player.id];
  if (body.lobbyId) {
    const lobbyResult = await checked(context.service.from("raid_lobbies").select("*").eq("id", body.lobbyId).single());
    const lobby = asRecord(lobbyResult.data, "raid lobby");
    if (toStringValue(lobby.status, "OPEN") !== "OPEN") {
      throw new HttpError(409, "Lobby is not open");
    }
    if (isExpiredLobby(lobby)) {
      await expireRaidLobby(context, body.lobbyId);
      throw new HttpError(409, "Lobby recruitment expired");
    }
    if (toStringValue(lobby.map_id) !== body.mapId) {
      throw new HttpError(400, "Raid stage does not match the lobby");
    }
    const hostResult = await checked(
      context.service
        .from("raid_lobby_members")
        .select("*")
        .eq("lobby_id", body.lobbyId)
        .eq("player_id", player.id)
        .eq("host", true)
        .maybeSingle()
    );
    if (!hostResult.data) {
      throw new HttpError(403, "Only the lobby host can start the run");
    }
    const lobbyMembersResult = await checked(
      context.service.from("raid_lobby_members").select("player_id,ready,host").eq("lobby_id", body.lobbyId)
    );
    const lobbyMembers = rows(lobbyMembersResult.data);
    const partyIsReady = lobbyMembers.length >= 1 && lobbyMembers.every((member) => toBoolean(member.host) || toBoolean(member.ready));
    if (!partyIsReady) {
      throw new HttpError(409, "All non-host party members must be ready before the raid can start");
    }
    partyPlayerIds = lobbyMembers
      .map((member) => toStringValue(member.player_id))
      .filter(Boolean);
  }
  await assertRaidStageAccess(context, player, body.mapId);
  const profilesResult = await checked(
    context.service
      .from("player_profiles")
      .select("player_id,account_level,xp,power")
      .in("player_id", partyPlayerIds)
  );
  const profiles = rows(profilesResult.data);
  let hostRaid: JsonRecord | null = null;
  for (const memberId of partyPlayerIds) {
    const profile =
      profiles.find((entry) => toStringValue(entry.player_id) === memberId) ??
      (memberId === player.id
        ? {
            player_id: player.id,
            account_level: player.accountLevel,
            xp: player.xp,
            power: player.power
          }
        : null);
    if (!profile) {
      continue;
    }
    const memberRaidKey =
      memberId === player.id
        ? body.idempotencyKey
        : `${body.idempotencyKey}:member:${memberId}`;
    const memberExisting = await checked(
      context.service
        .from("raid_history")
        .select("*")
        .eq("idempotency_key", memberRaidKey)
        .maybeSingle()
    );
    if (memberExisting.data) {
      if (memberId === player.id) {
        hostRaid = asRecord(memberExisting.data, "raid history");
      }
      continue;
    }
    const memberPower = toNumber(profile.power);
    const earnedGold =
      economyConfig.raidBaseGoldReward + Math.floor(memberPower / 160);
    const xp = economyConfig.raidBaseXpReward;
    await applyBalance(context, {
      playerId: memberId,
      balanceType: "EARNED_GOLD",
      sourceType: "RAID_REWARD",
      direction: "CREDIT",
      amount: earnedGold,
      reason: "Synchronized raid victory reward",
      idempotencyKey: `${memberRaidKey}:earned-gold`,
      referenceEntityType: "raid"
    });
    await checked(
      context.service.schema("private").rpc("add_player_xp", {
        p_player_id: memberId,
        p_reward_xp: xp,
        p_idempotency_key: `${memberRaidKey}:xp`,
        p_source_type: "RAID_REWARD",
        p_reference_entity_type: "raid",
        p_reference_entity_id: body.mapId
      })
    );
    const raidResult = await checked(
      context.service
        .from("raid_history")
        .insert({
          lobby_id: body.lobbyId ?? null,
          player_id: memberId,
          map_id: body.mapId,
          duration_seconds: 60,
          wave_count: 10,
          boss_defeated: true,
          success: true,
          reward_earned_gold: earnedGold,
          reward_xp: xp,
          idempotency_key: memberRaidKey
        })
        .select("*")
        .single()
    );
    const raid = asRecord(raidResult.data, "raid history");
    await recordQuestProgressFromRaid(context, { id: memberId }, raid);
    if (memberId === player.id) {
      hostRaid = raid;
    }
  }
  if (body.lobbyId) {
    await checked(
      context.service
        .from("raid_lobbies")
        .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
        .eq("id", body.lobbyId)
        .eq("status", "OPEN")
    );
  }
  if (!hostRaid) {
    throw new HttpError(500, "Raid settlement did not produce a host record");
  }
  return { raid: camelRecord(hostRaid) };
}

async function getPlayerQuests(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  await ensureQuestAssignments(context, player.id);
  await refreshPlayerAchievements(context, player.id);

  const now = new Date();
  const daily = periodFor(now, "DAILY");
  const weekly = periodFor(now, "WEEKLY");
  const [definitionsResult, assignmentsResult, achievementsResult] = await Promise.all([
    checked(context.service.from("quest_definitions").select("*").eq("enabled", true).order("sort_order", { ascending: true })),
    checked(
      context.service
        .from("player_quest_assignments")
        .select("*")
        .eq("player_id", player.id)
        .in("period_start", [daily.start.toISOString(), weekly.start.toISOString()])
        .order("created_at", { ascending: true })
    ),
    checked(context.service.from("player_achievements").select("*").eq("player_id", player.id))
  ]);

  const definitions = rows(definitionsResult.data);
  const assignments = rows(assignmentsResult.data);
  const achievements = rows(achievementsResult.data);
  const byDefinition = new Map(definitions.map((definition) => [toStringValue(definition.id), definition]));
  const available = eligibilityFlags();
  const unavailableWeekly = definitions
    .filter((definition) => toStringValue(definition.cadence) === "WEEKLY")
    .filter((definition) => !isQuestDefinitionEligible(definition, available))
    .map((definition) => ({
      id: toStringValue(definition.id),
      title: toStringValue(definition.title),
      reason: unavailableReason(definition)
    }));

  return {
    serverTime: now.toISOString(),
    dailyResetAt: daily.end.toISOString(),
    weeklyResetAt: weekly.end.toISOString(),
    daily: assignments
      .filter((assignment) => toStringValue(assignment.cadence) === "DAILY")
      .map((assignment) => questView(assignment, byDefinition.get(toStringValue(assignment.quest_definition_id)))),
    weekly: assignments
      .filter((assignment) => toStringValue(assignment.cadence) === "WEEKLY")
      .map((assignment) => questView(assignment, byDefinition.get(toStringValue(assignment.quest_definition_id)))),
    achievements: definitions
      .filter((definition) => toStringValue(definition.cadence) === "ACHIEVEMENT")
      .map((definition) => achievementView(definition, achievements.find((entry) => entry.achievement_id === definition.id))),
    unavailableWeekly
  };
}

async function claimQuestReward(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const body = questClaimSchema.parse(context.body);
  if (body.assignmentId) {
    const result = await checked(
      context.service.schema("private").rpc("claim_player_quest_reward", {
        p_auth_user_id: user.id,
        p_assignment_id: body.assignmentId,
        p_idempotency_key: body.idempotencyKey
      })
    );
    return asRecord(result.data, "quest reward claim");
  }

  const result = await checked(
    context.service.schema("private").rpc("claim_player_achievement", {
      p_auth_user_id: user.id,
      p_achievement_id: body.achievementId,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return asRecord(result.data, "achievement claim");
}

type QuestCadence = "DAILY" | "WEEKLY";

interface QuestPeriod {
  start: Date;
  end: Date;
  graceUntil: Date;
}

function periodFor(now: Date, cadence: QuestCadence): QuestPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (cadence === "WEEKLY") {
    const day = start.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (cadence === "DAILY" ? 1 : 7));
  const graceUntil = new Date(end);
  graceUntil.setUTCDate(graceUntil.getUTCDate() + (cadence === "DAILY" ? 2 : 7));
  return { start, end, graceUntil };
}

function eligibilityFlags(): {
  bossAvailable: boolean;
  partyAvailable: boolean;
  fullPartyAvailable: boolean;
  skillEventsAvailable: boolean;
} {
  return {
    bossAvailable: true,
    partyAvailable: false,
    fullPartyAvailable: false,
    skillEventsAvailable: false
  };
}

function isQuestDefinitionEligible(
  definition: JsonRecord,
  flags = eligibilityFlags()
): boolean {
  if (toBoolean(definition.requires_boss) && !flags.bossAvailable) return false;
  if (toBoolean(definition.requires_party) && !flags.partyAvailable) return false;
  if (toBoolean(definition.requires_full_party) && !flags.fullPartyAvailable) return false;
  if (toBoolean(definition.requires_skill_events) && !flags.skillEventsAvailable) return false;
  return true;
}

function unavailableReason(definition: JsonRecord): string {
  if (toBoolean(definition.requires_full_party)) return "Full-party raid validation is not enabled yet.";
  if (toBoolean(definition.requires_party)) return "Party raid validation is not enabled yet.";
  if (toBoolean(definition.requires_skill_events)) return "Verified skill-use events are not enabled yet.";
  if (toBoolean(definition.requires_boss)) return "No currently unlocked boss map is available.";
  return "Not eligible for the current DEV content set.";
}

async function ensureQuestAssignments(context: EdgeContext, playerId: string): Promise<void> {
  const now = new Date();
  const daily = periodFor(now, "DAILY");
  const weekly = periodFor(now, "WEEKLY");
  const [definitionsResult, existingResult] = await Promise.all([
    checked(context.service.from("quest_definitions").select("*").eq("enabled", true).order("sort_order", { ascending: true })),
    checked(
      context.service
        .from("player_quest_assignments")
        .select("*")
        .eq("player_id", playerId)
        .in("period_start", [daily.start.toISOString(), weekly.start.toISOString()])
    )
  ]);
  const definitions = rows(definitionsResult.data);
  const existing = rows(existingResult.data);
  const flags = eligibilityFlags();
  const dailyExisting = new Set(
    existing
      .filter((assignment) => toStringValue(assignment.cadence) === "DAILY")
      .map((assignment) => toStringValue(assignment.quest_definition_id))
  );
  const weeklyExisting = new Set(
    existing
      .filter((assignment) => toStringValue(assignment.cadence) === "WEEKLY")
      .map((assignment) => toStringValue(assignment.quest_definition_id))
  );

  const dailyEligible = definitions
    .filter((definition) => toStringValue(definition.cadence) === "DAILY")
    .filter((definition) => isQuestDefinitionEligible(definition, flags))
    .sort((a, b) => stableHash(`${playerId}:${daily.start.toISOString()}:${a.id}`) - stableHash(`${playerId}:${daily.start.toISOString()}:${b.id}`))
    .slice(0, 3)
    .filter((definition) => !dailyExisting.has(toStringValue(definition.id)));

  const weeklyEligible = definitions
    .filter((definition) => toStringValue(definition.cadence) === "WEEKLY")
    .filter((definition) => isQuestDefinitionEligible(definition, flags))
    .filter((definition) => !weeklyExisting.has(toStringValue(definition.id)));

  const inserts = [
    ...dailyEligible.map((definition) => assignmentInsert(playerId, definition, daily, "DAILY")),
    ...weeklyEligible.map((definition) => assignmentInsert(playerId, definition, weekly, "WEEKLY"))
  ];

  if (inserts.length > 0) {
    await checked(
      context.service
        .from("player_quest_assignments")
        .upsert(inserts, {
          onConflict: "player_id,quest_definition_id,period_start",
          ignoreDuplicates: true
        })
    );
  }
}

function assignmentInsert(
  playerId: string,
  definition: JsonRecord,
  period: QuestPeriod,
  cadence: QuestCadence
): JsonRecord {
  return {
    player_id: playerId,
    quest_definition_id: toStringValue(definition.id),
    cadence,
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
    grace_until: period.graceUntil.toISOString(),
    target_value: toNumber(definition.target_value, 1)
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

async function recordQuestProgressFromRaid(
  context: EdgeContext,
  player: { id: string },
  raid: JsonRecord
): Promise<void> {
  const raidId = toStringValue(raid.id);
  if (!raidId) {
    return;
  }
  await ensureQuestAssignments(context, player.id);
  const now = new Date();
  const daily = periodFor(now, "DAILY");
  const weekly = periodFor(now, "WEEKLY");
  const [definitionsResult, assignmentsResult] = await Promise.all([
    checked(context.service.from("quest_definitions").select("*").eq("enabled", true)),
    checked(
      context.service
        .from("player_quest_assignments")
        .select("*")
        .eq("player_id", player.id)
        .in("period_start", [daily.start.toISOString(), weekly.start.toISOString()])
    )
  ]);
  const definitions = new Map(rows(definitionsResult.data).map((definition) => [toStringValue(definition.id), definition]));
  for (const assignment of rows(assignmentsResult.data)) {
    const definition = definitions.get(toStringValue(assignment.quest_definition_id));
    if (!definition) {
      continue;
    }
    const amount = questProgressAmount(definition, raid);
    if (amount <= 0) {
      continue;
    }
    await checked(
      context.service.schema("private").rpc("record_quest_progress", {
        p_player_id: player.id,
        p_assignment_id: toStringValue(assignment.id),
        p_source_type: "raid_history",
        p_source_id: raidId,
        p_amount: amount,
        p_idempotency_key: `quest-progress:${raidId}:${assignment.id}`,
        p_metadata: {
          mapId: toStringValue(raid.map_id),
          nonAfk: true,
          success: toBoolean(raid.success),
          bossDefeated: toBoolean(raid.boss_defeated)
        }
      })
    );
  }
  await refreshPlayerAchievements(context, player.id);
}

function questProgressAmount(definition: JsonRecord, raid: JsonRecord): number {
  if (!toBoolean(raid.success)) {
    return 0;
  }
  const metric = toStringValue(definition.metric);
  if (metric === "raid_completed") return 1;
  if (metric === "waves_cleared") return toNumber(raid.wave_count);
  if (metric === "boss_defeated") return toBoolean(raid.boss_defeated) ? 1 : 0;
  if (metric === "non_afk_raid_completed") return 1;
  return 0;
}

async function refreshPlayerAchievements(context: EdgeContext, playerId: string): Promise<void> {
  const [
    definitionsResult,
    raidsResult,
    unlocksResult,
    gearResult,
    friendsAResult,
    friendsBResult
  ] = await Promise.all([
    checked(context.service.from("quest_definitions").select("*").eq("enabled", true).eq("cadence", "ACHIEVEMENT")),
    checked(context.service.from("raid_history").select("id,lobby_id,success").eq("player_id", playerId).eq("success", true).limit(10)),
    checked(context.service.from("player_map_unlocks").select("map_id").eq("player_id", playerId)),
    checked(
      context.service
        .from("inventory_items")
        .select("id")
        .eq("player_id", playerId)
        .neq("acquired_from", "STARTER")
        .not("equipped_slot", "is", null)
        .limit(1)
    ),
    checked(context.service.from("friendships").select("id").eq("player_a_id", playerId).limit(1)),
    checked(context.service.from("friendships").select("id").eq("player_b_id", playerId).limit(1))
  ]);
  const definitions = rows(definitionsResult.data);
  const raids = rows(raidsResult.data);
  const unlocks = new Set(rows(unlocksResult.data).map((row) => toStringValue(row.map_id)));
  const hasFriend = rows(friendsAResult.data).length > 0 || rows(friendsBResult.data).length > 0;
  const hasNonStarterGear = rows(gearResult.data).length > 0;
  const unlocked = new Map<string, { sourceType: string; sourceId: string }>();
  const firstRaid = raids[0];
  if (firstRaid) {
    unlocked.set("achievement-first-steps", { sourceType: "raid_history", sourceId: toStringValue(firstRaid.id) });
  }
  if (unlocks.has("tower-1-2")) {
    unlocked.set("achievement-tower-climber", { sourceType: "player_map_unlock", sourceId: "tower-1-2" });
  }
  if (unlocks.has("tower-1-3")) {
    unlocked.set("achievement-tower-veteran", { sourceType: "player_map_unlock", sourceId: "tower-1-3" });
  }
  if (hasNonStarterGear) {
    unlocked.set("achievement-gear-up", { sourceType: "inventory_item", sourceId: "non-starter-equipped" });
  }
  if (hasFriend) {
    unlocked.set("achievement-social-spark", { sourceType: "friendship", sourceId: playerId });
  }

  const inserts = definitions
    .filter((definition) => unlocked.has(toStringValue(definition.id)))
    .map((definition) => {
      const id = toStringValue(definition.id);
      const source = unlocked.get(id)!;
      return {
        player_id: playerId,
        achievement_id: id,
        unlocked_at: new Date().toISOString(),
        source_type: source.sourceType,
        source_id: source.sourceId,
        idempotency_key: `achievement:${playerId}:${id}`,
        metadata: {}
      };
    });

  if (inserts.length > 0) {
    await checked(
      context.service
        .from("player_achievements")
        .upsert(inserts, {
          onConflict: "player_id,achievement_id",
          ignoreDuplicates: true
        })
    );
  }
}

function questView(assignment: JsonRecord, definition: JsonRecord | undefined): JsonRecord {
  const progress = toNumber(assignment.progress);
  const target = toNumber(assignment.target_value, toNumber(definition?.target_value, 1));
  const claimed = Boolean(assignment.claimed_at);
  const complete = Boolean(assignment.completed_at) || progress >= target;
  return {
    assignmentId: toStringValue(assignment.id),
    definitionId: toStringValue(assignment.quest_definition_id),
    title: toStringValue(definition?.title, "Quest"),
    description: toStringValue(definition?.description),
    progress,
    target,
    rewardEarnedGold: toNumber(definition?.reward_earned_gold),
    rewardXp: toNumber(definition?.reward_xp),
    status: claimed ? "CLAIMED" : complete ? "COMPLETE" : "ACTIVE",
    resetAt: toStringValue(assignment.period_end),
    graceUntil: toStringValue(assignment.grace_until)
  };
}

function achievementView(definition: JsonRecord, achievement: JsonRecord | undefined): JsonRecord {
  const unlockedAt = toStringValue(achievement?.unlocked_at, "");
  const claimedAt = toStringValue(achievement?.claimed_at, "");
  return {
    achievementId: toStringValue(definition.id),
    title: toStringValue(definition.title),
    description: toStringValue(definition.description),
    status: claimedAt ? "CLAIMED" : unlockedAt ? "COMPLETE" : "LOCKED",
    unlockedAt: unlockedAt || null,
    claimedAt: claimedAt || null
  };
}

async function selectTownServer(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = townServerSchema.parse(context.body);
  await assertTownServerCapacity(context, body.townChannel, player.id);
  await updateTownPresence(context, player.id, body.townChannel);
  return {
    townChannel: body.townChannel,
    servers: await townServerStatuses(context)
  };
}

async function sendChatMessage(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = chatSchema.parse(context.body);
  if (body.channel === "TOWN") {
    await assertTownServerCapacity(context, body.townChannel, player.id);
    await updateTownPresence(context, player.id, body.townChannel);
  }
  const result = await checked(
    context.service
      .from("chat_messages")
      .insert({
        channel: body.channel,
        town_channel: body.townChannel,
        from_player_id: player.id,
        target_player_id: body.targetPlayerId ?? null,
        message: body.message
      })
      .select("*")
      .single()
  );
  return { message: camelRecord(asRecord(result.data, "chat message")) };
}

async function saveTownPosition(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = townPositionSchema.parse(context.body);
  const now = new Date().toISOString();
  const result = await checked(
    context.service
      .from("player_presence")
      .upsert({
        player_id: player.id,
        presence_status: "IN_TOWN",
        town_channel: body.townChannel,
        world_x: body.x,
        world_y: body.y,
        facing_x: body.facingX,
        facing_y: body.facingY,
        position_updated_at: now,
        last_seen_at: now
      })
      .select("world_x,world_y,facing_x,facing_y,position_updated_at")
      .single()
  );
  const position = asRecord(result.data, "saved town position");
  return {
    position: {
      x: toNumber(position.world_x),
      y: toNumber(position.world_y),
      facingX: toNumber(position.facing_x),
      facingY: toNumber(position.facing_y),
      updatedAt: toStringValue(position.position_updated_at)
    }
  };
}

async function updateTownPresence(context: EdgeContext, playerId: string, townChannel: z.infer<typeof townServerIdSchema>): Promise<void> {
  await checked(
    context.service
      .from("player_presence")
      .upsert({
        player_id: playerId,
        presence_status: "IN_TOWN",
        town_channel: townChannel,
        last_seen_at: new Date().toISOString()
      })
  );
}

async function assertTownServerCapacity(
  context: EdgeContext,
  townChannel: z.infer<typeof townServerIdSchema>,
  playerId: string
): Promise<void> {
  const freshSince = new Date(Date.now() - TOWN_PRESENCE_STALE_AFTER_SECONDS * 1000).toISOString();
  const result = await checked(
    context.service
      .from("player_presence")
      .select("*", { count: "exact", head: true })
      .eq("town_channel", townChannel)
      .eq("presence_status", "IN_TOWN")
      .gte("last_seen_at", freshSince)
      .neq("player_id", playerId)
  );
  if ((result.count ?? 0) >= TOWN_SERVER_CAPACITY) {
    throw new HttpError(409, "Town server is full", "town_server_full");
  }
}

async function townServerStatuses(context: EdgeContext): Promise<JsonRecord[]> {
  const freshSince = new Date(Date.now() - TOWN_PRESENCE_STALE_AFTER_SECONDS * 1000).toISOString();
  const result = await checked(
    context.service
      .from("player_presence")
      .select("player_id,town_channel,last_seen_at")
      .eq("presence_status", "IN_TOWN")
      .gte("last_seen_at", freshSince)
  );
  const playersByServer = new Map<string, Set<string>>();
  for (const row of (result.data ?? []) as JsonRecord[]) {
    const townChannel = toStringValue(row.town_channel, "solbloom-1");
    const playerId = toStringValue(row.player_id);
    if (!playerId) {
      continue;
    }
    const players = playersByServer.get(townChannel) ?? new Set<string>();
    players.add(playerId);
    playersByServer.set(townChannel, players);
  }
  return townServerIds.map((id, index) => {
    const online = playersByServer.get(id)?.size ?? 0;
    return {
      id,
      label: `SolBloom ${index + 1}`,
      online,
      capacity: TOWN_SERVER_CAPACITY,
      isFull: online >= TOWN_SERVER_CAPACITY
    };
  });
}

async function sendFriendRequest(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = friendRequestSchema.parse(context.body);
  const result = await checked(
    context.service
      .from("friend_requests")
      .insert({ from_player_id: player.id, to_player_id: body.targetPlayerId, status: "PENDING" })
      .select("*")
      .single()
  );
  return { request: camelRecord(asRecord(result.data, "friend request")) };
}

async function acceptFriendRequest(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = acceptFriendSchema.parse(context.body);
  const requestResult = await checked(context.service.from("friend_requests").select("*").eq("id", body.requestId).single());
  const request = asRecord(requestResult.data, "friend request");
  if (toStringValue(request.to_player_id) !== player.id) {
    throw new HttpError(403, "Only the recipient can accept this friend request");
  }
  const fromPlayerId = toStringValue(request.from_player_id);
  const first = [player.id, fromPlayerId].sort()[0];
  const second = [player.id, fromPlayerId].sort()[1];
  await checked(context.service.from("friendships").upsert({ player_a_id: first, player_b_id: second }));
  await checked(context.service.from("friend_requests").update({ status: "ACCEPTED", updated_at: new Date().toISOString() }).eq("id", body.requestId));
  return { ok: true };
}

async function blockPlayer(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const player = await loadPlayer(context, user.id);
  const body = blockPlayerSchema.parse(context.body);
  await checked(context.service.from("player_blocks").upsert({ blocker_player_id: player.id, blocked_player_id: body.targetPlayerId }));
  return { ok: true };
}

async function adminBootstrap(context: EdgeContext): Promise<JsonRecord> {
  const admin = await requireAdmin(context);
  const section = typeof context.body.section === "string" ? context.body.section : "me";
  if (section === "me") {
    return { admin };
  }
  if (section === "dashboard") {
    const [players, listings, orders, raids] = await Promise.all([
      countRows(context, "player_profiles"),
      countRows(context, "market_listings"),
      countRows(context, "buy_orders"),
      countRows(context, "raid_history")
    ]);
    return {
      cards: {
        players,
        activeListings: listings,
        openBuyOrders: orders,
        prototypeRaids: raids
      },
      charts: {
        activity: [
          { label: "Players", value: players },
          { label: "Listings", value: listings },
          { label: "Buy Orders", value: orders },
          { label: "Raids", value: raids }
        ]
      }
    };
  }
  if (section === "players") {
    const result = await checked(context.service.from("player_profiles").select("*").order("created_at", { ascending: false }).limit(100));
    const players = rows(result.data).map((row) => adminPlayerRow(row));
    return { players };
  }
  if (section === "economy") {
    const ledger = await checked(context.service.from("economy_ledger").select("*").order("created_at", { ascending: false }).limit(100));
    const balances = await checked(context.service.from("player_balances").select("balance_type, amount"));
    const summary = rows(balances.data).reduce(
      (accumulator, row) => {
        const type = toStringValue(row.balance_type);
        accumulator[type] = (accumulator[type] ?? 0) + toNumber(row.amount);
        return accumulator;
      },
      {} as Record<string, number>
    );
    return { summary, ledger: rows(ledger.data).map(camelRecord), configVersions: [] };
  }
  if (section === "market") {
    const [listings, buyOrders, trades, fills] = await Promise.all([
      checked(context.service.from("market_listings").select("*").order("created_at", { ascending: false }).limit(100)),
      checked(context.service.from("buy_orders").select("*").order("created_at", { ascending: false }).limit(100)),
      checked(context.service.from("market_trades").select("*").order("created_at", { ascending: false }).limit(100)),
      checked(context.service.from("buy_order_fills").select("*").order("created_at", { ascending: false }).limit(100))
    ]);
    return {
      listings: rows(listings.data).map(camelRecord),
      buyOrders: rows(buyOrders.data).map(camelRecord),
      trades: rows(trades.data).map(camelRecord),
      escrow: rows(fills.data).map(camelRecord)
    };
  }
  if (section === "blackjack") {
    const hands = await checked(
      context.service.schema("private").from("blackjack_hands").select("*").order("created_at", { ascending: false }).limit(100)
    );
    const safeHands = rows(hands.data).map(safeHand);
    return {
      totalHands: safeHands.length,
      hands: safeHands,
      counters: [],
      outcomes: safeHands.reduce(
        (accumulator, hand) => {
          const status = toStringValue(hand.status, "UNKNOWN");
          accumulator[status] = (accumulator[status] ?? 0) + 1;
          return accumulator;
        },
        {} as Record<string, number>
      )
    };
  }
  if (section === "raids") {
    const raids = await checked(context.service.from("raid_history").select("*").order("created_at", { ascending: false }).limit(100));
    const lobbies = await checked(context.service.from("raid_lobbies").select("*").order("created_at", { ascending: false }).limit(100));
    return {
      raids: rows(raids.data).map(camelRecord),
      lobbies: rows(lobbies.data).map(camelRecord),
      maps: [
        { id: "tower-1-1", name: "SolBloom Approach", recommendedPower: 500, baseGoldReward: 24 },
        { id: "tower-1-2", name: "Lantern Rise", recommendedPower: 900, baseGoldReward: 32 },
        { id: "tower-1-3", name: "Stormglass Gate", recommendedPower: 1200, baseGoldReward: 44 }
      ],
      heroPickRates: []
    };
  }
  if (section === "content") {
    return { heroes: [], equipment: equipmentDefinitions, consumables: consumableDefinitions, maps: [] };
  }
  if (section === "audit") {
    const audits = await checked(context.service.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(100));
    return { audits: rows(audits.data).map(camelRecord) };
  }
  if (section === "system") {
    return {
      backend: "supabase",
      fastifyAuthoritative: false,
      serviceRoleServerOnly: true,
      devMode: isDevMode(),
      adminHost: "admin.playsoltower.fun"
    };
  }
  return { section, status: "configured", role: admin.role };
}

async function adminEconomyAction(context: EdgeContext): Promise<JsonRecord> {
  const user = requireUser(context);
  const admin = await requireAdmin(context, ["OWNER", "ADMIN", "ECONOMY_MANAGER"]);
  const body = adminEconomySchema.parse(context.body);
  const result = await checked(
    context.service.schema("private").rpc("admin_adjust_balance_for_auth", {
      p_auth_user_id: user.id,
      p_player_id: body.playerId,
      p_balance_type: body.balanceType,
      p_amount: body.amount,
      p_reason: body.reason,
      p_idempotency_key: body.idempotencyKey
    })
  );
  return { ledger: camelRecord(asRecord(result.data, "admin economy ledger")), admin };
}

async function adminPlayerAction(context: EdgeContext): Promise<JsonRecord> {
  const admin = await requireAdmin(context, ["OWNER", "ADMIN", "MODERATOR"]);
  const body = adminPlayerSchema.parse(context.body);
  if (admin.role === "SUPPORT" || (admin.role === "MODERATOR" && body.action === "BAN")) {
    throw new HttpError(403, "Admin role cannot perform this player action");
  }
  const updates: JsonRecord = { updated_at: new Date().toISOString() };
  if (body.action === "BAN") updates.status = "BANNED";
  if (body.action === "UNBAN") updates.status = "ACTIVE";
  if (body.action === "MUTE") updates.status = "MUTED";
  if (body.action === "MARKET_FREEZE") updates.market_frozen = true;
  if (body.action === "BLACKJACK_FREEZE") updates.blackjack_frozen = true;
  if (Object.keys(updates).length > 1) {
    await checked(context.service.from("player_profiles").update(updates).eq("player_id", body.playerId));
  }
  await recordAdminAudit(context, admin, body.action, "player", body.playerId, body.playerId, body.reason);
  return { ok: true };
}

async function adminMarketAction(context: EdgeContext): Promise<JsonRecord> {
  const admin = await requireAdmin(context, ["OWNER", "ADMIN", "ECONOMY_MANAGER", "MODERATOR"]);
  await recordAdminAudit(context, admin, "ADMIN_MARKET_ACTION", "market", "bulk", null, "Admin market action routed through Supabase Edge Function");
  return { ok: true };
}

async function adminConfigAction(context: EdgeContext): Promise<JsonRecord> {
  const admin = await requireAdmin(context, ["OWNER", "ADMIN", "GAME_DESIGNER"]);
  const body = adminConfigSchema.parse(context.body);
  const latest = await checked(
    context.service
      .from("economy_config_versions")
      .select("version")
      .eq("config_key", body.configKey)
      .order("version", { ascending: false })
      .limit(1)
  );
  const version = (rows(latest.data)[0]?.version as number | undefined) ?? 0;
  const result = await checked(
    context.service
      .from("economy_config_versions")
      .insert({
        config_key: body.configKey,
        version: version + 1,
        config: body.config,
        published_by_admin_id: admin.id,
        reason: body.reason
      })
      .select("*")
      .single()
  );
  await recordAdminAudit(context, admin, "ADMIN_CONFIG_ACTION", "config", body.configKey, null, body.reason);
  return { configVersion: camelRecord(asRecord(result.data, "config version")) };
}

async function loadPlayerBootstrap(context: EdgeContext, authUserId: string): Promise<JsonRecord> {
  const player = await loadPlayer(context, authUserId);
  const [balances, wallet, unlocks, presenceResult] = await Promise.all([
    loadBalances(context, player.id),
    loadWallet(context, player.id),
    loadUnlockedMaps(context, player.id),
    checked(
      context.service
        .from("player_presence")
        .select("world_x,world_y,facing_x,facing_y")
        .eq("player_id", player.id)
        .maybeSingle()
    )
  ]);
  const presence = presenceResult.data ? asRecord(presenceResult.data, "player presence") : {};
  await assertWalletTowerBalance(
    wallet.full,
    economyConfig.tokenGate.playMinimumTower,
    "Entering SolBloom Village"
  );
  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      walletPublicKey: wallet.full,
      walletLinkedAt: wallet.linkedAt,
      accountLevel: player.accountLevel,
      xp: player.xp,
      avatar: player.avatar,
      power: player.power,
      status: player.status,
      marketFrozen: player.marketFrozen,
      blackjackFrozen: player.blackjackFrozen,
      unlockedMaps: unlocks,
      balances
    },
    profile: {
      fullWalletAddress: wallet.full,
      shortenedWalletAddress: wallet.short,
      accountLevel: player.accountLevel,
      xp: player.xp,
      selectedHero: player.selectedHeroId,
      power: player.power,
      balances,
      unlockedMaps: unlocks,
      marketSellCapacityToday: getDailySellCapacity(player.accountLevel),
      blackjackTableTier: getBlackjackTableLimit(player.accountLevel)
    },
    selectedHeroId: player.selectedHeroId,
    unlockedMapCount: unlocks.length,
    townPosition: {
      x: toNumber(presence.world_x, 627),
      y: toNumber(presence.world_y, 776),
      facingX: toNumber(presence.facing_x, 0),
      facingY: toNumber(presence.facing_y, 1)
    },
    blackjack: {
      earnedProfitCap: getBlackjackEarnedProfitCap(player.accountLevel),
      earnedLimits: getBlackjackLimits(player.accountLevel, balances.EARNED_GOLD),
      lockedLimits: getBlackjackLimits(player.accountLevel, balances.LOCKED_GOLD)
    }
  };
}

async function loadBlackjackState(context: EdgeContext, authUserId: string): Promise<JsonRecord> {
  const player = await loadPlayer(context, authUserId);
  const balances = await loadBalances(context, player.id);
  const counters = await checked(
    context.service.from("blackjack_counters").select("*").eq("player_id", player.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle()
  );
  const hands = await checked(
    context.service
      .schema("private")
      .from("blackjack_hands")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(20)
  );
  return {
    practiceAllowed: isDevMode(),
    limits: getBlackjackLimits(player.accountLevel, balances.EARNED_GOLD),
    profitCap: getBlackjackEarnedProfitCap(player.accountLevel),
    profitProgress: counters.data ? toNumber(asRecord(counters.data, "blackjack counter").earned_profit) : 0,
    history: rows(hands.data).map(safeHand)
  };
}

async function loadPlayer(context: EdgeContext, authUserId: string): Promise<{
  id: string;
  displayName: string;
  avatar: string;
  accountLevel: number;
  xp: number;
  power: number;
  status: string;
  marketFrozen: boolean;
  blackjackFrozen: boolean;
  selectedHeroId: string;
}> {
  const profile = await maybePlayerProfile(context, authUserId);
  if (!profile) {
    throw new HttpError(401, "Player profile required");
  }
  return {
    id: toStringValue(profile.player_id),
    displayName: toStringValue(profile.display_name),
    avatar: toStringValue(profile.avatar, "G"),
    accountLevel: toNumber(profile.account_level, 1),
    xp: toNumber(profile.xp),
    power: toNumber(profile.power),
    status: toStringValue(profile.status, "ACTIVE"),
    marketFrozen: toBoolean(profile.market_frozen),
    blackjackFrozen: toBoolean(profile.blackjack_frozen),
    selectedHeroId: toStringValue(profile.selected_hero_id, "storm-archer")
  };
}

async function maybePlayerProfile(context: EdgeContext, authUserId: string): Promise<JsonRecord | null> {
  const result = await checked(context.service.from("player_profiles").select("*").eq("auth_user_id", authUserId).maybeSingle());
  return result.data ? asRecord(result.data, "player profile") : null;
}

async function loadBalances(context: EdgeContext, playerId: string): Promise<Record<BalanceType, number>> {
  const result = await checked(context.service.from("player_balances").select("*").eq("player_id", playerId));
  const balances: Record<BalanceType, number> = {
    EARNED_GOLD: 0,
    LOCKED_GOLD: 0,
    TEST_TOKEN: 0
  };
  for (const row of rows(result.data)) {
    const type = toStringValue(row.balance_type) as BalanceType;
    if (type in balances) {
      balances[type] = toNumber(row.amount);
    }
  }
  return balances;
}

async function assertGoldSellerRequirements(context: EdgeContext, authUserId: string): Promise<void> {
  const player = await loadPlayer(context, authUserId);
  if (player.accountLevel < economyConfig.tokenGate.sellerMinimumAccountLevel) {
    throw new HttpError(
      403,
      `Selling Gold requires account level ${economyConfig.tokenGate.sellerMinimumAccountLevel}`
    );
  }
  if (isDevMode()) {
    return;
  }
  const wallet = await loadWallet(context, player.id);
  await assertWalletTowerBalance(
    wallet.full,
    economyConfig.tokenGate.sellerMinimumTower,
    "Selling Gold"
  );
}

async function loadWallet(context: EdgeContext, playerId: string): Promise<{ full: string | null; short: string | null; linkedAt: string | null }> {
  const result = await checked(context.service.from("wallet_public_keys").select("*").eq("player_id", playerId).limit(1).maybeSingle());
  if (!result.data) {
    return { full: null, short: null, linkedAt: null };
  }
  const row = asRecord(result.data, "wallet");
  const full = toStringValue(row.public_key);
  return {
    full,
    short: `${full.slice(0, 4)}...${full.slice(-4)}`,
    linkedAt: toStringValue(row.linked_at)
  };
}

async function assertWalletTowerBalance(
  walletPublicKey: string | null,
  minimumTower: number,
  actionLabel: string
): Promise<void> {
  if (isDevMode()) {
    return;
  }
  if (!walletPublicKey) {
    throw new HttpError(
      403,
      `${actionLabel} requires a linked wallet with at least ${formatTowerAmount(minimumTower)} ${economyConfig.towerToken.symbol}`,
      "tower_token_gate"
    );
  }
  const balance = await loadWalletTowerBalance(walletPublicKey);
  if (balance < minimumTower) {
    throw new HttpError(
      403,
      `${actionLabel} requires ${formatTowerAmount(minimumTower)} ${economyConfig.towerToken.symbol}`,
      "tower_token_gate"
    );
  }
}

async function loadWalletTowerBalance(walletPublicKey: string): Promise<number> {
  const rpcUrl = optionalEnv("SOLANA_RPC_URL") ?? DEFAULT_SOLANA_RPC_URL;
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "soltower-token-gate",
        method: "getTokenAccountsByOwner",
        params: [
          walletPublicKey,
          { mint: economyConfig.towerToken.temporaryMint },
          { encoding: "jsonParsed" }
        ]
      })
    });
  } catch {
    throw new HttpError(
      503,
      `${economyConfig.towerToken.symbol} wallet check is temporarily unavailable`,
      "tower_token_check_unavailable"
    );
  }
  if (!response.ok) {
    throw new HttpError(
      503,
      `${economyConfig.towerToken.symbol} wallet check is temporarily unavailable`,
      "tower_token_check_unavailable"
    );
  }
  const payload = await response.json();
  if (!isRecord(payload) || isRecord(payload.error)) {
    throw new HttpError(
      503,
      `${economyConfig.towerToken.symbol} wallet check is temporarily unavailable`,
      "tower_token_check_unavailable"
    );
  }
  const result = isRecord(payload.result) ? payload.result : {};
  const accounts = Array.isArray(result.value) ? result.value : [];
  return accounts.reduce((total, account) => total + tokenAccountUiAmount(account), 0);
}

function tokenAccountUiAmount(account: unknown): number {
  const parsedAccount = isRecord(account) ? account : {};
  const accountData = isRecord(parsedAccount.account) ? parsedAccount.account : {};
  const data = isRecord(accountData.data) ? accountData.data : {};
  const parsed = isRecord(data.parsed) ? data.parsed : {};
  const info = isRecord(parsed.info) ? parsed.info : {};
  const tokenAmount = isRecord(info.tokenAmount) ? info.tokenAmount : {};
  const uiAmount = tokenAmount.uiAmount;
  if (typeof uiAmount === "number" && Number.isFinite(uiAmount)) {
    return uiAmount;
  }
  const uiAmountString = toStringValue(tokenAmount.uiAmountString);
  const parsedUiAmount = Number(uiAmountString);
  if (Number.isFinite(parsedUiAmount)) {
    return parsedUiAmount;
  }
  let rawAmount = 0n;
  try {
    rawAmount = BigInt(toStringValue(tokenAmount.amount, "0") || "0");
  } catch {
    rawAmount = 0n;
  }
  const decimals = toNumber(tokenAmount.decimals);
  return Number(rawAmount) / 10 ** decimals;
}

function formatTowerAmount(amount: number): string {
  return amount.toLocaleString("en-US");
}

async function loadUnlockedMaps(context: EdgeContext, playerId: string): Promise<string[]> {
  const result = await checked(context.service.from("player_map_unlocks").select("map_id").eq("player_id", playerId));
  return rows(result.data).map((row) => toStringValue(row.map_id)).filter(Boolean);
}

async function assertRaidStageAccess(
  context: EdgeContext,
  player: { id: string; accountLevel: number },
  mapId: string
): Promise<void> {
  const requirement = raidStageRequirement(mapId);
  if (player.accountLevel < requirement.requiredAccountLevel) {
    throw new HttpError(
      403,
      requirement.previousStageLabel
        ? `Requires Account Level ${requirement.requiredAccountLevel} and completion of ${requirement.previousStageLabel}.`
        : `Requires Account Level ${requirement.requiredAccountLevel}.`
    );
  }

  if (requirement.previousStageId) {
    const unlockedMaps = await loadUnlockedMaps(context, player.id);
    if (!unlockedMaps.includes(requirement.previousStageId)) {
      throw new HttpError(403, `Requires completion of ${requirement.previousStageLabel ?? requirement.previousStageId}.`);
    }
  }

  if (!activeRaidStageIds.has(mapId)) {
    throw new HttpError(403, `Map ${requirement.mapNumber} is locked for a later content update.`);
  }
}

async function loadOpenLobbyMembership(
  context: EdgeContext,
  playerId: string,
  excludeLobbyId?: string
): Promise<{ lobbyId: string; host: boolean } | null> {
  const membershipsResult = await checked(
    context.service.from("raid_lobby_members").select("lobby_id,host").eq("player_id", playerId)
  );
  const memberships = rows(membershipsResult.data).filter((membership) => {
    const lobbyId = toStringValue(membership.lobby_id);
    return lobbyId && lobbyId !== excludeLobbyId;
  });
  if (memberships.length === 0) {
    return null;
  }

  const lobbyIds = memberships.map((membership) => toStringValue(membership.lobby_id)).filter(Boolean);
  const lobbiesResult = await checked(
    context.service.from("raid_lobbies").select("id,status").in("id", lobbyIds).eq("status", "OPEN").limit(1)
  );
  const lobby = rows(lobbiesResult.data)[0];
  if (!lobby) {
    return null;
  }

  const lobbyId = toStringValue(lobby.id);
  const membership = memberships.find((entry) => toStringValue(entry.lobby_id) === lobbyId);
  return {
    lobbyId,
    host: toBoolean(membership?.host)
  };
}

async function expireStaleRaidLobbies(context: EdgeContext): Promise<void> {
  const staleResult = await checked(
    context.service
      .from("raid_lobbies")
      .select("id,created_at")
      .eq("status", "OPEN")
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(50)
  );
  const staleLobbyIds = rows(staleResult.data).map((lobby) => toStringValue(lobby.id)).filter(Boolean);
  if (staleLobbyIds.length === 0) {
    return;
  }
  await checked(context.service.from("raid_lobbies").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).in("id", staleLobbyIds));
  await checked(context.service.from("raid_lobby_members").delete().in("lobby_id", staleLobbyIds));
}

async function expireRaidLobby(context: EdgeContext, lobbyId: string): Promise<void> {
  await checked(context.service.from("raid_lobbies").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", lobbyId).eq("status", "OPEN"));
  await checked(context.service.from("raid_lobby_members").delete().eq("lobby_id", lobbyId));
}

function isExpiredLobby(lobby: JsonRecord): boolean {
  const createdAt = Date.parse(toStringValue(lobby.created_at));
  return Number.isFinite(createdAt) && Date.now() - createdAt >= 60 * 60 * 1000;
}

async function loadLobby(context: EdgeContext, lobbyId: string): Promise<JsonRecord> {
  const lobbyResult = await checked(context.service.from("raid_lobbies").select("*").eq("id", lobbyId).single());
  const membersResult = await checked(context.service.from("raid_lobby_members").select("*").eq("lobby_id", lobbyId));
  const memberRows = rows(membersResult.data);
  const memberPlayerIds = [...new Set(memberRows.map((row) => toStringValue(row.player_id)).filter(Boolean))];
  const profilesResult = memberPlayerIds.length
    ? await checked(
        context.service
          .from("player_profiles")
          .select("player_id,display_name,account_level,power,selected_hero_id")
          .in("player_id", memberPlayerIds)
      )
    : { data: [] };
  const profileByPlayerId = new Map(rows(profilesResult.data).map((profile) => [toStringValue(profile.player_id), profile]));
  return {
    ...camelRecord(asRecord(lobbyResult.data, "lobby")),
    members: memberRows.map((row) => {
      const playerId = toStringValue(row.player_id);
      const profile = profileByPlayerId.get(playerId);
      return {
        playerId,
        displayName: safeLobbyDisplayName(profile?.display_name),
        heroId: toStringValue(row.hero_id) || toStringValue(profile?.selected_hero_id) || "storm-archer",
        accountLevel: toNumber(row.account_level ?? profile?.account_level),
        power: toNumber(row.power ?? profile?.power),
        ready: toBoolean(row.ready),
        host: toBoolean(row.host)
      };
    })
  };
}

function safeLobbyDisplayName(value: unknown): string {
  const displayName = toStringValue(value);
  if (!displayName || /^player[-_]/i.test(displayName)) {
    return "Unknown Guardian";
  }
  return displayName;
}

async function applyBalance(
  context: EdgeContext,
  input: {
    playerId: string;
    balanceType: BalanceType;
    sourceType: string;
    direction: "CREDIT" | "DEBIT";
    amount: number;
    reason: string;
    idempotencyKey: string;
    referenceEntityType?: string;
    referenceEntityId?: string;
    metadata?: JsonRecord;
  }
): Promise<JsonRecord> {
  const result = await checked(
    context.service.schema("private").rpc("apply_balance_delta", {
      p_player_id: input.playerId,
      p_balance_type: input.balanceType,
      p_source_type: input.sourceType,
      p_direction: input.direction,
      p_amount: input.amount,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_reference_entity_type: input.referenceEntityType ?? null,
      p_reference_entity_id: input.referenceEntityId ?? null,
      p_metadata: input.metadata ?? {},
      p_created_by_admin_id: null
    })
  );
  return asRecord(result.data, "ledger");
}

async function settleBlackjackLedger(
  context: EdgeContext,
  input: {
    playerId: string;
    accountLevel: number;
    balanceType: "EARNED_GOLD" | "LOCKED_GOLD";
    totalWager: number;
    status: string;
    idempotencyKey: string;
    handId: string;
  }
): Promise<void> {
  if (input.status === "PUSH") {
    await applyBalance(context, {
      playerId: input.playerId,
      balanceType: input.balanceType,
      sourceType: "BLACKJACK_PUSH",
      direction: "CREDIT",
      amount: input.totalWager,
      reason: "Blackjack push returns wager",
      idempotencyKey: `${input.idempotencyKey}:push`,
      referenceEntityType: "blackjack_hand",
      referenceEntityId: input.handId
    });
    return;
  }
  if (input.status !== "WON") {
    return;
  }
  if (input.balanceType === "LOCKED_GOLD") {
    await applyBalance(context, {
      playerId: input.playerId,
      balanceType: "LOCKED_GOLD",
      sourceType: "BLACKJACK_WIN",
      direction: "CREDIT",
      amount: input.totalWager * 2,
      reason: "Blackjack Locked Gold win",
      idempotencyKey: `${input.idempotencyKey}:locked-payout`,
      referenceEntityType: "blackjack_hand",
      referenceEntityId: input.handId
    });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const counter = await checked(
    context.service.from("blackjack_counters").select("*").eq("player_id", input.playerId).eq("day", today).maybeSingle()
  );
  const currentProfit = counter.data ? toNumber(asRecord(counter.data, "blackjack counter").earned_profit) : 0;
  const cap = getBlackjackEarnedProfitCap(input.accountLevel);
  const earnedProfit = Math.max(0, Math.min(input.totalWager, cap - currentProfit));
  const lockedProfit = input.totalWager - earnedProfit;

  await applyBalance(context, {
    playerId: input.playerId,
    balanceType: "EARNED_GOLD",
    sourceType: "BLACKJACK_WIN",
    direction: "CREDIT",
    amount: input.totalWager + earnedProfit,
    reason: "Blackjack Earned Gold win within daily profit cap",
    idempotencyKey: `${input.idempotencyKey}:earned-payout`,
    referenceEntityType: "blackjack_hand",
    referenceEntityId: input.handId
  });

  if (lockedProfit > 0) {
    await applyBalance(context, {
      playerId: input.playerId,
      balanceType: "LOCKED_GOLD",
      sourceType: "BLACKJACK_WIN",
      direction: "CREDIT",
      amount: lockedProfit,
      reason: "Blackjack profit over Earned cap becomes Locked Gold",
      idempotencyKey: `${input.idempotencyKey}:locked-over-cap`,
      referenceEntityType: "blackjack_hand",
      referenceEntityId: input.handId
    });
  }

  await checked(
    context.service.from("blackjack_counters").upsert({
      player_id: input.playerId,
      day: today,
      earned_profit: currentProfit + earnedProfit,
      hands_played: counter.data ? toNumber(asRecord(counter.data, "blackjack counter").hands_played) + 1 : 1,
      updated_at: new Date().toISOString()
    })
  );
}

async function requireAdmin(context: EdgeContext, allowedRoles?: AdminRole[]): Promise<{
  id: string;
  email: string;
  role: AdminRole;
  displayName: string;
}> {
  const user = requireUser(context);
  const result = await checked(
    context.service.from("admin_users").select("*").eq("auth_user_id", user.id).eq("active", true).maybeSingle()
  );
  if (!result.data) {
    throw new HttpError(403, "Admin account required");
  }
  const row = asRecord(result.data, "admin user");
  const role = toStringValue(row.role) as AdminRole;
  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new HttpError(403, "Admin role is not allowed for this action");
  }
  return {
    id: toStringValue(row.id),
    email: toStringValue(row.email),
    role,
    displayName: toStringValue(row.display_name)
  };
}

async function recordAdminAudit(
  context: EdgeContext,
  admin: { id: string; role: AdminRole },
  actionType: string,
  targetEntityType: string,
  targetEntityId: string,
  targetPlayerId: string | null,
  reason: string
): Promise<void> {
  await checked(
    context.service.from("admin_audit_logs").insert({
      actor_admin_id: admin.id,
      actor_role: admin.role,
      action_type: actionType,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
      target_player_id: targetPlayerId,
      reason,
      correlation_id: crypto.randomUUID(),
      module: "supabase-edge"
    })
  );
}

async function countRows(context: EdgeContext, table: string): Promise<number> {
  const result = await checked(context.service.from(table).select("*", { count: "exact", head: true }));
  return result.count ?? 0;
}

function walletAuthError(code: WalletAuthFailureCode, status = 400): HttpError {
  return new HttpError(status, walletAuthFailureMessages[code], code);
}

async function failWalletVerification(
  code: WalletAuthFailureCode,
  diagnostic: JsonRecord,
  storedMessage?: string,
  submittedMessage?: string
): Promise<never> {
  const developmentHashes =
    isDevMode() && storedMessage !== undefined && submittedMessage !== undefined
      ? {
          storedMessageSha256: await sha256(storedMessage),
          submittedMessageSha256: await sha256(submittedMessage)
        }
      : {};
  console.error(JSON.stringify({ ...diagnostic, ...developmentHashes, result: code }));
  throw walletAuthError(code);
}

function safeDiagnosticString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function maskDiagnosticValue(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (value.length <= 10) {
    return `${value.slice(0, 2)}...`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64Bytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytesToBase64(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function challengeMessageField(message: string, label: string): string {
  const prefix = `${label}: `;
  return message
    .split("\n")
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length) ?? "";
}

function isValidWalletSignature(
  publicKeyBytes: Uint8Array,
  signature: Uint8Array,
  messageBytes: Uint8Array,
  provider: string,
  publicKey: string
): boolean {
  if (
    publicKey.startsWith("DevMock") &&
    provider === "DEV Mock Wallet" &&
    isDevMode()
  ) {
    return true;
  }
  try {
    return (
      publicKeyBytes.byteLength === nacl.sign.publicKeyLength &&
      nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes)
    );
  } catch {
    return false;
  }
}

function decodePublicKeyBytes(value: string): Uint8Array | null {
  try {
    return bs58.decode(value);
  } catch {
    return null;
  }
}

function settleBlackjack(playerCards: Card[], dealerCardsInput: Card[]): { status: string; metadata: JsonRecord; dealerCards: Card[] } {
  const dealerCards = [...dealerCardsInput];
  while (handTotal(dealerCards) < 17) {
    dealerCards.push(drawCards(1)[0]);
  }
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);
  if (playerTotal > 21) return { status: "LOST", metadata: { result: "PLAYER_BUST" }, dealerCards };
  if (dealerTotal > 21) return { status: "WON", metadata: { result: "DEALER_BUST" }, dealerCards };
  if (playerTotal > dealerTotal) return { status: "WON", metadata: { result: "PLAYER_HIGH" }, dealerCards };
  if (playerTotal < dealerTotal) return { status: "LOST", metadata: { result: "DEALER_HIGH" }, dealerCards };
  return { status: "PUSH", metadata: { result: "PUSH" }, dealerCards };
}

function drawCards(count: number): Card[] {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["S", "H", "D", "C"];
  return Array.from({ length: count }, () => ({
    rank: ranks[crypto.getRandomValues(new Uint32Array(1))[0] % ranks.length],
    suit: suits[crypto.getRandomValues(new Uint32Array(1))[0] % suits.length]
  }));
}

function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function cardArray(value: unknown): Card[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((entry) => ({
    rank: toStringValue(entry.rank),
    suit: toStringValue(entry.suit)
  }));
}

function safeHand(row: JsonRecord): JsonRecord {
  return {
    id: toStringValue(row.id),
    playerId: toStringValue(row.player_id),
    balanceType: toStringValue(row.balance_type),
    bet: toNumber(row.bet),
    totalWager: toNumber(row.total_wager),
    practiceMode: toBoolean(row.practice_mode),
    status: toStringValue(row.status),
    playerCards: cardArray(row.player_cards),
    dealerCards: toStringValue(row.status) === "ACTIVE" ? [cardArray(row.dealer_cards)[0]].filter(Boolean) : cardArray(row.dealer_cards),
    shoeSeedHash: toStringValue(row.shoe_seed_hash),
    resultMetadata: isRecord(row.result_metadata) ? row.result_metadata : {},
    createdAt: toStringValue(row.created_at)
  };
}

function inventoryItem(row: JsonRecord): JsonRecord {
  const definition = equipmentDefinitions.find((entry) => entry.id === toStringValue(row.definition_id));
  return {
    id: toStringValue(row.id),
    definitionId: toStringValue(row.definition_id),
    name: definition?.name ?? toStringValue(row.definition_id),
    rarity: definition?.rarity ?? "COMMON",
    slot: definition?.slot ?? "WEAPON",
    equippedSlot: row.equipped_slot === null ? null : toStringValue(row.equipped_slot),
    level: 1
  };
}

function adminPlayerRow(row: JsonRecord): JsonRecord {
  return {
    id: toStringValue(row.player_id),
    displayName: toStringValue(row.display_name),
    walletPublicKey: null,
    walletLinkedAt: null,
    accountLevel: toNumber(row.account_level),
    avatar: toStringValue(row.avatar),
    power: toNumber(row.power),
    status: toStringValue(row.status),
    marketFrozen: toBoolean(row.market_frozen),
    blackjackFrozen: toBoolean(row.blackjack_frozen),
    unlockedMaps: [],
    balances: { EARNED_GOLD: 0, LOCKED_GOLD: 0, TEST_TOKEN: 0 },
    presenceStatus: "Supabase",
    sessionStatus: "Auth",
    walletRiskFlag: "none"
  };
}

function camelRecord(row: JsonRecord): JsonRecord {
  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    output[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return output;
}

function rows(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function nullableRecord(value: unknown, message: string): JsonRecord {
  if (!value) {
    throw new HttpError(404, message);
  }
  return asRecord(value, message);
}

async function checked<T extends { error: { message: string } | null; data?: unknown; count?: number }>(result: PromiseLike<T> | T): Promise<T> {
  const resolved = await result;
  if (resolved.error) {
    throw new HttpError(400, resolved.error.message);
  }
  return resolved;
}

async function hashText(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
