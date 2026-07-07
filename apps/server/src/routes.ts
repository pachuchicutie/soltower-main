import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodSchema } from "zod";
import {
  adminConfigPublishSchema,
  adminDevAdjustmentSchema,
  adminLoginSchema,
  adminModerationSchema,
  blackjackActionSchema,
  blackjackDealSchema,
  buyMarketListingSchema,
  cancelBuyOrderSchema,
  chatMessageSchema,
  createBuyOrderSchema,
  createLobbySchema,
  createMarketListingSchema,
  devLoginSchema,
  displayNameAvailabilitySchema,
  equipItemSchema,
  fillBuyOrderSchema,
  getBlackjackEarnedProfitCap,
  getBlackjackLimits,
  npcDefinitions,
  walletNonceRequestSchema,
  walletVerifySchema
} from "@soltower/shared";
import { heroDefinitions, mapDefinitions, prototypeWaves } from "@soltower/game-engine";
import { type AdminUserRecord, type DevStore, makeId, nowIso, publicContent } from "./data/store";
import {
  createDevPlayer,
  getLedgerForPlayer,
  getPlayerProfileSummary,
  getPlayerOrThrow,
  getPublicPlayer,
  summarizeEconomy
} from "./services/economy";
import {
  buyMarketListing,
  cancelBuyOrder,
  createBuyOrder,
  createMarketListing,
  fillBuyOrder,
  listActiveMarketListings,
  listOpenBuyOrders
} from "./services/market";
import { actOnBlackjackHand, dealBlackjackHand, getBlackjackState } from "./services/blackjack";
import { buyBoundShopItem, equipItem, getInventory } from "./services/inventory";
import { createLobby, joinLobby, runPrototypeRaid, setLobbyReady } from "./services/raid";
import {
  adminCancelBuyOrder,
  authenticateAdmin,
  devAdjustBalance,
  moderatePlayer,
  publishConfig,
  recordAudit,
  requirePermission
} from "./services/admin";
import {
  authenticateWallet,
  createWalletNonce,
  isDisplayNameAvailable,
  makeWalletAuthResponse
} from "./services/walletAuth";

const paramsIdSchema = z.object({ id: z.string().min(2) });
const shopBuySchema = z.object({
  definitionId: z.string().min(2),
  idempotencyKey: z.string().min(8)
});
const raidRunSchema = z.object({
  idempotencyKey: z.string().min(8),
  mapId: z.string().min(3).default("tower-1-1")
});

function parseBody<T>(schema: ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}

function sendError(reply: FastifyReply, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  reply.status(400).send({ error: message });
}

function getPlayerId(request: FastifyRequest, store: DevStore): string {
  const sessionId = request.cookies.soltower_player;
  const playerId = sessionId ? store.playerSessions.get(sessionId) : null;
  if (!playerId) {
    throw new Error("Player is not logged in");
  }
  return playerId;
}

function getAdmin(request: FastifyRequest, store: DevStore): AdminUserRecord {
  const sessionId = request.cookies.soltower_admin;
  const adminId = sessionId ? store.adminSessions.get(sessionId) : null;
  const admin = adminId ? store.admins.get(adminId) : null;
  if (!admin || !admin.active) {
    throw new Error("Admin is not logged in");
  }
  return admin;
}

