import { calculateRaidRewards, mapDefinitions, type RaidContributionInput } from "@soltower/game-engine";
import { type DevStore, type RaidLobbyRecord, type RaidRunRecord, makeId, nowIso } from "../data/store";
import { applyLedgerMutation, getPlayerOrThrow } from "./economy";

export function assertMapUnlocked(store: DevStore, playerId: string, mapId: string): void {
  const player = getPlayerOrThrow(store, playerId);
  if (!player.unlockedMaps.includes(mapId)) {
    throw new Error("Map is locked for this player");
  }
}

export function createLobby(
  store: DevStore,
  playerId: string,
  input: { mapId: string; lobbyType: RaidLobbyRecord["lobbyType"]; recommendedPower: number; heroId: RaidLobbyRecord["members"][number]["heroId"] }
): RaidLobbyRecord {
  assertMapUnlocked(store, playerId, input.mapId);
  const player = getPlayerOrThrow(store, playerId);
  const lobby: RaidLobbyRecord = {
    id: makeId("lobby"),
    hostPlayerId: playerId,
    lobbyType: input.lobbyType,
    mapId: input.mapId,
    recommendedPower: input.recommendedPower,
    status: "OPEN",
    members: [
      {
        playerId,
        displayName: player.displayName,
        heroId: input.heroId,
        accountLevel: player.accountLevel,
        power: player.power,
        ready: true,
        host: true
      }
    ],
    createdAt: nowIso()
  };
  store.lobbies.set(lobby.id, lobby);
  return lobby;
}

export function joinLobby(store: DevStore, playerId: string, lobbyId: string): RaidLobbyRecord {
  const lobby = store.lobbies.get(lobbyId);
  if (!lobby || lobby.status !== "OPEN") {
    throw new Error("Lobby is not open");
  }
  if (lobby.members.length >= 4) {
    throw new Error("Lobby is full");
  }
  assertMapUnlocked(store, playerId, lobby.mapId);
  if (lobby.members.some((member) => member.playerId === playerId)) {
    return lobby;
  }
  const player = getPlayerOrThrow(store, playerId);
  lobby.members.push({
    playerId,
    displayName: player.displayName,
    heroId: player.selectedHeroId,
    accountLevel: player.accountLevel,
    power: player.power,
    ready: false,
    host: false
  });
  return lobby;
}

export function setLobbyReady(store: DevStore, playerId: string, lobbyId: string, ready: boolean): RaidLobbyRecord {
  const lobby = store.lobbies.get(lobbyId);
  if (!lobby || lobby.status !== "OPEN") {
    throw new Error("Lobby is not open");
  }
  const member = lobby.members.find((entry) => entry.playerId === playerId);
  if (!member) {
    throw new Error("Player is not in lobby");
  }
  member.ready = ready;
  return lobby;
}

export function runPrototypeRaid(
  store: DevStore,
  contributions: RaidContributionInput[],
  options?: { mapId?: string; lobbyId?: string | null; idempotencyKey?: string }
): RaidRunRecord {
  const idempotencyKey = options?.idempotencyKey ?? `raid:${makeId("run")}`;
  const existingReference = store.idempotency.get(idempotencyKey);
  if (existingReference?.type === "raid-run") {
    const raid = store.raids.find((entry) => entry.id === existingReference.id);
    if (!raid) {
      throw new Error("Idempotency reference is corrupt");
    }
    return raid;
  }
  const mapId = options?.mapId ?? "tower-1-1";
  contributions.forEach((entry) => assertMapUnlocked(store, entry.playerId, mapId));
  const map = mapDefinitions.find((entry) => entry.id === mapId) ?? mapDefinitions[0];
  const rewards = calculateRaidRewards(contributions, map.baseGoldReward, map.baseXpReward);
  const raid: RaidRunRecord = {
    id: makeId("raid"),
    lobbyId: options?.lobbyId ?? null,
    mapId,
    success: true,
    durationSeconds: 60,
    contributions,
    rewards,
    createdAt: nowIso()
  };

  rewards.forEach((reward) => {
    if (reward.earnedGold > 0) {
      applyLedgerMutation(store, {
        playerId: reward.playerId,
        balanceType: "EARNED_GOLD",
        sourceType: "RAID_REWARD",
        amount: reward.earnedGold,
        direction: "CREDIT",
        reason: "Prototype raid reward",
        idempotencyKey: `${idempotencyKey}:reward:${reward.playerId}`,
        metadata: { raidId: raid.id, mapId, active: reward.active },
        referenceEntityType: "RaidRun",
        referenceEntityId: raid.id
      });
    }
    const player = getPlayerOrThrow(store, reward.playerId);
    player.xp += reward.xp;
  });

  store.raids.push(raid);
  store.idempotency.set(idempotencyKey, { type: "raid-run", id: raid.id });
  return raid;
}
