import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Backpack, BookOpen, MessageCircle, Settings, Speech } from "lucide-react";
import type { PlayerBootstrapData, TownPosition, TownServerId } from "@soltower/shared";
import { Hud } from "./components/Hud";
import { LandingPage } from "./components/LandingPage";
import { NpcModal } from "./components/NpcModal";
import { ProfilePanel } from "./components/ProfilePanel";
import { TownChat } from "./components/TownChat";
import { TownCanvas } from "./components/TownCanvas";
import { ShortcutHint } from "./components/ui/ShortcutHint";
import type { NearbyInteraction } from "./game/TownScene";
import { useTownShortcuts } from "./hooks/useTownShortcuts";
import { apiGet, apiPost } from "./lib/api";
import { applyAudioSettings, pauseTownMusic, playUiSound, startTownMusic } from "./lib/audio";
import { emitMobileMovement } from "./lib/gameInput";
import { useHeroAppearance } from "./lib/heroAppearance";
import type { TownRealtimeStatus } from "./lib/realtime";
import { disconnectActiveWallet } from "./lib/wallets";
import type { ModalKey } from "./store/ui";
import { useUiStore } from "./store/ui";

type MeResponse = PlayerBootstrapData;
const WalletOnboardingModal = lazy(async () => {
  const module = await import("./components/WalletOnboardingModal");
  return { default: module.WalletOnboardingModal };
});

