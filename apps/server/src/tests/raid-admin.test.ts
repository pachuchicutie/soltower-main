import { describe, expect, it } from "vitest";
import { calculateRaidRewards } from "@soltower/game-engine";
import { createDevStore } from "../data/store";
import { adminCancelBuyOrder, devAdjustBalance, moderatePlayer, publishConfig } from "../services/admin";
import { createBuyOrder } from "../services/market";
import { createLobby, runPrototypeRaid } from "../services/raid";
import { getPlayerOrThrow } from "../services/economy";

const activeContribution = {
  playerId: "player-marky",
  damage: 1000,
  bossDamage: 300,
  slowValue: 20,
  debuffValue: 10,
  shieldValue: 0,
  buffValue: 0,
  activeSkillUses: 2,
  objectiveParticipation: 4,
  secondsInactive: 0
};

describe("raid rewards", () => {
  it("gives solo players 100 percent of the solo reward pool", () => {
    const [reward] = calculateRaidRewards([activeContribution], 100, 20);
    expect(reward.earnedGold).toBe(100);
    expect(reward.xp).toBe(20);
  });

  it("uses party reward multipliers and 70/30 reward split", () => {
    const rewards = calculateRaidRewards(
      [
        activeContribution,
        { ...activeContribution, playerId: "player-nyla", damage: 100, bossDamage: 20 }
      ],
      100,
      20
    );
    const total = rewards.reduce((sum, reward) => sum + reward.earnedGold, 0);
    expect(total).toBeLessThanOrEqual(180);
    expect(total).toBeGreaterThan(170);
    expect(rewards[0].earnedGold).toBeGreaterThan(rewards[1].earnedGold);
  });

  it("keeps XP personal and removes inactive players from rewards", () => {
    const rewards = calculateRaidRewards(
      [
        activeContribution,
        { ...activeContribution, playerId: "player-nyla", secondsInactive: 55, objectiveParticipation: 0 }
      ],
      100,
      20
    );
    expect(rewards[0].xp).toBe(20);
    expect(rewards[1].xp).toBe(0);
    expect(rewards[1].earnedGold).toBe(0);
  });

  it("prevents locked maps from being joined or created", () => {
    const store = createDevStore();
    expect(() =>
      createLobby(store, "player-marky", {
        mapId: "tower-1-4",
        lobbyType: "PUBLIC",
        recommendedPower: 1200,
        heroId: "storm-archer"
      })
    ).toThrow(/locked/);
  });

  it("creates raid rewards through server-side ledger entries only", () => {
    const store = createDevStore();
    const player = getPlayerOrThrow(store, "player-marky");
    const before = player.balances.EARNED_GOLD;
    const raid = runPrototypeRaid(store, [activeContribution], {
      mapId: "tower-1-1",
      idempotencyKey: "raid-ledger"
    });
    expect(raid.rewards[0].earnedGold).toBeGreaterThan(0);
    expect(player.balances.EARNED_GOLD).toBeGreaterThan(before);
    expect(store.ledger.some((entry) => entry.referenceEntityId === raid.id && entry.sourceType === "RAID_REWARD")).toBe(
      true
    );
  });
});

describe("admin permissions and audit", () => {
  it("blocks Moderator from changing economy config", () => {
    const store = createDevStore();
    const moderator = store.admins.get("admin-moderator");
    expect(moderator).toBeDefined();
    expect(() =>
      publishConfig(store, moderator!, { configId: "config-1", highRisk: false, reason: "Try publish" })
    ).toThrow(/Missing permission/);
  });

  it("blocks Support from banning users", () => {
    const store = createDevStore();
    const support = store.admins.get("admin-support");
    expect(support).toBeDefined();
    expect(() =>
      moderatePlayer(store, support!, { playerId: "player-marky", action: "BAN", reason: "Support ban attempt" })
    ).toThrow(/Missing permission|Support/);
  });

  it("blocks Economy Manager from high-risk publishing without Owner approval", () => {
    const store = createDevStore();
    const economy = store.admins.get("admin-economy");
    expect(economy).toBeDefined();
    expect(() =>
      publishConfig(store, economy!, { configId: "config-2", highRisk: true, reason: "High risk publish" })
    ).toThrow(/Missing permission/);
  });

  it("records audit entries for administrative actions", () => {
    const store = createDevStore();
    const owner = store.admins.get("admin-owner");
    expect(owner).toBeDefined();
    moderatePlayer(store, owner!, { playerId: "player-marky", action: "MUTE", reason: "Test moderation audit" });
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0].actionType).toBe("MUTE");
  });

  it("releases buy-order escrow correctly through an admin cancellation", () => {
    const store = createDevStore();
    const owner = store.admins.get("admin-owner");
    const player = getPlayerOrThrow(store, "player-marky");
    player.balances.TEST_TOKEN = 1000;
    const order = createBuyOrder(store, player.id, {
      goldAmount: 100,
      pricePerGold: 2,
      idempotencyKey: "admin-cancel-order"
    });
    expect(player.balances.TEST_TOKEN).toBe(800);
    adminCancelBuyOrder(store, owner!, order.id, "Suspicious order cancellation");
    expect(player.balances.TEST_TOKEN).toBe(1000);
    expect(store.audits.some((entry) => entry.actionType === "ADMIN_CANCEL_BUY_ORDER")).toBe(true);
  });

  it("rejects DEV tools when DEV_MODE is false", () => {
    const store = createDevStore({ devMode: false });
    const owner = store.admins.get("admin-owner");
    expect(() =>
      devAdjustBalance(store, owner!, {
        playerId: "player-marky",
        balanceType: "TEST_TOKEN",
        amount: 10,
        reason: "Should not work outside DEV_MODE",
        idempotencyKey: "dev-disabled"
      })
    ).toThrow(/DEV tools/);
  });
});
