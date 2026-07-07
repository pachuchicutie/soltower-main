export const questRewardBalanceConfig = {
  daily: {
    "daily-first-defense": { earnedGold: 4, xp: 60 },
    "daily-tower-watch": { earnedGold: 5, xp: 70 },
    "daily-party-up": { earnedGold: 6, xp: 90 },
    "daily-skill-in-motion": { earnedGold: 4, xp: 65 },
    "daily-bossbound": { earnedGold: 6, xp: 100 },
    "daily-steady-defender": { earnedGold: 4, xp: 60 }
  },
  weekly: {
    "weekly-full-crew": { earnedGold: 20, xp: 300 },
    "weekly-tower-vanguard": { earnedGold: 18, xp: 260 },
    "weekly-veteran-solbloom": { earnedGold: 22, xp: 340 }
  }
} as const;

export const questDailyGoldTarget = {
  practicalMin: 12,
  practicalMax: 20
} as const;