export function App() {
  const queryClient = useQueryClient();
  const { modal, openModal, closeModal } = useUiStore();
  const [walletOpen, setWalletOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [spectating, setSpectating] = useState(false);
  const [nearbyInteraction, setNearbyInteraction] = useState<NearbyInteraction | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [townChannel, setTownChannelState] = useState<TownServerId>(() => loadLocalTownChannel());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBubble, setChatBubble] = useState<{ id: string; text: string } | null>(null);
  const [realtimeOnline, setRealtimeOnline] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<TownRealtimeStatus>("connecting");
  const latestTownPositionRef = useRef<TownPosition | undefined>(undefined);
  const setTownChannel = useCallback((nextTownChannel: TownServerId) => {
    saveLocalTownChannel(nextTownChannel);
    setTownChannelState(nextTownChannel);
  }, []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/player/me"),
    enabled: !disconnected,
    retry: false
  });
  const [heroAppearance] = useHeroAppearance(me.data?.selectedHeroId ?? "storm-archer");
  const restoredTownPosition = useMemo(() => {
    if (!me.data?.player) {
      return undefined;
    }
    return (
      loadLocalTownPosition(me.data.player.id, townChannel) ??
      me.data.townPosition
    );
  }, [me.data?.player, me.data?.townPosition, townChannel]);
  const townMusicEnabled = Boolean(me.data?.player);

  useEffect(() => {
    if (restoredTownPosition) {
      latestTownPositionRef.current = restoredTownPosition;
    }
  }, [restoredTownPosition]);

  useEffect(() => {
    if (!townMusicEnabled) {
      pauseTownMusic();
      return undefined;
    }

    let disposed = false;
    let retryTimer: number | undefined;
    const removeUnlockListeners = () => {
      window.removeEventListener("pointerdown", tryStart);
      window.removeEventListener("keydown", tryStart);
      window.removeEventListener("touchstart", tryStart);
    };
    const clearRetry = () => {
      if (retryTimer !== undefined) {
        window.clearInterval(retryTimer);
        retryTimer = undefined;
      }
    };
    const tryStart = () => {
      void startTownMusic().then((started) => {
        if (started && !disposed) {
          clearRetry();
          removeUnlockListeners();
        }
      });
    };
    const onSettingsChanged = () => {
      applyAudioSettings();
      tryStart();
    };

    tryStart();
    retryTimer = window.setInterval(tryStart, 1200);
    window.addEventListener("pointerdown", tryStart);
    window.addEventListener("keydown", tryStart);
    window.addEventListener("touchstart", tryStart);
    window.addEventListener("focus", tryStart);
    window.addEventListener("pageshow", tryStart);
    window.addEventListener("soltower:user-settings-changed", onSettingsChanged);

    return () => {
      disposed = true;
      clearRetry();
      removeUnlockListeners();
      window.removeEventListener("focus", tryStart);
      window.removeEventListener("pageshow", tryStart);
      window.removeEventListener("soltower:user-settings-changed", onSettingsChanged);
      pauseTownMusic();
    };
  }, [townMusicEnabled]);

  const logout = useMutation({
    mutationFn: async () => {
      await apiPost<{ ok: boolean }>("/api/auth/logout", {});
      const { disconnectReownWallet } = await import("./lib/reown");
      await Promise.allSettled([disconnectReownWallet(), disconnectActiveWallet()]);
    },
    onSuccess: async () => {
      setProfileOpen(false);
      closeModal();
      setDisconnected(true);
      queryClient.removeQueries({ queryKey: ["me"] });
      queryClient.removeQueries({ queryKey: ["blackjack"] });
    }
  });

  const handleOpenModal = useCallback(
    (modalKey: ModalKey) => {
      playUiSound(isNpcModal(modalKey) ? "npcTalk" : "structureOpen", { throttleMs: 180 });
      openModal(modalKey);
    },
    [openModal]
  );

  const handleNpc = useCallback((npcId: ModalKey) => handleOpenModal(npcId), [handleOpenModal]);
  const handleInteract = useCallback(() => {
    if (nearbyInteraction) {
      handleOpenModal(nearbyInteraction.modal);
    }
  }, [handleOpenModal, nearbyInteraction]);
  const handleCloseProfile = useCallback(() => setProfileOpen(false), []);
  const handleTownPositionChange = useCallback(
    (position: TownPosition) => {
      latestTownPositionRef.current = position;
      saveLocalTownPosition(me.data?.player.id, townChannel, position);
      void Promise.resolve(
        apiPost<{ position: TownPosition }>("/api/town/position", {
          townChannel,
          ...position
        })
      ).catch(() => undefined);
    },
    [me.data?.player.id, townChannel]
  );

  useEffect(() => {
    const playerId = me.data?.player.id;
    if (!playerId) {
      return undefined;
    }

    const flushPosition = () => {
      const position = latestTownPositionRef.current;
      if (!position) {
        return;
      }
      saveLocalTownPosition(playerId, townChannel, position);
      void Promise.resolve(
        apiPost<{ position: TownPosition }>("/api/town/position", {
          townChannel,
          ...position
        })
      ).catch(() => undefined);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPosition();
      }
    };

    window.addEventListener("pagehide", flushPosition);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      flushPosition();
      window.removeEventListener("pagehide", flushPosition);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [me.data?.player.id, townChannel]);
  const controlsEnabled = !modal && !profileOpen && !chatOpen;

  useTownShortcuts({
    active: Boolean(me.data?.player),
    modal,
    profileOpen,
    onOpenModal: handleOpenModal,
    onCloseModal: closeModal,
    onCloseProfile: handleCloseProfile,
    onInteract: handleInteract
  });

  if (!me.data && me.isLoading && !disconnected) {
    return <div className="loading-screen">Lighting SolBloom lanterns...</div>;
  }

  if (!me.data?.player) {
    return (
      <>
        <LandingPage
          onPlay={() => setWalletOpen(true)}
          spectating={spectating}
          onSpectatingChange={setSpectating}
        />
        {walletOpen ? (
          <Suspense fallback={<div className="wallet-modal-loading">Opening wallet gate...</div>}>
            <WalletOnboardingModal
              onClose={() => setWalletOpen(false)}
              onSpectate={() => {
                setWalletOpen(false);
                setSpectating(true);
              }}
              onEntered={(bootstrap) => {
                setWalletOpen(false);
                setSpectating(false);
                setDisconnected(false);
                queryClient.setQueryData(["me"], bootstrap);
              }}
            />
          </Suspense>
        ) : null}
      </>
    );
  }

  return (
    <main className="game-shell">
      <TownCanvas
        playerId={me.data.player.id}
        playerName={me.data.player.displayName}
        onNpc={handleNpc}
        mode="game"
        selectedHeroId={me.data.selectedHeroId}
        heroAppearance={heroAppearance}
        controlsEnabled={controlsEnabled}
        onNearbyInteraction={setNearbyInteraction}
        cameraResetSignal={cameraResetSignal}
        chatBubbleId={chatBubble?.id}
        chatBubbleText={chatBubble?.text}
        initialPosition={restoredTownPosition}
        onPositionChange={handleTownPositionChange}
        townChannel={townChannel}
        onRealtimeOnlineChange={setRealtimeOnline}
        onRealtimeStatusChange={setRealtimeStatus}
      />
      <Hud
        player={me.data.player}
        walletShort={me.data.profile.shortenedWalletAddress}
        selectedHeroId={me.data.selectedHeroId}
        heroAppearance={heroAppearance}
        onOpen={handleOpenModal}
        onProfile={() => setProfileOpen(true)}
      />
      <ShortcutHint className="town-control-hint" decorative />
      <MobileMovePad />
      <TownChat
        playerId={me.data.player.id}
        displayName={me.data.player.displayName}
        townChannel={townChannel}
        realtimeOnline={realtimeOnline}
        realtimeConnected={realtimeStatus === "connected"}
        mobileOpen={chatOpen}
        keyboardEnabled={!modal && !profileOpen}
        onTownChannelChange={setTownChannel}
        onMobileClose={() => setChatOpen(false)}
        onLocalMessageSent={setChatBubble}
      />
      <div className="mobile-town-rail" aria-label="Town actions">
        <button type="button" onClick={() => setChatOpen(true)}>
          <MessageCircle size={18} /> Chat
        </button>
        <button type="button" onClick={() => handleOpenModal("inventory")}>
          <Backpack size={18} /> Inventory
        </button>
        <button type="button" onClick={() => handleOpenModal("quests")}>
          <BookOpen size={18} /> Quests
        </button>
        {nearbyInteraction ? (
          <button type="button" className="mobile-interact-command" onClick={handleInteract}>
            <Speech size={18} /> {nearbyInteraction.label}
          </button>
        ) : null}
        <button type="button" onClick={() => handleOpenModal("settings")}>
          <Settings size={18} /> Settings
        </button>
      </div>
      <div className="dev-ribbon">DEV_MODE: Test Token is mock-only. No wallet or on-chain transaction.</div>
      {modal ? (
        <NpcModal
          modal={modal}
          onClose={closeModal}
          onCenterCamera={() => setCameraResetSignal((value) => value + 1)}
          onLogout={() => logout.mutate()}
        />
      ) : null}
      {profileOpen ? (
        <ProfilePanel
          onClose={handleCloseProfile}
          onDisconnect={() => logout.mutate()}
          onOpenModal={handleOpenModal}
        />
      ) : null}
    </main>
  );
}

