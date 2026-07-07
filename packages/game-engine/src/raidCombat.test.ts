import { describe, expect, it } from "vitest";
import {
  createRaidBattle,
  createRaidCombatants,
  getRaidBaseHp,
  RAID_ENERGY_MAX,
  RAID_ENERGY_REGEN_SECONDS,
  simulateRaidBattle,
  tickRaidBattle
} from "./raidCombat";
import { getRaidStageById } from "./maps";

describe("raid lane combat", () => {
  const stage = getRaidStageById("tower-1-1")!;

  it("assigns up to four guardians to distinct fixed lane posts", () => {
    const party = createRaidCombatants(
      Array.from({ length: 4 }, (_, index) => ({
        playerId: `player-${index}`,
        displayName: `Guardian ${index}`,
        heroId: "storm-archer",
        power: 520
      })),
      stage
    );
    expect(party.map((member) => member.position)).toEqual([0.45, 0.12, 0.78, 0.22]);
  });

  it("uses a curved stage 1-1 path that follows the map road", () => {
    const yPoints = new Set(stage.battleLayout.enemyPath.map((point) => point.y));
    expect(stage.battleLayout.base).toEqual({ x: 8, y: 24 });
    expect(stage.battleLayout.enemyPath[0]).toEqual({ x: 78, y: 75 });
    expect(yPoints.size).toBeGreaterThan(6);
  });

  it("damages enemies using their visual map-path distance", () => {
    let battle = createRaidBattle(stage, [
      { playerId: "storm", displayName: "Storm", heroId: "storm-archer", power: 500 }
    ]);

    for (let tick = 0; tick < 180; tick += 1) {
      battle = tickRaidBattle(battle, stage);
      if (battle.enemies.some((enemy) => enemy.hp > 0 && enemy.hp < enemy.maxHp) || battle.defeated > 0) {
        break;
      }
    }

    expect(battle.enemies.some((enemy) => enemy.hp > 0 && enemy.hp < enemy.maxHp) || battle.defeated > 0).toBe(true);
  });

  it("keeps the legacy lane posts available for callers without a stage layout", () => {
    const party = createRaidCombatants(
      Array.from({ length: 4 }, (_, index) => ({
        playerId: `player-${index}`,
        displayName: `Guardian ${index}`,
        heroId: "storm-archer",
        power: 520
      }))
    );
    expect(party.map((member) => member.position)).toEqual([0.3, 0.5, 0.69, 0.86]);
  });

  it("keeps attacks range-gated while enemies advance toward the base", () => {
    const result = simulateRaidBattle(stage, [
      { playerId: "marky", displayName: "Marky", heroId: "storm-archer", power: 600 }
    ]);
    expect(result.defeated + result.escaped).toBeGreaterThan(0);
    expect(result.baseHp).toBeLessThanOrEqual(getRaidBaseHp(stage.stageIndex));
  });

  it("supports both victory and defeat outcomes based on party power", () => {
    const strong = simulateRaidBattle(stage, [
      { playerId: "one", displayName: "One", heroId: "storm-archer", power: 1000 },
      { playerId: "two", displayName: "Two", heroId: "bombardier", power: 1000 }
    ]);
    const weak = simulateRaidBattle(stage, [
      { playerId: "one", displayName: "One", heroId: "coral-alchemist", power: 1 }
    ]);
    expect(strong.status).toBe("VICTORY");
    expect(weak.status).toBe("DEFEAT");
  });

  it("balances stage 1-1 as a starter-clearable raid for one real hero", () => {
    const stormResult = simulateRaidBattle(stage, [
      { playerId: "storm", displayName: "Storm", heroId: "storm-archer", power: 500 }
    ]);
    const tideResult = simulateRaidBattle(stage, [
      { playerId: "tide", displayName: "Tide", heroId: "tide-mage", power: 500 }
    ]);
    expect(stormResult.status).toBe("VICTORY");
    expect(tideResult.status).toBe("VICTORY");
    expect(Math.min(stormResult.baseHp, tideResult.baseHp)).toBeGreaterThan(0);
  });

  it("uses five energy with ten-minute regeneration", () => {
    expect(RAID_ENERGY_MAX).toBe(5);
    expect(RAID_ENERGY_REGEN_SECONDS).toBe(600);
  });
});
