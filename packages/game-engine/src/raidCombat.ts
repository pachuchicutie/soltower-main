import type { RaidBattlePoint, RaidStageDefinition } from "./maps";

export const RAID_ENERGY_MAX = 5;
export const RAID_ENERGY_COST = 1;
export const RAID_ENERGY_REGEN_SECONDS = 10 * 60;
export const RAID_COMBAT_TICK_MS = 100;
export const RAID_LANE_DURATION_SECONDS = 90;

export interface RaidCombatant {
  playerId: string;
  displayName: string;
  heroId: string;
  power: number;
  slot: number;
  position: number;
  range: number;
  damage: number;
  attacksPerSecond: number;
}

export interface RaidEnemyRuntime {
  id: string;
  enemyKey: string;
  label: string;
  hp: number;
  maxHp: number;
  speed: number;
  progress: number;
  boss: boolean;
}

export interface RaidBattleRuntime {
  elapsedMs: number;
  waveIndex: number;
  waveStarted: boolean;
  baseHp: number;
  baseMaxHp: number;
  enemies: RaidEnemyRuntime[];
  combatants: RaidCombatant[];
  cooldowns: Record<string, number>;
  defeated: number;
  escaped: number;
  status: "ACTIVE" | "VICTORY" | "DEFEAT";
  lastEvent: "NONE" | "HIT" | "DEFEAT_ENEMY" | "BASE_DAMAGE" | "WAVE_START" | "VICTORY" | "DEFEAT";
}

const heroCombatProfiles: Record<string, { range: number; damage: number; attacksPerSecond: number }> = {
  "storm-archer": { range: 0.3, damage: 26, attacksPerSecond: 1.15 },
  "tide-mage": { range: 0.27, damage: 20, attacksPerSecond: 0.95 },
  bombardier: { range: 0.24, damage: 34, attacksPerSecond: 0.7 },
  "coral-alchemist": { range: 0.25, damage: 18, attacksPerSecond: 1.05 },
  starcaller: { range: 0.28, damage: 17, attacksPerSecond: 1.2 }
};

const partyPosts: Record<number, number[]> = {
  1: [0.79],
  2: [0.58, 0.82],
  3: [0.43, 0.65, 0.84],
  4: [0.3, 0.5, 0.69, 0.86]
};

export function createRaidCombatants(
  members: Array<{ playerId: string; displayName: string; heroId: string; power: number }>,
  stage?: RaidStageDefinition
): RaidCombatant[] {
  const layoutPosts = stage?.battleLayout.defenderSlots.map((slot) => slot.progress);
  const posts = layoutPosts?.length
    ? layoutPosts
    : partyPosts[Math.min(4, Math.max(1, members.length))] ?? partyPosts[1];
  return members.slice(0, 4).map((member, index) => {
    const profile = heroCombatProfiles[member.heroId] ?? heroCombatProfiles["storm-archer"];
    const powerScale = Math.max(0.2, Math.min(2.4, member.power / 500));
    return {
      ...member,
      slot: index,
      position: posts[index] ?? posts[posts.length - 1],
      range: profile.range,
      damage: Math.round(profile.damage * powerScale),
      attacksPerSecond: profile.attacksPerSecond
    };
  });
}

export function getRaidBaseHp(stageIndex: number): number {
  return 760 + stageIndex * 85;
}

export function createRaidBattle(
  stage: RaidStageDefinition,
  members: Array<{ playerId: string; displayName: string; heroId: string; power: number }>
): RaidBattleRuntime {
  const baseHp = getRaidBaseHp(stage.stageIndex);
  return {
    elapsedMs: 0,
    waveIndex: 0,
    waveStarted: false,
    baseHp,
    baseMaxHp: baseHp,
    enemies: [],
    combatants: createRaidCombatants(members, stage),
    cooldowns: {},
    defeated: 0,
    escaped: 0,
    status: "ACTIVE",
    lastEvent: "NONE"
  };
}

