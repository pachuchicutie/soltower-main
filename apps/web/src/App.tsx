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
import { Backpack, BookOpen, ExternalLink, Map, Menu, MessageCircle, Settings, Speech, X, ZoomIn, ZoomOut } from "lucide-react";
import { economyConfig, type PlayerBootstrapData, type TownPosition, type TownServerId } from "@soltower/shared";
import { Hud } from "./components/Hud";
import { LandingPage } from "./components/LandingPage";
import { NpcModal } from "./components/NpcModal";
import { ProfilePanel } from "./components/ProfilePanel";
import { TownChat } from "./components/TownChat";
import { TownCanvas } from "./components/TownCanvas";
import { ErrorState, GameButton } from "./components/ui/GameUi";
import { ShortcutHint } from "./components/ui/ShortcutHint";
import type { NearbyInteraction } from "./game/TownScene";
import { useTownShortcuts } from "./hooks/useTownShortcuts";
import { apiGet, apiPost, isTowerGateErrorCode, WalletAuthError } from "./lib/api";
import { applyAudioSettings, pauseTownMusic, playUiSound, startTownMusic } from "./lib/audio";
import { emitMobileMovement } from "./lib/gameInput";
import { useHeroAppearance } from "./lib/heroAppearance";
import type { TownRealtimeStatus } from "./lib/realtime";
import { disconnectActiveWallet } from "./lib/wallets";
import type { ModalKey } from "./store/ui";
import { useUiStore } from "./store/ui";

type MeResponse = PlayerBootstrapData;
interface TownServerStatus {
  id: TownServerId;
  label: string;
  online: number;
  capacity: number;
}