function setSessionCookie(reply: FastifyReply, name: string, value: string): void {
  reply.setCookie(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function registerRoutes(app: FastifyInstance, store: DevStore): void {
  app.get("/health", async () => ({
    ok: true,
    devMode: store.devMode,
    websocketConnections: 0,
    database: process.env.SUPABASE_URL ? "supabase-postgres-configured" : "dev-store-supabase-fallback",
    supabase: {
      configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      serviceRoleAvailable: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    },
    version: "0.1.0"
  }));

  app.get("/api/public/stats", async () => ({
    devMode: store.devMode,
    onlinePlayers: store.playerSessions.size,
    spectators: store.spectatorCount,
    testWorldActive: store.devMode,
    labels: store.devMode
      ? [`DEV: ${Math.max(1, store.playerSessions.size)} player online`, "DEV: Test world active"]
      : []
  }));

  app.post("/api/spectate/start", async () => {
    store.spectatorCount += 1;
    return { spectators: store.spectatorCount };
  });

  app.post("/api/spectate/end", async () => {
    store.spectatorCount = Math.max(0, store.spectatorCount - 1);
    return { spectators: store.spectatorCount };
  });

  app.post("/api/auth/dev-login", async (request, reply) => {
    try {
      const body = parseBody(devLoginSchema, request.body);
      const player =
        body.displayName.toLowerCase() === "marky"
          ? getPublicPlayer(store, "player-marky")
          : createDevPlayer(store, body.displayName);
      const sessionId = makeId("psession");
      store.playerSessions.set(sessionId, player.id);
      const record = store.players.get(player.id);
      if (record) {
        record.sessionStatus = "ONLINE";
        record.presenceStatus = "IN_TOWN";
      }
      setSessionCookie(reply, "soltower_player", sessionId);
      return { player, starterLockedGold: 50 };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const sessionId = request.cookies.soltower_player;
    if (sessionId) {
      const playerId = store.playerSessions.get(sessionId);
      const player = playerId ? store.players.get(playerId) : null;
      if (player) {
        player.sessionStatus = "OFFLINE";
        player.presenceStatus = "OFFLINE";
      }
      store.playerSessions.delete(sessionId);
    }
    reply.clearCookie("soltower_player", { path: "/" });
    return { ok: true };
  });

  app.post(
    "/api/auth/wallet/nonce",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const body = parseBody(walletNonceRequestSchema, request.body);
        const nonce = createWalletNonce(store, body.publicKey);
        return {
          publicKey: body.publicKey,
          nonce: nonce.nonce,
          message: nonce.message,
          expiresAt: nonce.expiresAt
        };
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    "/api/auth/wallet/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const body = parseBody(walletVerifySchema, request.body);
        const { playerId, isNewPlayer } = authenticateWallet(store, body);
        const sessionId = makeId("psession");
        store.playerSessions.set(sessionId, playerId);
        setSessionCookie(reply, "soltower_player", sessionId);
        return makeWalletAuthResponse(store, playerId, isNewPlayer);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post("/api/auth/wallet/display-name", async (request, reply) => {
    try {
      const body = parseBody(displayNameAvailabilitySchema, request.body);
      return { available: isDisplayNameAvailable(store, body.displayName) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/player/me", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const player = getPlayerOrThrow(store, playerId);
      return {
        player: getPublicPlayer(store, playerId),
        profile: getPlayerProfileSummary(store, playerId),
        selectedHeroId: player.selectedHeroId,
        blackjack: {
          earnedProfitCap: getBlackjackEarnedProfitCap(player.accountLevel),
          earnedLimits: getBlackjackLimits(player.accountLevel, player.balances.EARNED_GOLD),
          lockedLimits: getBlackjackLimits(player.accountLevel, player.balances.LOCKED_GOLD)
        }
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/player/ledger", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      return { ledger: getLedgerForPlayer(store, playerId).slice(-100).reverse() };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/content", async () => ({
    heroes: heroDefinitions,
    maps: mapDefinitions,
    waves: prototypeWaves,
    npcs: npcDefinitions,
    ...publicContent
  }));

  app.get("/api/inventory", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      return getInventory(store, playerId);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/inventory/equip", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(equipItemSchema, request.body);
      return { item: equipItem(store, playerId, body.equipmentId) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/blacksmith/buy", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(shopBuySchema, request.body);
      return { item: buyBoundShopItem(store, playerId, body.definitionId, body.idempotencyKey) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/market/listings", async () => ({
    listings: listActiveMarketListings(store),
    history: store.marketTrades.slice(-20).reverse()
  }));

  app.post("/api/market/listings", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(createMarketListingSchema, request.body);
      return { listing: createMarketListing(store, playerId, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/market/listings/:id/buy", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = parseBody(buyMarketListingSchema, request.body);
      return { trade: buyMarketListing(store, playerId, params.id, body.idempotencyKey) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/market/buy-orders", async () => ({
    buyOrders: listOpenBuyOrders(store),
    fills: store.buyOrderFills.slice(-20).reverse()
  }));

  app.post("/api/market/buy-orders", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(createBuyOrderSchema, request.body);
      return { buyOrder: createBuyOrder(store, playerId, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/market/buy-orders/:id/fill", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = parseBody(fillBuyOrderSchema, request.body);
      return { fill: fillBuyOrder(store, playerId, params.id, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/market/buy-orders/:id/cancel", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = parseBody(cancelBuyOrderSchema, request.body);
      return { buyOrder: cancelBuyOrder(store, playerId, params.id, body.reason, body.idempotencyKey) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/market/history", async () => ({
    trades: store.marketTrades.slice(-100).reverse()
  }));

  app.get("/api/blackjack", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      return getBlackjackState(store, playerId);
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/blackjack/deal", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(blackjackDealSchema, request.body);
      return { hand: dealBlackjackHand(store, playerId, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/blackjack/:id/action", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = parseBody(blackjackActionSchema, request.body);
      return { hand: actOnBlackjackHand(store, playerId, params.id, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/friends", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      return {
        friends: store.friends
          .filter((friend) => friend.playerId === playerId)
          .map((friend) => ({ ...friend, player: getPublicPlayer(store, friend.friendPlayerId) }))
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/chat/recent", async () => ({
    messages: store.chat.slice(-40)
  }));

  app.post("/api/chat/message", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(chatMessageSchema, request.body);
      const message = {
        id: makeId("chat"),
        channel: body.channel,
        fromPlayerId: playerId,
        targetPlayerId: body.targetPlayerId ?? null,
        message: body.message.replace(/\s+/g, " ").trim(),
        moderationState: "VISIBLE" as const,
        createdAt: nowIso()
      };
      store.chat.push(message);
      return { message };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/lobbies", async () => ({
    lobbies: Array.from(store.lobbies.values()).filter((lobby) => lobby.status === "OPEN")
  }));

  app.post("/api/lobbies", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(createLobbySchema, request.body);
      return { lobby: createLobby(store, playerId, body) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/lobbies/:id/join", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      return { lobby: joinLobby(store, playerId, params.id) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/lobbies/:id/ready", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = z.object({ ready: z.boolean() }).parse(request.body);
      return { lobby: setLobbyReady(store, playerId, params.id, body.ready) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/raids/prototype/run", async (request, reply) => {
    try {
      const playerId = getPlayerId(request, store);
      const body = parseBody(raidRunSchema, request.body);
      const player = getPlayerOrThrow(store, playerId);
      const raid = runPrototypeRaid(
        store,
        [
          {
            playerId,
            damage: 980 + player.power,
            bossDamage: 320,
            slowValue: 40,
            debuffValue: 30,
            shieldValue: 20,
            buffValue: 15,
            activeSkillUses: 2,
            objectiveParticipation: 4,
            secondsInactive: 0
          }
        ],
        { idempotencyKey: body.idempotencyKey, mapId: body.mapId }
      );
      return { raid, player: getPublicPlayer(store, playerId) };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/admin/auth/login", async (request, reply) => {
    try {
      const body = parseBody(adminLoginSchema, request.body);
      const admin = await authenticateAdmin(store, body.email, body.password);
      const sessionId = makeId("asession");
      store.adminSessions.set(sessionId, admin.id);
      setSessionCookie(reply, "soltower_admin", sessionId);
      return { admin: { id: admin.id, email: admin.email, role: admin.role, displayName: admin.displayName } };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/me", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      return { admin: { id: admin.id, email: admin.email, role: admin.role, displayName: admin.displayName } };
    } catch (error) {
      reply.status(401).send({ error: error instanceof Error ? error.message : "Unauthorized" });
    }
  });

  app.get("/api/admin/dashboard", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "dashboard:view");
      const economy = summarizeEconomy(store);
      return {
        cards: {
          totalPlayers: store.players.size - 1,
          activePlayersToday: store.players.size - 1,
          playersOnlineNow: store.playerSessions.size,
          newPlayersToday: 1,
          totalEarnedGold: economy.earnedGold,
          totalLockedGold: economy.lockedGold,
          totalTestToken: economy.testToken,
          registeredWalletAccounts: Array.from(store.players.values()).filter((player) => player.walletPublicKey).length,
          authenticatedPlayersToday: store.playerSessions.size,
          townSpectatorsNow: store.spectatorCount,
          playerMarketActivity: store.marketTrades.length,
          activeLobbies: Array.from(store.lobbies.values()).filter((lobby) => lobby.status === "OPEN").length,
          currentRaids: store.raids.filter((raid) => raid.success).length,
          marketVolumeToday: store.marketTrades.reduce((sum, trade) => sum + trade.grossTestToken, 0),
          taxCollectedToday: store.marketTrades.reduce((sum, trade) => sum + trade.taxTestToken, 0),
          openBuyOrderEscrow: Array.from(store.buyOrders.values()).reduce(
            (sum, order) => sum + order.escrowRemaining,
            0
          ),
          blackjackHandsToday: store.blackjackHands.size,
          blackjackNetGoldMovement: 0,
          raidsCompletedToday: store.raids.length,
          raidClearRate: store.raids.length > 0 ? 100 : 0,
          chatReportsOpen: 0,
          moderationActionsToday: store.audits.filter((audit) => audit.module === "moderation").length
        },
        health: {
          supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
          serviceRoleServerOnly: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          fastifyAuthoritative: true
        },
        charts: {
          playerRegistrations: [{ label: "Today", value: store.players.size - 1 }],
          sourceSinks: store.ledger.map((entry) => ({ label: entry.sourceType, value: entry.amount })),
          blackjackOutcomes: Array.from(store.blackjackHands.values()).map((hand) => ({
            label: hand.status,
            value: 1
          }))
        }
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/players", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "players:view");
      return {
        players: Array.from(store.players.values())
          .filter((player) => player.id !== "treasury")
          .map((player) => ({
            ...getPublicPlayer(store, player.id),
            sessionStatus: player.sessionStatus,
            presenceStatus: player.presenceStatus,
            walletRiskFlag: player.walletRiskFlag
          }))
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get<{ Params: { id: string } }>("/api/admin/players/:id", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "players:view");
      const params = paramsIdSchema.parse(request.params);
      const playerForAdmin = getPlayerOrThrow(store, params.id);
      return {
        player: getPublicPlayer(store, params.id),
        wallet: {
          publicKey: playerForAdmin.walletPublicKey,
          walletLinkedAt: playerForAdmin.walletLinkedAt,
          authHistory: playerForAdmin.walletAuthHistory,
          sessionStatus: playerForAdmin.sessionStatus,
          presenceStatus: playerForAdmin.presenceStatus,
          walletRiskFlag: playerForAdmin.walletRiskFlag,
          ownerOnlyUnlinkRequired: true
        },
        ledger: getLedgerForPlayer(store, params.id),
        inventory: getInventory(store, params.id),
        market: store.marketTrades.filter(
          (trade) => trade.buyerPlayerId === params.id || trade.sellerPlayerId === params.id
        ),
        blackjack: Array.from(store.blackjackHands.values()).filter((hand) => hand.playerId === params.id),
        audits: store.audits.filter((audit) => audit.targetPlayerId === params.id)
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/admin/devtools/adjust-balance", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      const body = parseBody(adminDevAdjustmentSchema, request.body);
      devAdjustBalance(store, admin, body);
      return { ok: true };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/admin/moderation/action", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      const body = parseBody(adminModerationSchema, request.body);
      moderatePlayer(store, admin, body);
      return { ok: true };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/admin/config/publish", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      const body = parseBody(adminConfigPublishSchema, request.body);
      publishConfig(store, admin, body);
      return { ok: true };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/api/admin/market/buy-orders/:id/cancel", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      const params = paramsIdSchema.parse(request.params);
      const body = z.object({ reason: z.string().min(8) }).parse(request.body);
      adminCancelBuyOrder(store, admin, params.id, body.reason);
      return { ok: true };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/economy", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "economy:view");
      return {
        summary: summarizeEconomy(store),
        ledger: store.ledger.slice(-200).reverse(),
        sellCaps: [{ level: "10-19", capacity: 100 }, { level: "20-29", capacity: 150 }],
        configVersions: [
          {
            id: "economy-config-dev",
            status: "PUBLISHED",
            version: 1,
            values: { marketTax: "10%", blackjackProfitCap: "60% of sell cap" }
          }
        ]
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/market", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "market:view");
      return {
        listings: Array.from(store.marketListings.values()),
        buyOrders: Array.from(store.buyOrders.values()),
        trades: store.marketTrades,
        escrow: Array.from(store.escrows.values())
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/blackjack", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "blackjack:view");
      const hands = Array.from(store.blackjackHands.values());
      return {
        totalHands: hands.length,
        hands,
        counters: Array.from(store.blackjackCounters.values()),
        outcomes: hands.reduce<Record<string, number>>((summary, hand) => {
          summary[hand.status] = (summary[hand.status] ?? 0) + 1;
          return summary;
        }, {})
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/raids", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "raids:view");
      return {
        raids: store.raids,
        lobbies: Array.from(store.lobbies.values()),
        maps: mapDefinitions,
        heroPickRates: heroDefinitions.map((hero) => ({ hero: hero.name, picks: hero.id === "storm-archer" ? 1 : 0 }))
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/content", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "content:manage");
      return {
        heroes: heroDefinitions,
        equipment: Array.from(store.equipmentDefinitions.values()),
        consumables: publicContent.consumables,
        maps: mapDefinitions,
        npcDialog: npcDefinitions,
        versions: [{ id: "content-dev", status: "PUBLISHED", version: 1 }]
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/audit", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "audit:view");
      return { audits: store.audits.slice(-200).reverse() };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.get("/api/admin/system", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      requirePermission(admin.role, "system:view");
      return {
        serverStatus: "ok",
        databaseStatus: "dev-store-ready",
        queue: "placeholder",
        recentFailedJobs: [],
        recentFailedMarketOperations: [],
        recentFailedLedgerActions: [],
        recentFailedBlackjackOperations: [],
        version: "0.1.0",
        devMode: store.devMode
      };
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post("/api/admin/devtools/reseed", async (request, reply) => {
    try {
      const admin = getAdmin(request, store);
      if (!store.devMode) {
        throw new Error("DEV tools are unavailable when DEV_MODE is false");
      }
      requirePermission(admin.role, "devtools:run");
      recordAudit(store, {
        actorAdminId: admin.id,
        actorRole: admin.role,
        actionType: "DEV_RESEED_PLACEHOLDER",
        targetEntityType: "DevToolAction",
        targetEntityId: "reseed",
        targetPlayerId: null,
        before: null,
        after: { requestedAt: nowIso() },
        reason: "DEV reseed requested",
        correlationId: makeId("corr"),
        module: "devtools"
      });
      return { ok: true };
    } catch (error) {
      sendError(reply, error);
    }
  });
}
