import {
  calculateMarketTax,
  economyConfig,
  type CreateBuyOrderInput,
  type CreateMarketListingInput,
  type FillBuyOrderInput
} from "@soltower/shared";
import {
  type BuyOrderFillRecord,
  type BuyOrderRecord,
  type DevStore,
  type MarketListingRecord,
  type MarketTradeRecord,
  makeId,
  nowIso,
  todayKey
} from "../data/store";
import { applyLedgerMutation, assertCanSellEarnedGold, getPlayerOrThrow } from "./economy";

export function listActiveMarketListings(store: DevStore): MarketListingRecord[] {
  return Array.from(store.marketListings.values()).filter((listing) => listing.status === "ACTIVE");
}

export function createMarketListing(
  store: DevStore,
  sellerPlayerId: string,
  input: CreateMarketListingInput
): MarketListingRecord {
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "listing") {
    const listing = store.marketListings.get(existingReference.id);
    if (!listing) {
      throw new Error("Idempotency reference is corrupt");
    }
    return listing;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }
  if (input.goldAmount < economyConfig.marketMinimumGoldQuantity) {
    throw new Error(`Minimum listing amount is ${economyConfig.marketMinimumGoldQuantity} Gold`);
  }
  assertCanSellEarnedGold(store, sellerPlayerId, input.goldAmount, todayKey());

  const listing: MarketListingRecord = {
    id: makeId("listing"),
    sellerPlayerId,
    goldAmount: input.goldAmount,
    pricePerGold: input.pricePerGold,
    totalPrice: input.goldAmount * input.pricePerGold,
    status: "ACTIVE",
    createdAt: nowIso(),
    soldToPlayerId: null
  };

  applyLedgerMutation(store, {
    playerId: sellerPlayerId,
    balanceType: "EARNED_GOLD",
    sourceType: "MARKET_SALE",
    amount: input.goldAmount,
    direction: "DEBIT",
    reason: "Escrow Earned Gold for market listing",
    idempotencyKey: `${input.idempotencyKey}:seller-gold-escrow`,
    referenceEntityType: "MarketListing",
    referenceEntityId: listing.id
  });

  store.marketListings.set(listing.id, listing);
  store.idempotency.set(input.idempotencyKey, { type: "listing", id: listing.id });
  return listing;
}

export function buyMarketListing(
  store: DevStore,
  buyerPlayerId: string,
  listingId: string,
  idempotencyKey: string
): MarketTradeRecord {
  const existingReference = store.idempotency.get(idempotencyKey);
  if (existingReference?.type === "trade") {
    const trade = store.marketTrades.find((entry) => entry.id === existingReference.id);
    if (!trade) {
      throw new Error("Idempotency reference is corrupt");
    }
    return trade;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }
  const listing = store.marketListings.get(listingId);
  if (!listing || listing.status !== "ACTIVE") {
    throw new Error("Listing is not available");
  }
  if (listing.sellerPlayerId === buyerPlayerId) {
    throw new Error("Cannot buy your own listing");
  }
  const buyer = getPlayerOrThrow(store, buyerPlayerId);
  if (buyer.balances.TEST_TOKEN < listing.totalPrice) {
    throw new Error("Insufficient Test Token");
  }

  const { tax, sellerReceives } = calculateMarketTax(listing.totalPrice);
  const trade: MarketTradeRecord = {
    id: makeId("trade"),
    listingId: listing.id,
    buyOrderId: null,
    buyerPlayerId,
    sellerPlayerId: listing.sellerPlayerId,
    goldAmount: listing.goldAmount,
    grossTestToken: listing.totalPrice,
    taxTestToken: tax,
    sellerNet: sellerReceives,
    createdAt: nowIso()
  };

  applyLedgerMutation(store, {
    playerId: buyerPlayerId,
    balanceType: "TEST_TOKEN",
    sourceType: "MARKET_PURCHASE",
    amount: listing.totalPrice,
    direction: "DEBIT",
    reason: "Buy Gold listing with Test Token",
    idempotencyKey: `${idempotencyKey}:buyer-token`,
    referenceEntityType: "MarketTrade",
    referenceEntityId: trade.id
  });
  applyLedgerMutation(store, {
    playerId: buyerPlayerId,
    balanceType: "LOCKED_GOLD",
    sourceType: "MARKET_PURCHASE",
    amount: listing.goldAmount,
    direction: "CREDIT",
    reason: "Market-purchased Gold becomes Locked Gold",
    idempotencyKey: `${idempotencyKey}:buyer-locked-gold`,
    referenceEntityType: "MarketTrade",
    referenceEntityId: trade.id
  });
  applyLedgerMutation(store, {
    playerId: listing.sellerPlayerId,
    balanceType: "TEST_TOKEN",
    sourceType: "MARKET_SALE",
    amount: sellerReceives,
    direction: "CREDIT",
    reason: "Seller receives Test Token net of market tax",
    idempotencyKey: `${idempotencyKey}:seller-token-net`,
    referenceEntityType: "MarketTrade",
    referenceEntityId: trade.id
  });
  if (tax > 0) {
    applyLedgerMutation(store, {
      playerId: economyConfig.treasuryPlayerId,
      balanceType: "TEST_TOKEN",
      sourceType: "MARKET_TAX",
      amount: tax,
      direction: "CREDIT",
      reason: "DEV treasury receives market tax",
      idempotencyKey: `${idempotencyKey}:treasury-tax`,
      referenceEntityType: "MarketTrade",
      referenceEntityId: trade.id
    });
  }

  listing.status = "SOLD";
  listing.soldToPlayerId = buyerPlayerId;
  store.marketTrades.push(trade);
  store.idempotency.set(idempotencyKey, { type: "trade", id: trade.id });
  return trade;
}

