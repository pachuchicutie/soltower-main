import { createHash, randomBytes } from "node:crypto";
import {
  getBlackjackEarnedProfitCap,
  getBlackjackLimits,
  validateBlackjackBet,
  type BlackjackActionInput,
  type BlackjackDealInput
} from "@soltower/shared";
import {
  type BlackjackDailyCounterRecord,
  type BlackjackHandRecord,
  type Card,
  type DevStore,
  makeId,
  nowIso,
  todayKey
} from "../data/store";
import { applyLedgerMutation, getPlayerOrThrow } from "./economy";

const ranks: Card["rank"][] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits: Card["suit"][] = ["♠", "♥", "♦", "♣"];

export interface HandValue {
  total: number;
  soft: boolean;
}

export function getHandValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  cards.forEach((card) => {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["J", "Q", "K"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function dealerShouldHit(cards: Card[]): boolean {
  const value = getHandValue(cards);
  return value.total < 17 || (value.total === 17 && value.soft);
}

function seedToNumber(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32LE(0);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createShoe(seed: string): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < 6; deck += 1) {
    suits.forEach((suit) => ranks.forEach((rank) => cards.push({ rank, suit })));
  }
  const next = mulberry32(seedToNumber(seed));
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    const current = cards[index];
    cards[index] = cards[swapIndex];
    cards[swapIndex] = current;
  }
  return cards;
}

function drawCard(hand: BlackjackHandRecord, target: "PLAYER" | "DEALER"): Card {
  const card = hand.shoe.shift();
  if (!card) {
    throw new Error("Shoe exhausted");
  }
  if (target === "PLAYER") {
    hand.playerCards.push(card);
  } else {
    hand.dealerCards.push(card);
  }
  return card;
}

function getCounter(store: DevStore, playerId: string): BlackjackDailyCounterRecord {
  const day = todayKey();
  const key = `${playerId}:${day}`;
  const existing = store.blackjackCounters.get(key);
  if (existing) {
    return existing;
  }
  const counter: BlackjackDailyCounterRecord = {
    playerId,
    day,
    earnedProfit: 0,
    handsPlayed: 0
  };
  store.blackjackCounters.set(key, counter);
  return counter;
}

function isNaturalBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && getHandValue(cards).total === 21;
}

