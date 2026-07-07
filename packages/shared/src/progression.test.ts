import { describe, expect, it } from "vitest";
import {
  applyAccountXp,
  getAccountXpProgress,
  getXpRequiredForLevel
} from "./progression";

describe("account XP progression", () => {
  it("uses the shared increasing XP curve", () => {
    expect(getXpRequiredForLevel(1)).toBe(100);
    expect(getXpRequiredForLevel(2)).toBe(150);
    expect(getXpRequiredForLevel(10)).toBe(550);
  });

  it("carries XP across multiple account levels", () => {
    expect(applyAccountXp(1, 90, 200)).toEqual({
      accountLevel: 3,
      xp: 40,
      xpToNextLevel: 200,
      levelsGained: 2
    });
  });

  it("returns a bounded HUD progress percentage", () => {
    expect(getAccountXpProgress(1, 25)).toEqual({
      currentXp: 25,
      xpToNextLevel: 100,
      percent: 25
    });
    expect(getAccountXpProgress(1, 500)).toEqual({
      currentXp: 50,
      xpToNextLevel: 250,
      percent: 20
    });
  });
});
