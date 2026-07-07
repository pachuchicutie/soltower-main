import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Heart, Shield, Swords, Trophy, X } from "lucide-react";
import {
  createRaidBattle,
  raidEnemyAssets,
  tickRaidBattle,
  RAID_COMBAT_TICK_MS,
  type RaidBattleRuntime,
  type RaidBattlePoint,
  type RaidStageDefinition
} from "@soltower/game-engine";
import { heroAssetManifest, normalizeHeroId, type HeroId } from "@soltower/shared";
import { pauseTownMusic, playUiSound, startTownMusic } from "../../lib/audio";
import { useUserSettings } from "../../lib/userSettings";
import { GameButton } from "../ui/GameUi";

export interface RaidBattleMember {
  playerId: string;
  displayName: string;
  heroId: string;
  power: number;
}

interface RaidBattleOverlayProps {
  stage: RaidStageDefinition;
  members: RaidBattleMember[];
  startsAt: number;
  settling?: boolean;
  settlementError?: string | null;
  onVictory: () => void;
  onExit: () => void;
}

export function RaidBattleOverlay({
  stage,
  members,
  startsAt,
  settling = false,
  settlementError,
  onVictory,
  onExit
}: RaidBattleOverlayProps) {
  const [now, setNow] = useState(() => Date.now());
  const [battle, setBattle] = useState<RaidBattleRuntime>(() =>
    createRaidBattle(stage, members)
  );
  const completionReported = useRef(false);
  const [settings] = useUserSettings();
  const countdown = Math.max(0, Math.ceil((startsAt - now) / 1000));
  const activeEnemies = battle.enemies.filter((enemy) => enemy.hp > 0);
  const waveCount = stage.waves.length;
  const defenderSlots = stage.battleLayout.defenderSlots;
  const isAttackEvent = battle.lastEvent === "HIT" || battle.lastEvent === "DEFEAT_ENEMY";

  useEffect(() => {
    pauseTownMusic();
    playUiSound("raidStart");
    return () => {
      void startTownMusic();
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown > 0 || battle.status !== "ACTIVE") {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setBattle((current) => {
        const targetElapsed = Math.max(0, Date.now() - startsAt);
        let next = current;
        let catchupTicks = 0;
        while (
          next.status === "ACTIVE" &&
          next.elapsedMs + RAID_COMBAT_TICK_MS <= targetElapsed &&
          catchupTicks < 30
        ) {
          next = tickRaidBattle(next, stage, RAID_COMBAT_TICK_MS);
          catchupTicks += 1;
        }
        return next;
      });
    }, RAID_COMBAT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [battle.status, countdown, stage, startsAt]);

  useEffect(() => {
    if (battle.lastEvent === "HIT" || battle.lastEvent === "DEFEAT_ENEMY") {
      playUiSound("raidHit", { throttleMs: 90 });
    } else if (battle.lastEvent === "BASE_DAMAGE") {
      playUiSound("raidDamage", { throttleMs: 140 });
    }
  }, [battle.elapsedMs, battle.lastEvent]);

  useEffect(() => {
    if (battle.status === "VICTORY" && !completionReported.current) {
      completionReported.current = true;
      playUiSound("raidWin");
      onVictory();
    } else if (battle.status === "DEFEAT" && !completionReported.current) {
      completionReported.current = true;
      playUiSound("raidLose");
    }
  }, [battle.status, onVictory]);

  const resultTitle = useMemo(() => {
    if (battle.status === "VICTORY") return "Tower Defended";
    if (battle.status === "DEFEAT") return "Wardstone Lost";
    return null;
  }, [battle.status]);

  return (
    <div className="raid-battle-overlay" role="dialog" aria-modal="true" aria-label={`${stage.name} raid battle`}>
      <header className="raid-battle-hud">
        <div>
          <span className="game-eyebrow">{stage.chapterName}</span>
          <h2>{stage.stageNumber} {stage.name}</h2>
        </div>
        <div className="raid-battle-hud-stats">
          <span><Shield size={17} /> Wave {Math.min(battle.waveIndex + 1, waveCount)} / {waveCount}</span>
          <span><Heart size={17} /> Base {battle.baseHp} / {battle.baseMaxHp}</span>
          <span><Swords size={17} /> {battle.defeated} defeated</span>
        </div>
      </header>

      <main className={`raid-battlefield raid-event-${battle.lastEvent.toLowerCase()}`}>
        <img className="raid-battlefield-art" src={stage.largePreviewPath} alt="" />
        <div className="raid-lane" aria-label="Raid lane">
          <svg className="raid-path-guide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={pathToPolyline(stage.battleLayout.enemyPath)} />
          </svg>
          <div
            className="raid-base"
            style={{
              left: `${stage.battleLayout.base.x}%`,
              top: `${stage.battleLayout.base.y}%`
            }}
          >
            <Shield size={24} />
            <i style={{ width: `${(battle.baseHp / battle.baseMaxHp) * 100}%` }} />
          </div>

          {battle.combatants.map((combatant, index) => {
            const slot = defenderSlots[index] ?? defenderSlots[defenderSlots.length - 1];
            const target = findCombatTarget(
              activeEnemies,
              stage.battleLayout.enemyPath,
              slot,
              combatant.range
            );
            const targetPoint = target ? pointAlongPath(stage.battleLayout.enemyPath, target.progress) : null;
            const effectDelta = targetPoint
              ? {
                  x: targetPoint.x - slot.x,
                  y: targetPoint.y - slot.y
                }
              : null;
            const effectStyle = targetPoint
              ? ({
                  "--raid-effect-angle": `${Math.atan2(effectDelta!.y, effectDelta!.x)}rad`,
                  "--raid-effect-length": `${Math.max(44, Math.hypot(effectDelta!.x, effectDelta!.y) * 9)}px`,
                  "--raid-range-size": `${Math.max(18, combatant.range * 112)}vw`
                } as CSSProperties)
              : ({
                  "--raid-range-size": `${Math.max(18, combatant.range * 112)}vw`
                } as CSSProperties);
            return (
              <div
                className={`raid-guardian raid-guardian-${normalizeHeroId(combatant.heroId)}${isAttackEvent && target ? " attacking" : ""}${settings.showRaidRanges ? " showing-range" : ""}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  ...effectStyle
                }}
                key={combatant.playerId}
              >
                {settings.showRaidRanges ? <span className="raid-range-ring" aria-hidden="true" /> : null}
                <span className="raid-guardian-name">{combatant.displayName}</span>
                <RaidHeroSprite heroId={combatant.heroId} facing={slot.facing} label={combatant.displayName} />
                <small>{combatant.damage} DMG</small>
                {isAttackEvent && targetPoint ? <span className="raid-attack-effect" aria-hidden="true" /> : null}
              </div>
            );
          })}

          {activeEnemies.map((enemy) => {
            const asset = raidEnemyAssets[enemy.enemyKey as keyof typeof raidEnemyAssets];
            const point = pointAlongPath(stage.battleLayout.enemyPath, enemy.progress);
            return (
              <div
                className={`raid-enemy${enemy.boss ? " boss" : ""}`}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`
                }}
                key={enemy.id}
              >
                <span>{enemy.label}</span>
                <img src={asset?.assetPath} alt="" />
                <i><b style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} /></i>
              </div>
            );
          })}
        </div>

        {countdown > 0 ? (
          <div className="raid-countdown">
            <span>RAID STARTING</span>
            <strong>{countdown}</strong>
            <p>Defend the wardstone</p>
          </div>
        ) : null}

        {resultTitle ? (
          <div className={`raid-result-modal ${battle.status.toLowerCase()}`}>
            {battle.status === "VICTORY" ? <Trophy size={42} /> : <X size={42} />}
            <span>{battle.status}</span>
            <h2>{resultTitle}</h2>
            <p>
              {battle.status === "VICTORY"
                ? `${battle.defeated} enemies stopped across ${waveCount} waves.`
                : `${battle.escaped} enemies breached the wardstone.`}
            </p>
            {settling ? <small>Securing server rewards...</small> : null}
            {settlementError ? <small className="raid-settlement-error">{settlementError}</small> : null}
            <GameButton
              variant="primary"
              onClick={onExit}
              disabled={battle.status === "VICTORY" && settling}
            >
              Return to SolBloom
            </GameButton>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function pointAlongPath(path: RaidBattlePoint[], progress: number): RaidBattlePoint {
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

function pathToPolyline(path: RaidBattlePoint[]): string {
  return path.map((point) => `${point.x},${point.y}`).join(" ");
}

function findCombatTarget(
  enemies: RaidBattleRuntime["enemies"],
  path: RaidBattlePoint[],
  slot: RaidBattlePoint,
  range: number
): RaidBattleRuntime["enemies"][number] | undefined {
  return enemies
    .map((enemy) => ({
      enemy,
      distance: distanceBetween(slot, pointAlongPath(path, enemy.progress))
    }))
    .filter(({ distance }) => distance <= range * 115)
    .sort((left, right) => right.enemy.progress - left.enemy.progress)[0]?.enemy;
}

function distanceBetween(left: RaidBattlePoint, right: RaidBattlePoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function RaidHeroSprite({
  heroId,
  facing,
  label
}: {
  heroId: string;
  facing: "left" | "right" | "up" | "down";
  label: string;
}) {
  const normalizedHeroId = normalizeHeroId(heroId);
  const layout = raidHeroSpriteLayout(normalizedHeroId, facing);
  return (
    <span className="raid-hero-sprite-wrap" aria-label={label} role="img">
      <span
        className="raid-hero-sprite"
        style={{
          backgroundImage: `url("${layout.path}")`,
          "--raid-sprite-rows": layout.rows,
          "--raid-sprite-row": layout.row
        } as CSSProperties}
      />
    </span>
  );
}

function raidHeroSpriteLayout(heroId: HeroId, facing: "left" | "right" | "up" | "down") {
  if (
    heroId === "storm-archer" ||
    heroId === "tide-mage" ||
    heroId === "bombardier" ||
    heroId === "coral-alchemist"
  ) {
    const rowByFacing = {
      up: 3,
      left: 1,
      right: 5,
      down: 7
    } as const;
    return {
      path: `/assets/soltower/heroes/${heroId}/walk-8dir.png?v=video-all-directions`,
      rows: 8,
      row: rowByFacing[facing]
    };
  }
  const rowByFacing = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  } as const;
  return {
    path: heroAssetManifest[heroId].worldSpritePaths.walk,
    rows: 4,
    row: rowByFacing[facing]
  };
}