interface TownServersResponse {
  servers: TownServerStatus[];
}

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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const latestTownPositionRef = useRef<TownPosition | undefined>(undefined);
  const setTownChannel = useCallback((nextTownChannel: TownServerId) => {
    saveLocalTownChannel(nextTownChannel);
    setTownChannelState(nextTownChannel);
  }, []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/api/player/me"),
    enabled: !disconnected,
    retry: false,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true
  });
  const servers = useQuery({
    queryKey: ["town-servers"],
    queryFn: () => apiGet<TownServersResponse>("/api/town/servers"),
    staleTime: 15000
  });
  const tokenGateError =
    me.error instanceof WalletAuthError && isTowerGateErrorCode(me.error.code)
      ? me.error
      : null;
  const activeBootstrap = tokenGateError ? undefined : me.data;
  const [heroAppearance] = useHeroAppearance(activeBootstrap?.selectedHeroId ?? "storm-archer");
  const restoredTownPosition = useMemo(() => {
    if (!activeBootstrap?.player) {
      return undefined;
    }
    return (
      loadLocalTownPosition(activeBootstrap.player.id, townChannel) ??
      activeBootstrap.townPosition
    );
  }, [activeBootstrap?.player, activeBootstrap?.townPosition, townChannel]);
  const townMusicEnabled = Boolean(activeBootstrap?.player);

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
      saveLocalTownPosition(activeBootstrap?.player.id, townChannel, position);
      void Promise.resolve(
        apiPost<{ position: TownPosition }>("/api/town/position", {
          townChannel,
          ...position
        })
      ).catch(() => undefined);
    },
    [activeBootstrap?.player.id, townChannel]
  );

  useEffect(() => {
    const playerId = activeBootstrap?.player.id;
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
  }, [activeBootstrap?.player.id, townChannel]);
  const controlsEnabled = !modal && !profileOpen && !chatOpen;

  useTownShortcuts({
    active: Boolean(activeBootstrap?.player),
    modal,
    profileOpen,
    onOpenModal: handleOpenModal,
    onCloseModal: closeModal,
    onCloseProfile: handleCloseProfile,
    onInteract: handleInteract
  });

  if (!activeBootstrap && me.isLoading && !disconnected) {
    return <div className="loading-screen">Lighting SolBloom lanterns...</div>;
  }

  if (tokenGateError) {
    return (
      <TokenGateRequiredScreen
        message={tokenGateError.message}
        checking={me.isFetching}
        onRetry={() => {
          void me.refetch();
        }}
        onDisconnect={() => logout.mutate()}
      />
    );
  }

  if (!activeBootstrap?.player) {
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
        playerId={activeBootstrap.player.id}
        playerName={activeBootstrap.player.displayName}
        onNpc={handleNpc}
        mode="game"
        selectedHeroId={activeBootstrap.selectedHeroId}
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
        player={activeBootstrap.player}
        walletShort={activeBootstrap.profile.shortenedWalletAddress}
        selectedHeroId={activeBootstrap.selectedHeroId}
        heroAppearance={heroAppearance}
        onOpen={handleOpenModal}
        onProfile={() => setProfileOpen(true)}
      />
      <ShortcutHint className="town-control-hint" decorative />
      <MobileMovePad />
      <TownChat
        playerId={activeBootstrap.player.id}
        displayName={activeBootstrap.player.displayName}
        townChannel={townChannel}
        realtimeOnline={realtimeOnline}
        realtimeConnected={realtimeStatus === "connected"}
        mobileOpen={chatOpen}
        keyboardEnabled={!modal && !profileOpen}
        onTownChannelChange={setTownChannel}
        onMobileClose={() => setChatOpen(false)}
        onLocalMessageSent={setChatBubble}
      />
      {/* Premium Floating Menu Button (Mobile) */}
      <button
        type="button"
        className="mobile-premium-menu-btn"
        aria-label="Open actions menu"
        onClick={() => setMobileActionsOpen(true)}
      >
        <Menu size={22} />
      </button>

      {/* Floating Interact Button (Mobile) - right side, always visible */}
      <button
        type="button"
        className={`mobile-premium-interact-btn ${!nearbyInteraction ? 'disabled' : ''}`}
        aria-label="Interact"
        onClick={nearbyInteraction ? handleInteract : undefined}
        disabled={!nearbyInteraction}
      >
        <Speech size={22} />
      </button>

      {mobileActionsOpen && (
        <div className="mobile-premium-menu-overlay" onClick={() => setMobileActionsOpen(false)}>
          <div className="mobile-premium-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-premium-menu-header">
              <strong>Quick Actions</strong>
              <button type="button" onClick={() => setMobileActionsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="mobile-premium-menu-grid">
              <button type="button" onClick={() => { setMobileActionsOpen(false); setChatOpen(true); }}>
                <MessageCircle size={20} />
                <span>Chat with Locals</span>
              </button>
              <button type="button" onClick={() => { setMobileActionsOpen(false); handleOpenModal("inventory"); }}>
                <Backpack size={20} />
                <span>Inventory</span>
              </button>
              <button type="button" onClick={() => { setMobileActionsOpen(false); handleOpenModal("quests"); }}>
                <BookOpen size={20} />
                <span>Quests</span>
              </button>
              {nearbyInteraction ? (
                <button
                  type="button"
                  className="mobile-premium-interact"
                  onClick={() => { setMobileActionsOpen(false); handleInteract(); }}
                >
                  <Speech size={20} />
                  <span>{nearbyInteraction.label}</span>
                </button>
              ) : null}
              <button type="button" onClick={() => { setMobileActionsOpen(false); setShowChannelModal(true); }}>
                <Map size={20} />
                <span>Switch Channel</span>
              </button>
              <button type="button" onClick={() => { setMobileActionsOpen(false); window.dispatchEvent(new CustomEvent('soltower:zoom-in')); }}>
                <ZoomIn size={20} />
                <span>Zoom In</span>
              </button>
              <button type="button" onClick={() => { setMobileActionsOpen(false); window.dispatchEvent(new CustomEvent('soltower:zoom-out')); }}>
                <ZoomOut size={20} />
                <span>Zoom Out</span>
              </button>
              <button type="button" onClick={() => { setMobileActionsOpen(false); handleOpenModal("settings"); }}>
                <Settings size={20} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy rail kept for desktop fallback */}
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
      {showChannelModal && (
        <div
          className="channel-modal-overlay"
          onClick={() => setShowChannelModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
        >
          <div
            className="channel-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "340px",
              padding: "16px",
              color: "#e2e8f0"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong>Switch Channel</strong>
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(servers.data?.servers ?? []).map((server) => {
                const isCurrent = server.id === townChannel;
                return (
                  <button
                    key={server.id}
                    onClick={() => {
                      if (!isCurrent) {
                        setTownChannel(server.id);
                        setShowChannelModal(false);
                      }
                    }}
                    disabled={isCurrent}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: isCurrent ? "#1e2937" : "#0f172a",
                      border: isCurrent ? "1px solid #64748b" : "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                      cursor: isCurrent ? "default" : "pointer",
                      textAlign: "left"
                    }}
                  >
                    <span>{server.label}</span>
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                      {server.online} / {server.capacity}
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ marginTop: "12px", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
              Switching updates your town instantly
            </p>
          </div>
        </div>
      )}
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

function TokenGateRequiredScreen({
  message,
  checking,
  onRetry,
  onDisconnect
}: {
  message: string;
  checking: boolean;
  onRetry: () => void;
  onDisconnect: () => void;
}) {
  return (
    <main className="token-gate-screen" role="alert" aria-labelledby="token-gate-title">
      <section className="token-gate-panel">
        <span className="game-eyebrow">Village Access Required</span>
        <h1 id="token-gate-title">
          Hold {economyConfig.tokenGate.playMinimumTower.toLocaleString()} {economyConfig.towerToken.symbol} to play
        </h1>
        <p>
          SolBloom Village is token gated. If this wallet drops below the required balance, your
          active session is blocked until the wallet holds enough {economyConfig.towerToken.symbol} again.
        </p>
        <ErrorState
          title="You need more TOWER to play"
          action={
            <a
              className="game-button game-button-primary"
              href={economyConfig.towerToken.jupiterSwapUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} aria-hidden="true" /> Buy on Jupiter
            </a>
          }
        >
          {message || (
            <>
              Sorry, you need at least {economyConfig.tokenGate.playMinimumTower.toLocaleString()}{" "}
              {economyConfig.towerToken.symbol} in this wallet before you can enter and play.
            </>
          )}
        </ErrorState>
        <div className="button-row">
          <GameButton variant="secondary" onClick={onRetry} disabled={checking}>
            {checking ? "Checking..." : "Check Again"}
          </GameButton>
          <GameButton variant="ghost" onClick={onDisconnect}>
            Disconnect Wallet
          </GameButton>
        </div>
      </section>
    </main>
  );
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
