import { describe, expect, it } from "vitest";
import {
  raidRealtimeEventSchema,
  townMovementBroadcastSchema,
  townRealtimePlayerSchema
} from "./multiplayer";
import { defaultHeroAppearance } from "./heroAssetManifest";

const player = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  playerId: "player-one",
  displayName: "Guardian One",
  heroId: "storm-archer",
  appearance: defaultHeroAppearance("storm-archer"),
  townChannel: "solbloom-1",
  x: 627,
  y: 776,
  facingX: 0,
  facingY: 1,
  moving: true,
  running: false,
  sequence: 12,
  sentAt: Date.now()
};

describe("realtime multiplayer payloads", () => {
  it("accepts bounded authenticated-town display state", () => {
    expect(townRealtimePlayerSchema.parse(player)).toMatchObject({
      playerId: "player-one",
      townChannel: "solbloom-1",
      sequence: 12
    });
  });

  it("rejects invalid movement coordinates and identity payloads", () => {
    expect(
      townMovementBroadcastSchema.safeParse({
        ...player,
        x: Number.POSITIVE_INFINITY
      }).success
    ).toBe(false);
    expect(
      townRealtimePlayerSchema.safeParse({
        ...player,
        displayName: ""
      }).success
    ).toBe(false);
  });

  it("validates synchronized raid start events", () => {
    expect(
      raidRealtimeEventSchema.safeParse({
        kind: "raid_start",
        runId: "00000000-0000-4000-8000-000000000002",
        lobbyId: "00000000-0000-4000-8000-000000000003",
        stageId: "tower-1-1",
        startsAt: Date.now() + 5000,
        sentAt: Date.now()
      }).success
    ).toBe(true);
  });
});
