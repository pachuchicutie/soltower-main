const BASE_ACCOUNT_XP = 100;
const ACCOUNT_XP_STEP = 50;

function normalizeWholeNumber(value: number, minimum = 0) {
  return Math.max(minimum, Math.floor(Number.isFinite(value) ? value : minimum));
}

export function getXpRequiredForLevel(accountLevel: number) {
  const level = normalizeWholeNumber(accountLevel, 1);
  return BASE_ACCOUNT_XP + (level - 1) * ACCOUNT_XP_STEP;
}

export function applyAccountXp(accountLevel: number, currentXp: number, earnedXp: number) {
  let level = normalizeWholeNumber(accountLevel, 1);
  let xp = normalizeWholeNumber(currentXp) + normalizeWholeNumber(earnedXp);
  const startingLevel = level;

  while (xp >= getXpRequiredForLevel(level)) {
    xp -= getXpRequiredForLevel(level);
    level += 1;
  }

  return {
    accountLevel: level,
    xp,
    xpToNextLevel: getXpRequiredForLevel(level),
    levelsGained: level - startingLevel
  };
}

export function getAccountXpProgress(accountLevel: number, xp: number) {
  const normalized = applyAccountXp(accountLevel, xp, 0);

  return {
    currentXp: normalized.xp,
    xpToNextLevel: normalized.xpToNextLevel,
    percent: Math.min(100, Math.max(0, (normalized.xp / normalized.xpToNextLevel) * 100))
  };
}
