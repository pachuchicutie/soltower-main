import { useCallback, useEffect, useRef } from "react";
import Phaser from "phaser";
import {
  defaultHeroAppearance,
  normalizeHeroAppearance,
  normalizeHeroId,
  type HeroAppearance,
  type TownPosition,
  type TownRealtimePlayer,
  type TownServerId
} from "@soltower/shared";
import { TownScene, type NearbyInteraction } from "../game/TownScene";
import {
  TownRealtimeSession,
  type LocalTownMovement,
  type TownRealtimeStatus
} from "../lib/realtime";
import type { ModalKey } from "../store/ui";

const REMOTE_PLAYER_VISIBLE_UNTIL_MS = 20000;

interface TownCanvasProps {
  playerName: string;
  playerId?: string;
  onNpc: (npcId: ModalKey) => void;
  mode?: "landing" | "spectate" | "game";
  selectedHeroId?: string;
  heroAppearance?: HeroAppearance;
  controlsEnabled?: boolean;
  onNearbyInteraction?: (interaction: NearbyInteraction | null) => void;
  cameraResetSignal?: number;
  chatBubbleId?: string;
  chatBubbleText?: string;
  initialPosition?: TownPosition;
  onPositionChange?: (position: TownPosition) => void;
  townChannel?: TownServerId;
  onRealtimeOnlineChange?: (online: number) => void;
  onRealtimeStatusChange?: (status: TownRealtimeStatus) => void;
}

