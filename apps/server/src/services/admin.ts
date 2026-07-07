import { compare } from "bcryptjs";
import { hasPermission, type AdminPermission, type AdminRole } from "@soltower/shared";
import { type AdminAuditRecord, type AdminUserRecord, type DevStore, makeId, nowIso } from "../data/store";
import { applyLedgerMutation, getPlayerOrThrow } from "./economy";
import { cancelBuyOrder } from "./market";

export async function authenticateAdmin(
  store: DevStore,
  email: string,
  password: string
): Promise<AdminUserRecord> {
  const admin = Array.from(store.admins.values()).find(
    (entry) => entry.email.toLowerCase() === email.toLowerCase()
  );
  if (!admin || !admin.active) {
    throw new Error("Invalid credentials");
  }
  const valid = await compare(password, admin.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }
  return admin;
}

export function requirePermission(role: AdminRole, permission: AdminPermission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function recordAudit(
  store: DevStore,
  input: Omit<AdminAuditRecord, "id" | "createdAt" | "ipPlaceholder">
): AdminAuditRecord {
  const audit: AdminAuditRecord = {
    id: makeId("audit"),
    ipPlaceholder: "local-dev",
    createdAt: nowIso(),
    ...input
  };
  store.audits.push(audit);
  return audit;
}

export function devAdjustBalance(
  store: DevStore,
  admin: AdminUserRecord,
  input: {
    playerId: string;
    balanceType: "EARNED_GOLD" | "LOCKED_GOLD" | "TEST_TOKEN";
    amount: number;
    reason: string;
    idempotencyKey: string;
  }
): void {
  if (!store.devMode) {
    throw new Error("DEV tools are unavailable when DEV_MODE is false");
  }
  requirePermission(admin.role, "economy:adjust-dev");
  const player = getPlayerOrThrow(store, input.playerId);
  const before = { balance: player.balances[input.balanceType] };
  if (input.amount === 0) {
    throw new Error("Adjustment amount cannot be zero");
  }
  applyLedgerMutation(store, {
    playerId: input.playerId,
    balanceType: input.balanceType,
    sourceType: "ADMIN_DEV_GRANT",
    amount: Math.abs(input.amount),
    direction: input.amount > 0 ? "CREDIT" : "DEBIT",
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    createdByAdminId: admin.id,
    metadata: { devMode: true }
  });
  recordAudit(store, {
    actorAdminId: admin.id,
    actorRole: admin.role,
    actionType: "DEV_BALANCE_ADJUSTMENT",
    targetEntityType: "PlayerBalance",
    targetEntityId: input.playerId,
    targetPlayerId: input.playerId,
    before,
    after: { balance: player.balances[input.balanceType] },
    reason: input.reason,
    correlationId: input.idempotencyKey,
    module: "devtools"
  });
}

export function moderatePlayer(
  store: DevStore,
  admin: AdminUserRecord,
  input: {
    playerId: string;
    action: "MUTE" | "TEMP_SUSPEND" | "BAN" | "MARKET_FREEZE" | "BLACKJACK_FREEZE" | "NOTE";
    reason: string;
  }
): void {
  if (input.action === "BAN") {
    requirePermission(admin.role, "players:moderate");
    if (admin.role === "SUPPORT") {
      throw new Error("Support cannot ban users");
    }
  } else {
    requirePermission(admin.role, "players:moderate");
  }
  const player = getPlayerOrThrow(store, input.playerId);
  const before = {
    status: player.status,
    marketFrozen: player.marketFrozen,
    blackjackFrozen: player.blackjackFrozen
  };
  if (input.action === "MUTE") {
    player.status = "MUTED";
  } else if (input.action === "TEMP_SUSPEND") {
    player.status = "SUSPENDED";
  } else if (input.action === "BAN") {
    player.status = "BANNED";
  } else if (input.action === "MARKET_FREEZE") {
    player.marketFrozen = true;
  } else if (input.action === "BLACKJACK_FREEZE") {
    player.blackjackFrozen = true;
  }
  recordAudit(store, {
    actorAdminId: admin.id,
    actorRole: admin.role,
    actionType: input.action,
    targetEntityType: "Player",
    targetEntityId: input.playerId,
    targetPlayerId: input.playerId,
    before,
    after: {
      status: player.status,
      marketFrozen: player.marketFrozen,
      blackjackFrozen: player.blackjackFrozen
    },
    reason: input.reason,
    correlationId: makeId("corr"),
    module: "moderation"
  });
}

export function publishConfig(
  store: DevStore,
  admin: AdminUserRecord,
  input: { configId: string; highRisk: boolean; reason: string }
): void {
  if (input.highRisk) {
    requirePermission(admin.role, "economy:config-publish-high-risk");
  } else {
    requirePermission(admin.role, "economy:config-draft");
  }
  recordAudit(store, {
    actorAdminId: admin.id,
    actorRole: admin.role,
    actionType: "CONFIG_PUBLISH",
    targetEntityType: "EconomyConfigVersion",
    targetEntityId: input.configId,
    targetPlayerId: null,
    before: { status: "PENDING_APPROVAL" },
    after: { status: "PUBLISHED", highRisk: input.highRisk },
    reason: input.reason,
    correlationId: makeId("corr"),
    module: "config"
  });
}

export function adminCancelBuyOrder(
  store: DevStore,
  admin: AdminUserRecord,
  orderId: string,
  reason: string
): void {
  requirePermission(admin.role, "market:cancel");
  const before = store.buyOrders.get(orderId);
  if (!before) {
    throw new Error("Buy order not found");
  }
  const idempotencyKey = `admin-cancel:${orderId}:${makeId("idem")}`;
  const after = cancelBuyOrder(store, before.buyerPlayerId, orderId, reason, idempotencyKey, admin.id);
  recordAudit(store, {
    actorAdminId: admin.id,
    actorRole: admin.role,
    actionType: "ADMIN_CANCEL_BUY_ORDER",
    targetEntityType: "BuyOrder",
    targetEntityId: orderId,
    targetPlayerId: before.buyerPlayerId,
    before: { status: before.status, escrowRemaining: before.escrowRemaining },
    after: { status: after.status, escrowRemaining: after.escrowRemaining },
    reason,
    correlationId: idempotencyKey,
    module: "market"
  });
}