export function listOpenBuyOrders(store: DevStore): BuyOrderRecord[] {
  return Array.from(store.buyOrders.values()).filter((order) => order.status === "OPEN");
}

export function createBuyOrder(store: DevStore, buyerPlayerId: string, input: CreateBuyOrderInput): BuyOrderRecord {
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "buy-order") {
    const order = store.buyOrders.get(existingReference.id);
    if (!order) {
      throw new Error("Idempotency reference is corrupt");
    }
    return order;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }
  const buyer = getPlayerOrThrow(store, buyerPlayerId);
  const totalPrice = input.goldAmount * input.pricePerGold;
  if (buyer.balances.TEST_TOKEN < totalPrice) {
    throw new Error("Insufficient Test Token for escrow");
  }
  const order: BuyOrderRecord = {
    id: makeId("buyorder"),
    buyerPlayerId,
    goldAmount: input.goldAmount,
    openGoldAmount: input.goldAmount,
    pricePerGold: input.pricePerGold,
    escrowRemaining: totalPrice,
    status: "OPEN",
    createdAt: nowIso(),
    expiresAt: null
  };
  applyLedgerMutation(store, {
    playerId: buyerPlayerId,
    balanceType: "TEST_TOKEN",
    sourceType: "BUY_ORDER_ESCROW",
    amount: totalPrice,
    direction: "DEBIT",
    reason: "Lock Test Token in buy-order escrow",
    idempotencyKey: `${input.idempotencyKey}:escrow-token`,
    referenceEntityType: "BuyOrder",
    referenceEntityId: order.id
  });
  store.buyOrders.set(order.id, order);
  store.escrows.set(order.id, {
    id: makeId("escrow"),
    buyOrderId: order.id,
    playerId: buyerPlayerId,
    balanceType: "TEST_TOKEN",
    amountLocked: totalPrice,
    amountOpen: totalPrice,
    status: "OPEN"
  });
  store.idempotency.set(input.idempotencyKey, { type: "buy-order", id: order.id });
  return order;
}