export function tickRaidBattle(
  current: RaidBattleRuntime,
  stage: RaidStageDefinition,
  deltaMs = RAID_COMBAT_TICK_MS
): RaidBattleRuntime {
  if (current.status !== "ACTIVE") return current;

  const next: RaidBattleRuntime = {
    ...current,
    elapsedMs: current.elapsedMs + deltaMs,
    enemies: current.enemies.map((enemy) => ({ ...enemy })),
    cooldowns: { ...current.cooldowns },
    lastEvent: "NONE"
  };
  const wave = stage.waves[next.waveIndex];
  if (!wave) {
    return { ...next, status: "VICTORY", lastEvent: "VICTORY" };
  }

  if (!next.waveStarted) {
    next.enemies = spawnWaveEnemies(stage, next.waveIndex);
    next.waveStarted = true;
    next.lastEvent = "WAVE_START";
  }

  const stepSeconds = deltaMs / 1000;
  for (const enemy of next.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.progress = Math.min(1, enemy.progress + (enemy.speed / 100) * stepSeconds);
    if (enemy.progress >= 1) {
      enemy.hp = 0;
      next.escaped += 1;
      next.baseHp = Math.max(0, next.baseHp - Math.max(24, Math.round(enemy.maxHp * (enemy.boss ? 0.18 : 0.42))));
      next.lastEvent = "BASE_DAMAGE";
    }
  }

  for (const combatant of next.combatants) {
    const cooldown = Math.max(0, (next.cooldowns[combatant.playerId] ?? 0) - deltaMs);
    next.cooldowns[combatant.playerId] = cooldown;
    if (cooldown > 0) continue;
    const slot = stage.battleLayout.defenderSlots[combatant.slot];
    const combatantPoint = slot ?? pointAlongRaidPath(stage.battleLayout.enemyPath, combatant.position);
    const target = next.enemies
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => ({
        enemy,
        distance: distanceBetween(combatantPoint, pointAlongRaidPath(stage.battleLayout.enemyPath, enemy.progress))
      }))
      .filter(({ distance }) => distance <= combatant.range * 115)
      .sort((left, right) => right.enemy.progress - left.enemy.progress)[0]?.enemy;
    if (!target) continue;
    target.hp = Math.max(0, target.hp - combatant.damage);
    next.cooldowns[combatant.playerId] = Math.round(1000 / combatant.attacksPerSecond);
    next.lastEvent = target.hp === 0 ? "DEFEAT_ENEMY" : "HIT";
    if (target.hp === 0) next.defeated += 1;
  }

  if (next.baseHp <= 0) {
    return { ...next, status: "DEFEAT", lastEvent: "DEFEAT" };
  }
  if (next.enemies.every((enemy) => enemy.hp <= 0)) {
    if (next.waveIndex >= stage.waves.length - 1) {
      return { ...next, status: "VICTORY", lastEvent: "VICTORY" };
    }
    next.waveIndex += 1;
    next.waveStarted = false;
    next.enemies = [];
  }
  return next;
}

export function simulateRaidBattle(
  stage: RaidStageDefinition,
  members: Array<{ playerId: string; displayName: string; heroId: string; power: number }>,
  maxTicks = RAID_LANE_DURATION_SECONDS * (1000 / RAID_COMBAT_TICK_MS)
): RaidBattleRuntime {
  let state = createRaidBattle(stage, members);
  for (let tick = 0; tick < maxTicks && state.status === "ACTIVE"; tick += 1) {
    state = tickRaidBattle(state, stage);
  }
  if (state.status === "ACTIVE") {
    state = { ...state, status: "DEFEAT", lastEvent: "DEFEAT" };
  }
  return state;
}

function spawnWaveEnemies(stage: RaidStageDefinition, waveIndex: number): RaidEnemyRuntime[] {
  const wave = stage.waves[waveIndex];
  if (!wave) return [];
  const stageScale = 0.86 + stage.stageIndex * 0.045;
  return Array.from({ length: wave.count }, (_, index) => ({
    id: `${stage.id}-${wave.wave}-${index}`,
    enemyKey: wave.enemyKey,
    label: wave.enemy,
    hp: Math.round(wave.hp * stageScale),
    maxHp: Math.round(wave.hp * stageScale),
    speed: Math.max(4, wave.speed / 8.6) * (wave.boss ? 0.7 : 1),
    progress: Math.max(0, -index * 0.05),
    boss: Boolean(wave.boss)
  }));
}

function pointAlongRaidPath(path: RaidBattlePoint[], progress: number): RaidBattlePoint {
  if (path.length === 0) return { x: 50, y: 50 };
  if (path.length === 1) return path[0];
  const clamped = Math.max(0, Math.min(1, progress));
  const segments = path.slice(0, -1).map((point, index) => {
    const next = path[index + 1];
    return {
      from: point,
      to: next,
      length: Math.hypot(next.x - point.x, next.y - point.y)
    };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength <= 0) return path[0];
  let distance = clamped * totalLength;
  const segment = segments.find((candidate) => {
    if (distance <= candidate.length) return true;
    distance -= candidate.length;
    return false;
  }) ?? segments[segments.length - 1];
  const local = segment.length <= 0 ? 0 : distance / segment.length;
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * local,
    y: segment.from.y + (segment.to.y - segment.from.y) * local
  };
}

function distanceBetween(left: RaidBattlePoint, right: RaidBattlePoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}