function isNpcModal(modalKey: ModalKey): boolean {
  return modalKey === "market-broker" || modalKey === "blacksmith" || modalKey === "tavern";
}

function localTownPositionKey(playerId: string, townChannel: TownServerId): string {
  return `soltower:town-position:${playerId}:${townChannel}`;
}

function saveLocalTownChannel(townChannel: TownServerId): void {
  try {
    localStorage.setItem("soltower:town-channel", townChannel);
  } catch {
    // Server selection remains usable when storage is unavailable.
  }
}

function loadLocalTownChannel(): TownServerId {
  try {
    const saved = localStorage.getItem("soltower:town-channel");
    if (
      saved === "solbloom-1" ||
      saved === "solbloom-2" ||
      saved === "solbloom-3" ||
      saved === "solbloom-4" ||
      saved === "solbloom-5"
    ) {
      return saved;
    }
  } catch {
    // Fall back to the first town server when storage is unavailable.
  }
  return "solbloom-1";
}

function saveLocalTownPosition(
  playerId: string | undefined,
  townChannel: TownServerId,
  position: TownPosition
): void {
  if (!playerId) {
    return;
  }
  try {
    localStorage.setItem(
      localTownPositionKey(playerId, townChannel),
      JSON.stringify(position)
    );
  } catch {
    // Server persistence remains the fallback when storage is unavailable.
  }
}

function loadLocalTownPosition(
  playerId: string,
  townChannel: TownServerId
): TownPosition | undefined {
  try {
    const raw = localStorage.getItem(localTownPositionKey(playerId, townChannel));
    if (!raw) {
      return undefined;
    }
    const position = JSON.parse(raw) as Partial<TownPosition>;
    if (
      typeof position.x !== "number" ||
      typeof position.y !== "number" ||
      typeof position.facingX !== "number" ||
      typeof position.facingY !== "number"
    ) {
      return undefined;
    }
    return {
      x: position.x,
      y: position.y,
      facingX: position.facingX,
      facingY: position.facingY
    };
  } catch {
    return undefined;
  }
}

function MobileMovePad() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false, running: false });

  const updateMovement = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) {
      return;
    }
    const rect = pad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const maxRadius = rect.width * 0.42;
    const distance = Math.min(maxRadius, Math.hypot(rawX, rawY));
    const deadZone = maxRadius * 0.18;
    if (distance < deadZone) {
      setStick({ x: 0, y: 0, active: true, running: false });
      emitMobileMovement({ active: false, x: 0, y: 0, running: false });
      return;
    }
    const normalizedX = rawX / Math.max(distance, 1);
    const normalizedY = rawY / Math.max(distance, 1);
    const strength = distance / maxRadius;
    const running = strength >= 0.72;
    setStick({
      x: normalizedX * distance,
      y: normalizedY * distance,
      active: true,
      running
    });
    emitMobileMovement({
      active: true,
      x: normalizedX,
      y: normalizedY,
      running
    });
  }, []);

  const stopMovement = useCallback(() => {
    setStick({ x: 0, y: 0, active: false, running: false });
    emitMobileMovement({ active: false, x: 0, y: 0, running: false });
  }, []);

  return (
    <div
      ref={padRef}
      className={`mobile-move-pad ${stick.running ? "is-running" : ""}`}
      aria-label="Move pad"
      role="application"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateMovement(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateMovement(event.clientX, event.clientY);
        }
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        stopMovement();
      }}
      onPointerCancel={stopMovement}
    >
      <span className="mobile-move-pad-ring" aria-hidden="true" />
      <span
        className="mobile-move-pad-stick"
        aria-hidden="true"
        style={{
          transform: `translate(${stick.x}px, ${stick.y}px)`
        }}
      />
      <span className="mobile-move-pad-label">{stick.running ? "Run" : "Walk"}</span>
    </div>
  );
}
