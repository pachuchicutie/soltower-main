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
      sceneRef.current?.syncRemotePlayers([]);
      onRealtimeOnlineChange?.(0);
      return undefined;
    }
    const heroId = normalizeHeroId(selectedHeroId);
    let session: TownRealtimeSession;
    try {
      session = new TownRealtimeSession({
        playerId,
        displayName: playerName,
        heroId,
        appearance: normalizeHeroAppearance(
          heroId,
          heroAppearance ?? defaultHeroAppearance(heroId)
        ),
        townChannel,
        initialPosition: initialPosition ?? {
          x: 627,
          y: 776,
          facingX: 0,
          facingY: 1
        },
        onPresence: (players) => {
          remotePlayersRef.current = players;
          sceneRef.current?.syncRemotePlayers(players);
          onRealtimeOnlineChange?.(players.length + 1);
        },
        onMovement: (movement) => {
          sceneRef.current?.applyRemoteMovement(movement);
        },
        onStatus: onRealtimeStatusChange
      });
    } catch {
      onRealtimeStatusChange?.("error");
      return undefined;
    }
    realtimeSessionRef.current = session;
    session.connect();
    return () => {
      realtimeSessionRef.current = null;
      remotePlayersRef.current = [];
      sceneRef.current?.syncRemotePlayers([]);
      void session.disconnect();
    };
  }, [
    heroAppearance,
    initialPosition,
    mode,
    onRealtimeOnlineChange,
    onRealtimeStatusChange,
    playerId,
    playerName,
    selectedHeroId,
    townChannel
  ]);

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