function creditBlackjackPayout(
  store: DevStore,
  hand: BlackjackHandRecord,
  profit: number,
  idempotencyKey: string
): void {
  const returnAmount = hand.totalWager;
  if (hand.balanceType === "LOCKED_GOLD") {
    applyLedgerMutation(store, {
      playerId: hand.playerId,
      balanceType: "LOCKED_GOLD",
      sourceType: "BLACKJACK_WIN",
      amount: returnAmount + profit,
      direction: "CREDIT",
      reason: "Blackjack Locked Gold payout",
      idempotencyKey: `${idempotencyKey}:locked-payout`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
    return;
  }

  applyLedgerMutation(store, {
    playerId: hand.playerId,
    balanceType: "EARNED_GOLD",
    sourceType: "BLACKJACK_WIN",
    amount: returnAmount,
    direction: "CREDIT",
    reason: "Blackjack returns Earned Gold wager",
    idempotencyKey: `${idempotencyKey}:earned-return`,
    referenceEntityType: "BlackjackHand",
    referenceEntityId: hand.id
  });

  if (profit <= 0) {
    return;
  }
  const counter = getCounter(store, hand.playerId);
  const player = getPlayerOrThrow(store, hand.playerId);
  const cap = getBlackjackEarnedProfitCap(player.accountLevel);
  const earnedProfitRoom = Math.max(0, cap - counter.earnedProfit);
  const earnedProfit = Math.min(profit, earnedProfitRoom);
  const lockedProfit = profit - earnedProfit;

  if (earnedProfit > 0) {
    applyLedgerMutation(store, {
      playerId: hand.playerId,
      balanceType: "EARNED_GOLD",
      sourceType: "BLACKJACK_WIN",
      amount: earnedProfit,
      direction: "CREDIT",
      reason: "Blackjack Earned Gold profit within daily cap",
      idempotencyKey: `${idempotencyKey}:earned-profit`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
    counter.earnedProfit += earnedProfit;
  }

  if (lockedProfit > 0) {
    applyLedgerMutation(store, {
      playerId: hand.playerId,
      balanceType: "LOCKED_GOLD",
      sourceType: "BLACKJACK_WIN",
      amount: lockedProfit,
      direction: "CREDIT",
      reason: "Blackjack profit above Earned cap becomes Locked Gold",
      idempotencyKey: `${idempotencyKey}:locked-over-cap-profit`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
  }
}

function resolveHand(store: DevStore, hand: BlackjackHandRecord, idempotencyKey: string): BlackjackHandRecord {
  if (hand.status !== "ACTIVE") {
    return hand;
  }

  const playerValue = getHandValue(hand.playerCards);
  if (playerValue.total > 21) {
    hand.status = "BUST";
    hand.resolvedAt = nowIso();
    hand.resultMetadata = { result: "player_bust", profit: -hand.totalWager };
    getCounter(store, hand.playerId).handsPlayed += 1;
    return hand;
  }

  while (dealerShouldHit(hand.dealerCards)) {
    drawCard(hand, "DEALER");
  }

  const dealerValue = getHandValue(hand.dealerCards);
  let profit = 0;
  if (dealerValue.total > 21 || playerValue.total > dealerValue.total) {
    profit = hand.totalWager;
    hand.status = "PLAYER_WIN";
  } else if (playerValue.total === dealerValue.total) {
    hand.status = "PUSH";
  } else {
    hand.status = "DEALER_WIN";
  }

  if (hand.status === "PUSH") {
    applyLedgerMutation(store, {
      playerId: hand.playerId,
      balanceType: hand.balanceType,
      sourceType: "BLACKJACK_PUSH",
      amount: hand.totalWager,
      direction: "CREDIT",
      reason: "Blackjack push returns original wager",
      idempotencyKey: `${idempotencyKey}:push-return`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
  } else if (profit > 0) {
    creditBlackjackPayout(store, hand, profit, idempotencyKey);
  }

  hand.resolvedAt = nowIso();
  hand.resultMetadata = {
    result: hand.status,
    playerTotal: playerValue.total,
    dealerTotal: dealerValue.total,
    profit
  };
  getCounter(store, hand.playerId).handsPlayed += 1;
  return hand;
}

function resolveNaturalBlackjack(store: DevStore, hand: BlackjackHandRecord, idempotencyKey: string): BlackjackHandRecord {
  const playerNatural = isNaturalBlackjack(hand.playerCards);
  const dealerNatural = isNaturalBlackjack(hand.dealerCards);
  if (!playerNatural && !dealerNatural) {
    return hand;
  }
  if (playerNatural && dealerNatural) {
    hand.status = "PUSH";
    applyLedgerMutation(store, {
      playerId: hand.playerId,
      balanceType: hand.balanceType,
      sourceType: "BLACKJACK_PUSH",
      amount: hand.totalWager,
      direction: "CREDIT",
      reason: "Mutual blackjack push returns wager",
      idempotencyKey: `${idempotencyKey}:natural-push`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
  } else if (playerNatural) {
    hand.status = "BLACKJACK";
    const profit = Math.floor((hand.totalWager * 6) / 5);
    creditBlackjackPayout(store, hand, profit, idempotencyKey);
  } else {
    hand.status = "DEALER_WIN";
  }
  hand.resolvedAt = nowIso();
  hand.resultMetadata = {
    result: hand.status,
    natural: true
  };
  getCounter(store, hand.playerId).handsPlayed += 1;
  return hand;
}

export function dealBlackjackHand(
  store: DevStore,
  playerId: string,
  input: BlackjackDealInput,
  forcedSeed?: string
): BlackjackHandRecord {
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "blackjack-hand") {
    const hand = store.blackjackHands.get(existingReference.id);
    if (!hand) {
      throw new Error("Idempotency reference is corrupt");
    }
    return hand;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }

  const player = getPlayerOrThrow(store, playerId);
  if (player.blackjackFrozen) {
    throw new Error("Blackjack access is frozen");
  }
  const selectedBalance = player.balances[input.balanceType];
  validateBlackjackBet(player.accountLevel, selectedBalance, input.bet);

  const seed = forcedSeed ?? randomBytes(32).toString("hex");
  const shoe = createShoe(seed);
  const hand: BlackjackHandRecord = {
    id: makeId("bjhand"),
    playerId,
    balanceType: input.balanceType,
    bet: input.bet,
    totalWager: input.bet,
    status: "ACTIVE",
    playerCards: [],
    dealerCards: [],
    shoe,
    shoeSeedHash: createHash("sha256").update(seed).digest("hex"),
    shuffleSeed: seed,
    doubled: false,
    createdAt: nowIso(),
    resolvedAt: null,
    resultMetadata: {}
  };

  applyLedgerMutation(store, {
    playerId,
    balanceType: input.balanceType,
    sourceType: "BLACKJACK_WAGER",
    amount: input.bet,
    direction: "DEBIT",
    reason: "Blackjack wager placed",
    idempotencyKey: `${input.idempotencyKey}:initial-wager`,
    referenceEntityType: "BlackjackHand",
    referenceEntityId: hand.id
  });

  drawCard(hand, "PLAYER");
  drawCard(hand, "DEALER");
  drawCard(hand, "PLAYER");
  drawCard(hand, "DEALER");
  store.blackjackHands.set(hand.id, hand);
  store.idempotency.set(input.idempotencyKey, { type: "blackjack-hand", id: hand.id });
  return resolveNaturalBlackjack(store, hand, input.idempotencyKey);
}

export function actOnBlackjackHand(
  store: DevStore,
  playerId: string,
  handId: string,
  input: BlackjackActionInput
): BlackjackHandRecord {
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "blackjack-hand") {
    const hand = store.blackjackHands.get(existingReference.id);
    if (!hand) {
      throw new Error("Idempotency reference is corrupt");
    }
    return hand;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used");
  }

  const hand = store.blackjackHands.get(handId);
  if (!hand || hand.playerId !== playerId) {
    throw new Error("Blackjack hand not found");
  }
  if (hand.status !== "ACTIVE") {
    throw new Error("Blackjack hand is already resolved");
  }

  if (input.action === "HIT") {
    drawCard(hand, "PLAYER");
    if (getHandValue(hand.playerCards).total > 21) {
      resolveHand(store, hand, input.idempotencyKey);
    }
  } else if (input.action === "STAND") {
    resolveHand(store, hand, input.idempotencyKey);
  } else {
    if (hand.playerCards.length !== 2 || hand.doubled) {
      throw new Error("Double Down is only available on the first two-card decision");
    }
    const player = getPlayerOrThrow(store, playerId);
    const limits = getBlackjackLimits(player.accountLevel, player.balances[hand.balanceType]);
    if (hand.bet > limits.actualMaxBet || player.balances[hand.balanceType] < hand.bet) {
      throw new Error("Insufficient room or balance to double down");
    }
    applyLedgerMutation(store, {
      playerId,
      balanceType: hand.balanceType,
      sourceType: "BLACKJACK_WAGER",
      amount: hand.bet,
      direction: "DEBIT",
      reason: "Blackjack double-down wager placed",
      idempotencyKey: `${input.idempotencyKey}:double-wager`,
      referenceEntityType: "BlackjackHand",
      referenceEntityId: hand.id
    });
    hand.totalWager += hand.bet;
    hand.doubled = true;
    drawCard(hand, "PLAYER");
    resolveHand(store, hand, input.idempotencyKey);
  }

  store.idempotency.set(input.idempotencyKey, { type: "blackjack-hand", id: hand.id });
  return hand;
}

export function getBlackjackState(store: DevStore, playerId: string): {
  limits: ReturnType<typeof getBlackjackLimits>;
  profitCap: number;
  profitProgress: number;
  history: BlackjackHandRecord[];
} {
  const player = getPlayerOrThrow(store, playerId);
  const counter = getCounter(store, playerId);
  return {
    limits: getBlackjackLimits(player.accountLevel, player.balances.EARNED_GOLD),
    profitCap: getBlackjackEarnedProfitCap(player.accountLevel),
    profitProgress: counter.earnedProfit,
    history: Array.from(store.blackjackHands.values())
      .filter((hand) => hand.playerId === playerId)
      .slice(-12)
      .reverse()
  };
}