export function TownCanvas({
  playerName,
  playerId,
  onNpc,
  mode = "game",
  selectedHeroId,
  heroAppearance,
  controlsEnabled = true,
  onNearbyInteraction,
  cameraResetSignal = 0,
  chatBubbleId,
  chatBubbleText,
  initialPosition,
  onPositionChange,
  townChannel = "solbloom-1",
  onRealtimeOnlineChange,
  onRealtimeStatusChange
}: TownCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<TownScene | null>(null);
  const realtimeSessionRef = useRef<TownRealtimeSession | null>(null);
  const remotePlayersRef = useRef<TownRealtimePlayer[]>([]);
  // Stable refs so identity/callback prop churn does not tear down the realtime socket.
  const playerNameRef = useRef(playerName);
  const selectedHeroIdRef = useRef(selectedHeroId);
  const heroAppearanceRef = useRef(heroAppearance);
  const initialPositionRef = useRef(initialPosition);
  const onRealtimeOnlineChangeRef = useRef(onRealtimeOnlineChange);
  const onRealtimeStatusChangeRef = useRef(onRealtimeStatusChange);

  playerNameRef.current = playerName;
  selectedHeroIdRef.current = selectedHeroId;
  heroAppearanceRef.current = heroAppearance;
  initialPositionRef.current = initialPosition;
  onRealtimeOnlineChangeRef.current = onRealtimeOnlineChange;
  onRealtimeStatusChangeRef.current = onRealtimeStatusChange;

  const publishRealtimeMovement = useCallback((movement: LocalTownMovement) => {
    realtimeSessionRef.current?.publishMovement(movement);
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const scene = new TownScene({
      playerName,
      onNpc,
      mode,
      selectedHeroId,
      heroAppearance,
      controlsEnabled,
      onNearbyInteraction,
      chatBubbleId,
      chatBubbleText,
      initialPosition,
      onPositionChange,
      onRealtimePositionChange: publishRealtimeMovement
    });
    sceneRef.current = scene;
    scene.syncRemotePlayers(remotePlayersRef.current);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: "#101826",
      pixelArt: true,
      audio: {
        noAudio: true
      },
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [scene]
    });
    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
    // Scene is intentionally recreated only when mode/playerName change — not on every prop tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, playerName, publishRealtimeMovement]);

  useEffect(() => {
    sceneRef.current?.updateOptions({
      onNpc,
      selectedHeroId,
      heroAppearance,
      controlsEnabled,
      onNearbyInteraction,
      chatBubbleId,
      chatBubbleText,
      onPositionChange,
      onRealtimePositionChange: publishRealtimeMovement
    });
  }, [
    chatBubbleId,
    chatBubbleText,
    controlsEnabled,
    heroAppearance,
    onNearbyInteraction,
    onNpc,
    onPositionChange,
    publishRealtimeMovement,
    selectedHeroId
  ]);

  useEffect(() => {
    if (mode !== "game" || !playerId) {
      remotePlayersRef.current = [];
      sceneRef.current?.syncRemotePlayers([], true);
      onRealtimeOnlineChangeRef.current?.(0);
      return undefined;
    }
    const heroId = normalizeHeroId(selectedHeroIdRef.current);
    const appearance = normalizeHeroAppearance(
      heroId,
      heroAppearanceRef.current ?? defaultHeroAppearance(heroId)
    );
    const spawnPosition = initialPositionRef.current ?? {
      x: 627,
      y: 776,
      facingX: 0,
      facingY: 1
    };
    let session: TownRealtimeSession;
    try {
      session = new TownRealtimeSession({
        playerId,
        displayName: playerNameRef.current,
        heroId,
        appearance,
        townChannel,
        initialPosition: spawnPosition,
        onPresence: (players) => {
          const visiblePlayers = mergeRemotePlayers(remotePlayersRef.current, players);
          remotePlayersRef.current = visiblePlayers;
          sceneRef.current?.syncRemotePlayers(visiblePlayers);
          onRealtimeOnlineChangeRef.current?.(visiblePlayers.length + 1);
        },
        onMovement: (movement) => {
          remotePlayersRef.current = mergeRemotePlayers(remotePlayersRef.current, [movement]);
          sceneRef.current?.applyRemoteMovement(movement);
          onRealtimeOnlineChangeRef.current?.(remotePlayersRef.current.length + 1);
        },
        onStatus: (status) => onRealtimeStatusChangeRef.current?.(status)
      });
    } catch {
      onRealtimeStatusChangeRef.current?.("error");
      return undefined;
    }
    realtimeSessionRef.current = session;
    session.connect();
    return () => {
      realtimeSessionRef.current = null;
      remotePlayersRef.current = [];
      sceneRef.current?.syncRemotePlayers([], true);
      void session.disconnect();
    };
    // Only reconnect when the player identity or town server changes — not when position
    // snapshots / appearance object identity / parent callbacks churn every render.
  }, [mode, playerId, townChannel]);

  // Push cosmetic/name updates into the live session without reconnecting.
  useEffect(() => {
    const session = realtimeSessionRef.current;
    if (!session || mode !== "game" || !playerId) {
      return;
    }
    const heroId = normalizeHeroId(selectedHeroId);
    session.updateIdentity({
      displayName: playerName,
      heroId,
      appearance: normalizeHeroAppearance(heroId, heroAppearance ?? defaultHeroAppearance(heroId))
    });
  }, [heroAppearance, mode, playerId, playerName, selectedHeroId]);

  useEffect(() => {
    if (cameraResetSignal > 0) {
      sceneRef.current?.centerCameraOnPlayer(true);
    }
  }, [cameraResetSignal]);

  return (
    <div
      ref={containerRef}
      className={`town-canvas town-canvas-${mode}`}
      aria-label="SolBloom Village town hub"
      tabIndex={mode === "spectate" ? 0 : -1}
    />
  );
}

function mergeRemotePlayers(
  currentPlayers: TownRealtimePlayer[],
  incomingPlayers: TownRealtimePlayer[]
): TownRealtimePlayer[] {
  const freshSince = Date.now() - REMOTE_PLAYER_VISIBLE_UNTIL_MS;
  const playersById = new Map<string, TownRealtimePlayer>();
  for (const player of currentPlayers) {
    if (player.sentAt >= freshSince) {
      playersById.set(player.playerId, player);
    }
  }
  for (const player of incomingPlayers) {
    if (player.sentAt < freshSince) {
      continue;
    }
    const current = playersById.get(player.playerId);
    if (!current || isNewerRemotePlayer(player, current)) {
      playersById.set(player.playerId, player);
    }
  }
  return [...playersById.values()];
}

function isNewerRemotePlayer(candidate: TownRealtimePlayer, current: TownRealtimePlayer): boolean {
  if (candidate.sessionId !== current.sessionId) {
    return candidate.sentAt >= current.sentAt;
  }
  if (candidate.sequence !== current.sequence) {
    return candidate.sequence > current.sequence;
  }
  return candidate.sentAt >= current.sentAt;
}
