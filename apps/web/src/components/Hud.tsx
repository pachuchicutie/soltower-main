import {
  Backpack,
  CircleDollarSign,
  ExternalLink,
  Settings,
  Swords,
  UserRound,
  Users,
  Wallet
} from "lucide-react";
import {
  economyConfig,
  getAccountXpProgress,
  uiAssetManifest,
  type HeroAppearance,
  type PublicPlayer
} from "@soltower/shared";
import type { ModalKey } from "../store/ui";
import { AssetIcon } from "./ui/GameUi";
import { HeroAppearancePreview } from "./ui/HeroAppearancePreview";

interface HudProps {
  player: PublicPlayer;
  walletShort: string | null;
  selectedHeroId: string;
  heroAppearance: HeroAppearance;
  onOpen: (modal: ModalKey) => void;
  onProfile: () => void;
}

export function Hud({
  player,
  walletShort,
  selectedHeroId,
  heroAppearance,
  onOpen,
  onProfile
}: HudProps) {
  const buttons: Array<{ label: string; icon: JSX.Element; modal: ModalKey }> = [
    { label: "Hero", icon: <UserRound size={18} />, modal: "hero" },
    { label: "Inventory", icon: <Backpack size={18} />, modal: "inventory" },
    { label: "Market", icon: <CircleDollarSign size={18} />, modal: "market" },
    { label: "Friends", icon: <Users size={18} />, modal: "friends" },
    { label: "Quests", icon: <Swords size={18} />, modal: "quests" },
    { label: "Settings", icon: <Settings size={18} />, modal: "settings" }
  ];
  const isDevMode = import.meta.env.VITE_APP_ENV === "development" || import.meta.env.MODE === "test";
  const towerLabel = isDevMode ? `${economyConfig.towerToken.symbol} (DEV)` : economyConfig.towerToken.symbol;
  const xpProgress = getAccountXpProgress(player.accountLevel, player.xp);

  return (
    <header className="hud">
      <div className="hud-profile">
        <button type="button" className="hud-profile-button" onClick={onProfile}>
          <HeroAppearancePreview
            heroId={selectedHeroId}
            appearance={heroAppearance}
            className="hud-hero-avatar"
            label={`${player.displayName}'s selected Hero`}
          />
          <div className="hud-profile-copy">
            <strong>{player.displayName}</strong>
            <span>
              <span className="wallet-status-icon" aria-hidden="true">
                <Wallet size={13} />
              </span>
              {walletShort ?? "No wallet"} · Level {player.accountLevel}
            </span>
            <div className="hud-xp" aria-label={`${xpProgress.currentXp} of ${xpProgress.xpToNextLevel} XP`}>
              <span className="hud-xp-row">
                <span>XP</span>
                <strong>
                  {xpProgress.currentXp} / {xpProgress.xpToNextLevel}
                </strong>
              </span>
              <span className="hud-xp-track" aria-hidden="true">
                <span style={{ width: `${xpProgress.percent}%` }} />
              </span>
            </div>
          </div>
        </button>
        <span className="sr-only">Connected Solana wallet</span>
      </div>
      <div className="balances" aria-label="Player balances">
        <span>
          <AssetIcon src={uiAssetManifest.currencies.earnedGold} /> Earned {player.balances.EARNED_GOLD}
        </span>
        <span>
          <AssetIcon src={uiAssetManifest.currencies.lockedGold} /> Locked {player.balances.LOCKED_GOLD}
        </span>
        <span className="tower-token-chip">
          <AssetIcon src={uiAssetManifest.currencies.towerToken} /> {towerLabel} {player.balances.TEST_TOKEN}
          <a
            className="tower-token-link"
            href={economyConfig.towerToken.jupiterSwapUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Buy ${economyConfig.towerToken.symbol} on Jupiter`}
            title={`Buy ${economyConfig.towerToken.symbol} on Jupiter`}
          >
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </span>
      </div>
      <nav className="hud-actions" aria-label="Quick actions">
        {buttons.map((button) => (
          <button key={button.label} type="button" title={button.label} onClick={() => onOpen(button.modal)}>
            {button.icon}
            <span>{button.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
