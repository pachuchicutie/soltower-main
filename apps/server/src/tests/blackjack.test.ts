import { describe, expect, it } from "vitest";
import { getBlackjackEarnedProfitCap, getBlackjackLimits, validateBlackjackBet } from "@soltower/shared";
import { createDevStore, type Card } from "../data/store";
import { actOnBlackjackHand, dealBlackjackHand, dealerShouldHit } from "../services/blackjack";
import { getPlayerOrThrow } from "../services/economy";

function findResolvedHand(statuses: string[], balanceType: "EARNED_GOLD" | "LOCKED_GOLD") {
  for (let index = 0; index < 300; index += 1) {
    const store = createDevStore();
    const player = getPlayerOrThrow(store, "player-marky");
    player.balances.EARNED_GOLD = 1000;
    player.balances.LOCKED_GOLD = 1000;
    const hand = dealBlackjackHand(
      store,
      player.id,
      { balanceType, bet: 25, idempotencyKey: `deal-${index}` },
      `seed-${index}`
    );
    const resolved =
      hand.status === "ACTIVE"
        ? actOnBlackjackHand(store, player.id, hand.id, { action: "STAND", idempotencyKey: `stand-${index}` })
        : hand;
    if (statuses.includes(resolved.status)) {
      return { store, player, hand: resolved };
    }
  }
  throw new Error(`No hand found for ${statuses.join(",")}`);
}

describe("blackjack rules", () => {
  it("preserves Earned Gold on win and loss paths", () => {
    const win = findResolvedHand(["PLAYER_WIN", "BLACKJACK"], "EARNED_GOLD");
    expect(win.player.balances.LOCKED_GOLD).toBe(1000);
    expect(win.player.balances.EARNED_GOLD).toBeGreaterThan(1000);

    const loss = findResolvedHand(["DEALER_WIN", "BUST"], "EARNED_GOLD");
    expect(loss.player.balances.LOCKED_GOLD).toBe(1000);
    expect(loss.player.balances.EARNED_GOLD).toBeLessThan(1000);
  });

  it("preserves Locked Gold and never converts it into Earned Gold", () => {
    const win = findResolvedHand(["PLAYER_WIN", "BLACKJACK"], "LOCKED_GOLD");
    expect(win.player.balances.EARNED_GOLD).toBe(1000);
    expect(win.player.balances.LOCKED_GOLD).toBeGreaterThan(1000);
  });

  it("applies minimum and maximum table limits by level", () => {
    expect(() => validateBlackjackBet(10, 300, 4)).toThrow(/minimum/);
    expect(() => validateBlackjackBet(10, 300, 26)).toThrow(/maximum/);
    expect(() => validateBlackjackBet(10, 300, 25)).not.toThrow();
  });

  it("applies the 20 percent selected-balance maximum bet rule", () => {
    const limits = getBlackjackLimits(20, 120);
    expect(limits.tableMaxBet).toBe(50);
    expect(limits.balanceMaxBet).toBe(24);
    expect(limits.actualMaxBet).toBe(24);
  });

  it("makes the dealer hit soft 17", () => {
    const cards: Card[] = [
      { rank: "A", suit: "♠" },
      { rank: "6", suit: "♥" }
    ];
    expect(dealerShouldHit(cards)).toBe(true);
  });

  it("moves additional Earned Gold profit over the daily cap into Locked Gold", () => {
    const store = createDevStore();
    const player = getPlayerOrThrow(store, "player-marky");
    player.balances.EARNED_GOLD = 1000;
    player.balances.LOCKED_GOLD = 1000;
    const cap = getBlackjackEarnedProfitCap(player.accountLevel);
    store.blackjackCounters.set(`${player.id}:${new Date().toISOString().slice(0, 10)}`, {
      playerId: player.id,
      day: new Date().toISOString().slice(0, 10),
      earnedProfit: cap - 5,
      handsPlayed: 0
    });

    let settled = false;
    for (let index = 0; index < 300 && !settled; index += 1) {
      const hand = dealBlackjackHand(
        store,
        player.id,
        { balanceType: "EARNED_GOLD", bet: 25, idempotencyKey: `cap-deal-${index}` },
        `cap-seed-${index}`
      );
      const resolved =
        hand.status === "ACTIVE"
          ? actOnBlackjackHand(store, player.id, hand.id, { action: "STAND", idempotencyKey: `cap-stand-${index}` })
          : hand;
      settled = ["PLAYER_WIN", "BLACKJACK"].includes(resolved.status);
    }

    expect(player.balances.LOCKED_GOLD).toBeGreaterThan(1000);
  });

  it("rejects invalid action sequences server-side", () => {
    const store = createDevStore();
    const player = getPlayerOrThrow(store, "player-marky");
    player.balances.EARNED_GOLD = 1000;
    const hand = dealBlackjackHand(
      store,
      player.id,
      { balanceType: "EARNED_GOLD", bet: 25, idempotencyKey: "invalid-deal" },
      "invalid-seed"
    );
    if (hand.status === "ACTIVE") {
      actOnBlackjackHand(store, player.id, hand.id, { action: "STAND", idempotencyKey: "invalid-stand" });
    }
    expect(() =>
      actOnBlackjackHand(store, player.id, hand.id, { action: "HIT", idempotencyKey: "invalid-hit" })
    ).toThrow(/resolved/);
  });
});
