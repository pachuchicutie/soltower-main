import { describe, expect, it } from "vitest";
import { getPaginatedRaidStages, getRaidStageUnlockState, raidChapters } from "./maps";

const mapOne = raidChapters[0];
const mapTwo = raidChapters[1];
const mapThree = raidChapters[2];

describe("raid stage progression", () => {
  it("unlocks stage 1-1 for a level 1 player", () => {
    expect(getRaidStageUnlockState("tower-1-1", 1, [])).toMatchObject({
      unlocked: true,
      completed: false,
      reason: null
    });
  });

  it("requires level 2 and stage 1-1 completion for stage 1-2", () => {
    expect(getRaidStageUnlockState("tower-1-2", 1, [])).toMatchObject({
      unlocked: false,
      reason: "Requires Account Level 2 and completion of Stage 1-1."
    });
    expect(getRaidStageUnlockState("tower-1-2", 2, [])).toMatchObject({
      unlocked: false,
      reason: "Requires completion of Stage 1-1."
    });
    expect(getRaidStageUnlockState("tower-1-2", 2, ["tower-1-1"])).toMatchObject({
      unlocked: true,
      completed: false
    });
  });

  it("requires level 10 and stage 1-9 completion for the Solheart Sentinel boss stage", () => {
    expect(getRaidStageUnlockState("tower-1-10", 9, ["tower-1-9"])).toMatchObject({
      unlocked: false,
      reason: "Requires Account Level 10 and completion of Stage 1-9."
    });
    expect(getRaidStageUnlockState("tower-1-10", 10, ["tower-1-8"])).toMatchObject({
      unlocked: false,
      reason: "Requires completion of Stage 1-9."
    });
    expect(getRaidStageUnlockState("tower-1-10", 10, ["tower-1-9"])).toMatchObject({
      unlocked: true
    });
  });

  it("keeps stage 2-1 locked behind level 11 and stage 1-10 completion", () => {
    expect(getRaidStageUnlockState("tower-2-1", 10, ["tower-1-10"])).toMatchObject({
      unlocked: false,
      reason: "Requires Account Level 11 and completion of Stage 1-10."
    });
    expect(getRaidStageUnlockState("tower-2-1", 11, [])).toMatchObject({
      unlocked: false,
      reason: "Requires completion of Stage 1-10."
    });
    expect(getRaidStageUnlockState("tower-2-1", 11, ["tower-1-10"])).toMatchObject({
      unlocked: false,
      reason: "Map 2: Emberfall Reach is locked for a later content update."
    });
  });

  it("allows replaying completed stages that remain within the player's progression", () => {
    expect(getRaidStageUnlockState("tower-1-3", 5, ["tower-1-1", "tower-1-2", "tower-1-3"])).toMatchObject({
      unlocked: true,
      completed: true
    });
  });
});

describe("raid battle layouts", () => {
  it("defines fixed defender circles and enemy road paths for every raid stage", () => {
    for (const stage of raidChapters.flatMap((chapter) => chapter.stages)) {
      expect(stage.battleLayout.defenderSlots).toHaveLength(4);
      expect(stage.battleLayout.enemyPath.length).toBeGreaterThanOrEqual(8);
      for (const point of [stage.battleLayout.base, ...stage.battleLayout.defenderSlots, ...stage.battleLayout.enemyPath]) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("places stage 1-1 guardians on the visible arena circles and routes enemies toward the wardstone", () => {
    const stage = mapOne.stages[0];
    expect(stage.battleLayout.defenderSlots.map(({ x, y, progress }) => ({ x, y, progress }))).toEqual([
      { x: 29, y: 77, progress: 0.45 },
      { x: 68, y: 77, progress: 0.12 },
      { x: 31, y: 39, progress: 0.78 },
      { x: 74, y: 31, progress: 0.22 }
    ]);
    expect(stage.battleLayout.enemyPath[0].x).toBeGreaterThan(stage.battleLayout.enemyPath.at(-1)!.x);
    expect(new Set(stage.battleLayout.enemyPath.map((point) => point.y)).size).toBeGreaterThan(6);
    expect(stage.battleLayout.base).toEqual({ x: 8, y: 24 });
  });

  it("does not reuse Map 1 paths for later chapters", () => {
    expect(mapTwo.stages[0].battleLayout.enemyPath).not.toEqual(mapOne.stages[0].battleLayout.enemyPath);
    expect(mapThree.stages[0].battleLayout.enemyPath).not.toEqual(mapTwo.stages[0].battleLayout.enemyPath);
  });

  it("uses the local Map 2 stage images and curved road paths in battle", () => {
    for (const stage of mapTwo.stages) {
      expect(stage.thumbnailPath).toMatch(new RegExp(`/assets/raids/stages/stage-2-${stage.stageIndex}-`));
      expect(stage.largePreviewPath).toBe(stage.thumbnailPath);
      expect(stage.battleLayout.enemyPath[0].x).toBeGreaterThan(stage.battleLayout.enemyPath.at(-1)!.x);
      expect(new Set(stage.battleLayout.enemyPath.map((point) => point.y)).size).toBeGreaterThan(3);
    }
  });
});

describe("raid stage pagination", () => {
  it("shows Map 1 stages 1-1 through 1-5 on page one and 1-6 through 1-10 on page two", () => {
    expect(getPaginatedRaidStages(mapOne.stages, 0).map((stage) => stage.stageNumber)).toEqual(["1-1", "1-2", "1-3", "1-4", "1-5"]);
    expect(getPaginatedRaidStages(mapOne.stages, 1).map((stage) => stage.stageNumber)).toEqual(["1-6", "1-7", "1-8", "1-9", "1-10"]);
  });

  it("keeps locked map data shaped as ten future progression stages", () => {
    expect(mapTwo.status).toBe("LOCKED");
    expect(mapTwo.stages).toHaveLength(10);
    expect(mapTwo.stages[0]).toMatchObject({
      id: "tower-2-1",
      name: "Emberfall Gate",
      recommendedAccountLevel: 11
    });
  });

  it("uses unique named stages for locked and future chapters instead of generic labels", () => {
    expect(mapTwo.stages.map((stage) => stage.name)).toEqual([
      "Emberfall Gate",
      "Cinderroot Bridge",
      "Smokestack Hollow",
      "Molten Cartway",
      "Soot Lantern Run",
      "Blazebark Thicket",
      "Kilnstone Rise",
      "Furnace Vale",
      "Obsidian Causeway",
      "Emberfall Warden"
    ]);
    expect(mapThree.stages.map((stage) => stage.name)).toEqual([
      "Stormpeak Foothold",
      "Cloudbreak Steps",
      "Thunderpine Shelf",
      "Galeglass Crossing",
      "Skyhorn Watch",
      "Tempest Ravine",
      "Aerie Rune Nest",
      "Lightning Cairns",
      "Starwind Approach",
      "Stormpeak Sovereign"
    ]);
    expect([...mapTwo.stages, ...mapThree.stages].some((stage) => /^Stage \d-\d+$/.test(stage.name))).toBe(false);
  });
});