export function fillBuyOrder(
  store: DevStore,
  sellerPlayerId: string,
  orderId: string,
  input: FillBuyOrderInput
): BuyOrderFillRecord {
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "buy-order-fill") {
    const fill = store.buyOrderFills.find((entry) => entry.id === existingReference.id);
    if (!fill) {
      throw new Error("Idempotency reference is corrupt");
    }
    return fill;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }
  const order = store.buyOrders.get(orderId);
  if (!order || order.status !== "OPEN") {
    throw new Error("Buy order is not open");
  }
  if (order.buyerPlayerId === sellerPlayerId) {
    throw new Error("Cannot fill your own buy order");
  }
  if (input.goldAmount > order.openGoldAmount) {
    throw new Error("Fill amount exceeds open order amount");
  }
  assertCanSellEarnedGold(store, sellerPlayerId, input.goldAmount, todayKey());

  const gross = input.goldAmount * order.pricePerGold;
  if (gross > order.escrowRemaining) {
    throw new Error("Escrow is insufficient");
  }
  const { tax, sellerReceives } = calculateMarketTax(gross);
  const fill: BuyOrderFillRecord = {
    id: makeId("buyfill"),
    buyOrderId: order.id,
    sellerPlayerId,
    goldAmount: input.goldAmount,
    grossTestToken: gross,
    taxTestToken: tax,
    sellerNet: sellerReceives,
    createdAt: nowIso()
  };

  applyLedgerMutation(store, {
    playerId: sellerPlayerId,
    balanceType: "EARNED_GOLD",
    sourceType: "MARKET_SALE",
    amount: input.goldAmount,
    direction: "DEBIT",
    reason: "Sell Earned Gold into buy order",
    idempotencyKey: `${input.idempotencyKey}:seller-earned-gold`,
    referenceEntityType: "BuyOrderFill",
    referenceEntityId: fill.id
  });
  applyLedgerMutation(store, {
    playerId: order.buyerPlayerId,
    balanceType: "LOCKED_GOLD",
    sourceType: "MARKET_PURCHASE",
    amount: input.goldAmount,
    direction: "CREDIT",
    reason: "Buy-order fill grants Locked Gold",
    idempotencyKey: `${input.idempotencyKey}:buyer-locked-gold`,
    referenceEntityType: "BuyOrderFill",
    referenceEntityId: fill.id
  });
  applyLedgerMutation(store, {
    playerId: sellerPlayerId,
    balanceType: "TEST_TOKEN",
    sourceType: "MARKET_SALE",
    amount: sellerReceives,
    direction: "CREDIT",
    reason: "Buy-order seller receives Test Token net of tax",
    idempotencyKey: `${input.idempotencyKey}:seller-token-net`,
    referenceEntityType: "BuyOrderFill",
    referenceEntityId: fill.id
  });
  if (tax > 0) {
    applyLedgerMutation(store, {
      playerId: economyConfig.treasuryPlayerId,
      balanceType: "TEST_TOKEN",
      sourceType: "MARKET_TAX",
      amount: tax,
      direction: "CREDIT",
      reason: "DEV treasury receives buy-order tax",
      idempotencyKey: `${input.idempotencyKey}:treasury-tax`,
      referenceEntityType: "BuyOrderFill",
      referenceEntityId: fill.id
    });
  }

  order.openGoldAmount -= input.goldAmount;
  order.escrowRemaining -= gross;
  if (order.openGoldAmount === 0) {
    order.status = "FILLED";
  }
  const escrow = store.escrows.get(order.id);
  if (escrow) {
    escrow.amountOpen = order.escrowRemaining;
    escrow.status = order.status === "FILLED" ? "FILLED" : "OPEN";
  }
  store.buyOrderFills.push(fill);
  store.marketTrades.push({
    id: makeId("trade"),
    listingId: null,
    buyOrderId: order.id,
    buyerPlayerId: order.buyerPlayerId,
    sellerPlayerId,
    goldAmount: input.goldAmount,
    grossTestToken: gross,
    taxTestToken: tax,
    sellerNet: sellerReceives,
    createdAt: fill.createdAt
  });
  store.idempotency.set(input.idempotencyKey, { type: "buy-order-fill", id: fill.id });
  return fill;
}

export function cancelBuyOrder(
  store: DevStore,
  requesterPlayerId: string,
  orderId: string,
  reason: string,
  idempotencyKey: string,
  adminId?: string
): BuyOrderRecord {
  const order = store.buyOrders.get(orderId);
  if (!order || order.status !== "OPEN") {
    throw new Error("Buy order is not open");
  }
  if (!adminId && order.buyerPlayerId !== requesterPlayerId) {
    throw new Error("Only the buyer can cancel this order");
  }
  if (order.escrowRemaining > 0) {
    applyLedgerMutation(store, {
      playerId: order.buyerPlayerId,
      balanceType: "TEST_TOKEN",
      sourceType: "BUY_ORDER_RELEASE",
      amount: order.escrowRemaining,
      direction: "CREDIT",
      reason,
      idempotencyKey: `${idempotencyKey}:release-token`,
      createdByAdminId: adminId ?? null,
      referenceEntityType: "BuyOrder",
      referenceEntityId: order.id
    });
  }
  order.status = adminId ? "REVOKED" : "CANCELLED";
  order.escrowRemaining = 0;
  const escrow = store.escrows.get(order.id);
  if (escrow) {
    escrow.amountOpen = 0;
    escrow.status = "RELEASED";
  }
  return order;
}
