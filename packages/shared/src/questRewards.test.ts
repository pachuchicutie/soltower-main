import { describe, expect, it } from "vitest";
import { questDailyGoldTarget, questRewardBalanceConfig } from "./questRewards";

describe("quest reward balance config", () => {
  it("keeps the practical daily Earned Gold target conservative", () => {
    const dailyValues = Object.values(questRewardBalanceConfig.daily).map((reward) => reward.earnedGold);
    expect(Math.min(...dailyValues)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...dailyValues)).toBeLessThanOrEqual(6);
    expect(questDailyGoldTarget).toEqual({ practicalMin: 12, practicalMax: 20 });
  });

  it("uses the revised repeatable quest rewards", () => {
    expect(questRewardBalanceConfig.daily["daily-first-defense"]).toEqual({ earnedGold: 4, xp: 60 });
    expect(questRewardBalanceConfig.daily["daily-tower-watch"]).toEqual({ earnedGold: 5, xp: 70 });
    expect(questRewardBalanceConfig.daily["daily-party-up"]).toEqual({ earnedGold: 6, xp: 90 });
    expect(questRewardBalanceConfig.daily["daily-skill-in-motion"]).toEqual({ earnedGold: 4, xp: 65 });
    expect(questRewardBalanceConfig.daily["daily-bossbound"]).toEqual({ earnedGold: 6, xp: 100 });
    expect(questRewardBalanceConfig.daily["daily-steady-defender"]).toEqual({ earnedGold: 4, xp: 60 });
    expect(questRewardBalanceConfig.weekly["weekly-full-crew"]).toEqual({ earnedGold: 20, xp: 300 });
    expect(questRewardBalanceConfig.weekly["weekly-tower-vanguard"]).toEqual({ earnedGold: 18, xp: 260 });
    expect(questRewardBalanceConfig.weekly["weekly-veteran-solbloom"]).toEqual({ earnedGold: 22, xp: 340 });
  });
});
