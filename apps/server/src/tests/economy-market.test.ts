import { describe, expect, it } from "vitest";
import { getDailySellCapacity } from "@soltower/shared";
import { createDevStore } from "../data/store";
import { createDevPlayer, getPlayerOrThrow } from "../services/economy";
import {
  buyMarketListing,
  cancelBuyOrder,
  createBuyOrder,
  createMarketListing,
  fillBuyOrder
} from "../services/market";

describe("economy and market rules", () => {
  it("starts every new account with exactly 50 Locked Gold", () => {
    const store = createDevStore();
    const player = createDevPlayer(store, "Aster");
    expect(player.balances.LOCKED_GOLD).toBe(50);
    expect(player.balances.EARNED_GOLD).toBe(0);
  });

  it("does not allow Locked Gold to be listed on the market", () => {
    const store = createDevStore();
    const player = getPlayerOrThrow(store, "player-marky");
    player.balances.EARNED_GOLD = 0;
    player.balances.LOCKED_GOLD = 500;
    expect(() =>
      createMarketListing(store, player.id, {
        goldAmount: 100,
        pricePerGold: 2,
        idempotencyKey: "locked-listing-test"
      })
    ).toThrow(/Earned Gold/);
  });

  it("allows Earned Gold listing only at level 10 or above", () => {
    const store = createDevStore();
    const lowLevel = getPlayerOrThrow(store, "player-safi");
    lowLevel.balances.EARNED_GOLD = 200;
    expect(() =>
      createMarketListing(store, lowLevel.id, {
        goldAmount: 100,
        pricePerGold: 2,
        idempotencyKey: "low-level-listing"
      })
    ).toThrow(/level 10/);

    const marky = getPlayerOrThrow(store, "player-marky");
    const listing = createMarketListing(store, marky.id, {
      goldAmount: 100,
      pricePerGold: 2,
      idempotencyKey: "level-ten-listing"
    });
    expect(listing.status).toBe("ACTIVE");
  });

  it("turns market-purchased Gold into Locked Gold and prevents relisting that Gold", () => {
    const store = createDevStore();
    const buyer = getPlayerOrThrow(store, "player-marky");
    buyer.balances.EARNED_GOLD = 0;
    buyer.balances.TEST_TOKEN = 1000;
    const trade = buyMarketListing(store, buyer.id, "listing-demo-1", "buy-listing-demo");
    expect(trade.goldAmount).toBe(120);
    expect(buyer.balances.LOCKED_GOLD).toBe(170);
    expect(buyer.balances.EARNED_GOLD).toBe(0);
    expect(() =>
      createMarketListing(store, buyer.id, {
        goldAmount: 100,
        pricePerGold: 2,
        idempotencyKey: "relist-locked-market-gold"
      })
    ).toThrow(/Earned Gold/);
  });

  it("pays the seller exactly 90 percent and taxes exactly 10 percent", () => {
    const store = createDevStore();
    const buyer = getPlayerOrThrow(store, "player-marky");
    buyer.balances.TEST_TOKEN = 1000;
    const seller = getPlayerOrThrow(store, "player-nyla");
    const sellerBefore = seller.balances.TEST_TOKEN;
    const treasury = getPlayerOrThrow(store, "treasury");
    const trade = buyMarketListing(store, buyer.id, "listing-demo-1", "tax-check");
    expect(trade.grossTestToken).toBe(240);
    expect(trade.taxTestToken).toBe(24);
    expect(trade.sellerNet).toBe(216);
    expect(seller.balances.TEST_TOKEN).toBe(sellerBefore + 216);
    expect(treasury.balances.TEST_TOKEN).toBe(24);
  });

  it("locks Test Token in buy-order escrow and releases remaining escrow on cancel", () => {
    const store = createDevStore();
    const buyer = getPlayerOrThrow(store, "player-marky");
    const before = buyer.balances.TEST_TOKEN;
    const order = createBuyOrder(store, buyer.id, {
      goldAmount: 100,
      pricePerGold: 2,
      idempotencyKey: "escrow-order"
    });
    expect(buyer.balances.TEST_TOKEN).toBe(before - 200);
    cancelBuyOrder(store, buyer.id, order.id, "Player cancelled order", "cancel-order");
    expect(buyer.balances.TEST_TOKEN).toBe(before);
  });

  it("partially fills buy orders atomically", () => {
    const store = createDevStore();
    const buyer = getPlayerOrThrow(store, "player-marky");
    buyer.balances.TEST_TOKEN = 1000;
    const seller = getPlayerOrThrow(store, "player-orren");
    const order = createBuyOrder(store, buyer.id, {
      goldAmount: 200,
      pricePerGold: 2,
      idempotencyKey: "partial-order"
    });
    const fill = fillBuyOrder(store, seller.id, order.id, {
      goldAmount: 100,
      idempotencyKey: "partial-fill"
    });
    expect(fill.goldAmount).toBe(100);
    expect(order.openGoldAmount).toBe(100);
    expect(order.escrowRemaining).toBe(200);
    expect(buyer.balances.LOCKED_GOLD).toBe(150);
    expect(seller.balances.TEST_TOKEN).toBe(600);
  });

  it("creates immutable ledger entries and does not double-apply duplicate idempotency keys", () => {
    const store = createDevStore();
    const buyer = getPlayerOrThrow(store, "player-marky");
    buyer.balances.TEST_TOKEN = 1000;
    buyMarketListing(store, buyer.id, "listing-demo-1", "idem-market");
    const afterFirst = buyer.balances.LOCKED_GOLD;
    const ledgerCount = store.ledger.length;
    buyMarketListing(store, buyer.id, "listing-demo-1", "idem-market");
    expect(buyer.balances.LOCKED_GOLD).toBe(afterFirst);
    expect(store.ledger).toHaveLength(ledgerCount);
    expect(Object.isFrozen(store.ledger[0])).toBe(false);
  });

  it("sets level 10 daily sell capacity to 100 Gold", () => {
    expect(getDailySellCapacity(10)).toBe(100);
  });
});
