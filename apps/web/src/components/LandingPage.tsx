import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  LockKeyhole,
  Menu,
  MessageCircle,
  Play,
  Send,
  X
} from "lucide-react";
import { apiGet } from "../lib/api";
import { isEditableTarget } from "../lib/gameInput";
import { TownCanvas } from "./TownCanvas";
import type { ModalKey } from "../store/ui";
import { GameButton, IconButton, StatusPill } from "./ui/GameUi";

interface PublicStats {
  devMode: boolean;
  testWorldActive: boolean;
  demoPresenceCount: number;
  activeTownCount: number;
}

interface LandingPageProps {
  onPlay: () => void;
  spectating?: boolean;
  onSpectatingChange?: (spectating: boolean) => void;
}

export function LandingPage({
  onPlay,
  spectating: controlledSpectating,
  onSpectatingChange
}: LandingPageProps) {
  const [internalSpectating, setInternalSpectating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<PublicStats | null | undefined>();
  const spectating = controlledSpectating ?? internalSpectating;

  useEffect(() => {
    void apiGet<PublicStats>("/api/public/stats").then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!spectating) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing && !isEditableTarget(event.target)) {
        event.preventDefault();
        setSpectating(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spectating]);

  function setSpectating(value: boolean) {
    setInternalSpectating(value);
    onSpectatingChange?.(value);
    if (!value) {
      setNotice(null);
    }
  }

  const onNpc = useCallback(
    (_npcId: ModalKey) => {
      if (spectating) {
        setNotice("Connect a wallet and enter SolBloom Village to interact.");
      }
    },
    [spectating]
  );

  return (
    <main
      className={`landing-shell ${spectating ? "is-spectating" : ""}`}
      data-mode={spectating ? "spectate" : "landing"}
    >
      <TownCanvas
        playerName="Visitor"
        onNpc={onNpc}
        mode={spectating ? "spectate" : "landing"}
      />
      <div className="landing-world-vignette" />

      {spectating ? (
        <header className="spectate-bar">
          <strong>SolTower</strong>
          <div>
            <GameButton variant="secondary" onClick={() => setSpectating(false)}>
              <X size={17} /> Exit Spectate
            </GameButton>
            <GameButton variant="primary" onClick={onPlay}>
              <Play size={17} /> Play Now
            </GameButton>
          </div>
        </header>
      ) : (
        <>
          <header className="landing-nav">
            <div className="landing-logo">
              <strong>SolTower</strong>
              <span>BETA</span>
            </div>
            <nav className="landing-desktop-links" aria-label="Public navigation">
              <a href="#how-to-play">How to Play</a>
              <a href="/docs">Docs</a>
            </nav>
            <div className="landing-nav-actions">
              <div className="landing-social-actions">
                <IconButton title="Discord placeholder" aria-label="Discord placeholder">
                  <MessageCircle size={18} />
                </IconButton>
                <IconButton title="Telegram placeholder" aria-label="Telegram placeholder">
                  <Send size={18} />
                </IconButton>
              </div>
              <GameButton variant="primary" className="nav-play-button" onClick={onPlay}>
                <Play size={17} /> Play Now
              </GameButton>
              <IconButton
                className="landing-menu-button"
                title={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </IconButton>
            </div>
            {mobileMenuOpen ? (
              <nav className="landing-mobile-menu" aria-label="Mobile navigation">
                <a href="#how-to-play" onClick={() => setMobileMenuOpen(false)}>
                  How to Play
                </a>
                <a href="/docs">Docs</a>
                <button type="button">
                  <MessageCircle size={17} /> Discord
                </button>
                <button type="button">
                  <Send size={17} /> Telegram
                </button>
              </nav>
            ) : null}
          </header>

          <section id="how-to-play" className="landing-hero" aria-labelledby="landing-title">
            <div className="landing-hero-copy">
              <h1 id="landing-title">SolTower</h1>
              <p className="landing-subtitle">A Cozy Co-op Tower Defense Adventure</p>
              <p className="landing-copy">
                Gather in SolBloom Village. Build your hero. Defend the towers with friends.
              </p>
            </div>
            <div className="landing-cta-row">
              <GameButton variant="primary" onClick={onPlay}>
                <Play size={18} /> Play Now
              </GameButton>
              <GameButton variant="secondary" onClick={() => setSpectating(true)}>
                <Eye size={18} /> Spectate
              </GameButton>
            </div>
            <div id="world-status" className="landing-stats" aria-label="World status">
              {stats ? (
                <>
                  {stats.devMode && stats.testWorldActive ? (
                    <StatusPill tone="dev">DEV world active</StatusPill>
                  ) : null}
                  <StatusPill tone={stats.activeTownCount > 0 ? "success" : "neutral"}>
                    {stats.activeTownCount}{" "}
                    {stats.activeTownCount === 1 ? "player" : "players"} in town
                  </StatusPill>
                </>
              ) : stats === undefined ? (
                <StatusPill>Reading world status...</StatusPill>
              ) : (
                <StatusPill>World status unavailable</StatusPill>
              )}
            </div>
          </section>
        </>
      )}

      {notice ? (
        <div className="spectate-notice">
          <span>
            <LockKeyhole size={17} aria-hidden="true" /> {notice}
          </span>
          <GameButton variant="primary" onClick={onPlay}>
            <Play size={17} /> Enter SolBloom
          </GameButton>
        </div>
      ) : null}
    </main>
  );
}
