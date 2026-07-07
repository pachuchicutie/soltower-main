import { economyConfig } from "@soltower/shared";

export interface RaidContributionInput {
  playerId: string;
  damage: number;
  bossDamage: number;
  slowValue: number;
  debuffValue: number;
  shieldValue: number;
  buffValue: number;
  activeSkillUses: number;
  objectiveParticipation: number;
  secondsInactive: number;
}

export interface RaidReward {
  playerId: string;
  earnedGold: number;
  xp: number;
  contributionScore: number;
  active: boolean;
}

export const partyRewardMultipliers: Record<number, number> = {
  1: 1,
  2: 1.8,
  3: 2.6,
  4: 3.4
};

export function isActiveContribution(contribution: RaidContributionInput): boolean {
  return contribution.secondsInactive <= 20 && contribution.objectiveParticipation > 0;
}

export function calculateContributionScore(contribution: RaidContributionInput): number {
  return Math.max(
    0,
    contribution.damage * 1 +
      contribution.bossDamage * 1.3 +
      contribution.slowValue * 0.8 +
      contribution.debuffValue * 0.85 +
      contribution.shieldValue * 0.7 +
      contribution.buffValue * 0.75 +
      contribution.activeSkillUses * 35 +
      contribution.objectiveParticipation * 20
  );
}

export function calculateRaidRewards(
  contributions: RaidContributionInput[],
  baseGold = economyConfig.raidBaseGoldReward,
  baseXp = economyConfig.raidBaseXpReward
): RaidReward[] {
  const active = contributions.filter(isActiveContribution);
  if (active.length === 0) {
    return contributions.map((entry) => ({
      playerId: entry.playerId,
      earnedGold: 0,
      xp: 0,
      contributionScore: 0,
      active: false
    }));
  }

  const partySize = Math.min(Math.max(contributions.length, 1), 4);
  const pool = Math.floor(baseGold * partyRewardMultipliers[partySize]);
  const equalPool = Math.floor(pool * 0.7);
  const contributionPool = pool - equalPool;
  const equalShare = Math.floor(equalPool / active.length);
  const scores = new Map(active.map((entry) => [entry.playerId, calculateContributionScore(entry)]));
  const scoreTotal = Array.from(scores.values()).reduce((sum, value) => sum + value, 0);

  return contributions.map((entry) => {
    const activePlayer = isActiveContribution(entry);
    const score = scores.get(entry.playerId) ?? 0;
    const contributionShare = scoreTotal > 0 ? Math.floor((score / scoreTotal) * contributionPool) : 0;
    return {
      playerId: entry.playerId,
      earnedGold: activePlayer ? equalShare + contributionShare : 0,
      xp: activePlayer ? baseXp : 0,
      contributionScore: score,
      active: activePlayer
    };
  });
}
