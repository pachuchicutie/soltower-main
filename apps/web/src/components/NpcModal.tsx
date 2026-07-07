import { useRef } from "react";
import { X } from "lucide-react";
import { uiAssetManifest } from "@soltower/shared";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";
import type { ModalKey } from "../store/ui";
import { BlackjackPanel } from "./panels/BlackjackPanel";
import { FriendsPanel } from "./panels/FriendsPanel";
import { HeroInventoryPanel } from "./panels/HeroInventoryPanel";
import { InventoryPanel } from "./panels/InventoryPanel";
import { MarketPanel } from "./panels/MarketPanel";
import { QuestJournalPanel } from "./panels/QuestJournalPanel";
import { RaidPanel } from "./panels/RaidPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { StarlightVaultPanel } from "./panels/StarlightVaultPanel";
import { EventBoardPanel } from "./panels/EventBoardPanel";
import { AssetIcon } from "./ui/GameUi";

interface NpcModalProps {
  modal: ModalKey;
  onClose: () => void;
  onCenterCamera?: () => void;
  onLogout?: () => void;
}

const modalCopy: Record<ModalKey, { title: string; eyebrow: string; subtitle: string; iconSrc: string }> = {
  hero: {
    title: "Hero / Loadout",
    eyebrow: "LOADOUT",
    subtitle: "Tune your active guardian before the next tower run.",
    iconSrc: uiAssetManifest.icons.heroLoadout
  },
  inventory: {
    title: "Inventory",
    eyebrow: "INVENTORY",
    subtitle: "Bound items stay with your account.",
    iconSrc: uiAssetManifest.icons.inventory
  },
  market: {
    title: "Market Board",
    eyebrow: "MARKET",
    subtitle: "Trade Earned Gold through server-authoritative listings and orders.",
    iconSrc: uiAssetManifest.icons.market
  },
  "market-broker": {
    title: "Market Board",
    eyebrow: "MARKET",
    subtitle: "Trade Earned Gold through server-authoritative listings and orders.",
    iconSrc: uiAssetManifest.icons.market
  },
  friends: {
    title: "Lanternroot Tavern",
    eyebrow: "FRIENDS",
    subtitle: "A warm table is easier to find with friends nearby.",
    iconSrc: uiAssetManifest.icons.party
  },
  quests: {
    title: "Quest Journal",
    eyebrow: "QUESTS",
    subtitle: "Every tower needs a guardian.",
    iconSrc: uiAssetManifest.icons.quests
  },
  "quest-board": {
    title: "Quest Journal",
    eyebrow: "QUESTS",
    subtitle: "Every tower needs a guardian.",
    iconSrc: uiAssetManifest.icons.quests
  },
  settings: {
    title: "Settings",
    eyebrow: "SETTINGS",
    subtitle: "Comfort, controls, audio, and local account session tools.",
    iconSrc: uiAssetManifest.icons.settings
  },
  "raid-captain": {
    title: "Raid Board",
    eyebrow: "RAIDS",
    subtitle: "Choose a stage, prepare your party, and defend the tower.",
    iconSrc: uiAssetManifest.icons.party
  },
  blacksmith: {
    title: "Hero / Loadout",
    eyebrow: "LOADOUT",
    subtitle: "Tune your active guardian before the next tower run.",
    iconSrc: uiAssetManifest.icons.heroLoadout
  },
  blackjack: {
    title: "Blackjack Table",
    eyebrow: "BLACKJACK",
    subtitle: "A server-authoritative table for careful wagers.",
    iconSrc: uiAssetManifest.currencies.earnedGold
  },
  tavern: {
    title: "Lanternroot Tavern",
    eyebrow: "FRIENDS",
    subtitle: "A warm table is easier to find with friends nearby.",
    iconSrc: uiAssetManifest.icons.party
  },
  "event-board": {
    title: "Event Board",
    eyebrow: "EVENTS",
    subtitle: "Fresh notices shimmer beneath the village lanterns.",
    iconSrc: uiAssetManifest.icons.feed
  },
  open_starlight_vault: {
    title: "Starlight Vault",
    eyebrow: "STAR DRAWS",
    subtitle: "Draw powerful gear and full costumes for your Guardians.",
    iconSrc: uiAssetManifest.icons.achievement
  }
};

export function NpcModal({ modal, onClose, onCenterCamera, onLogout }: NpcModalProps) {
  const modalRef = useRef<HTMLElement>(null);
  useModalFocusTrap(modalRef, onClose);
  const copy = modalCopy[modal];

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className={`npc-modal npc-modal-${modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header className="npc-modal-header">
          <div className="npc-portrait modal-icon-badge" aria-hidden="true">
            <AssetIcon src={copy.iconSrc} />
          </div>
          <div>
            <span>{copy.eyebrow}</span>
            <h2 id="modal-title">{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{renderPanel(modal, onCenterCamera, onLogout)}</div>
      </section>
    </div>
  );
}

function renderPanel(modal: ModalKey, onCenterCamera?: () => void, onLogout?: () => void) {
  if (modal === "market" || modal === "market-broker") {
    return <MarketPanel />;
  }
  if (modal === "blackjack") {
    return <BlackjackPanel />;
  }
  if (modal === "inventory") {
    return <InventoryPanel />;
  }
  if (modal === "blacksmith" || modal === "hero") {
    return <HeroInventoryPanel />;
  }
  if (modal === "raid-captain") {
    return <RaidPanel />;
  }
  if (modal === "friends" || modal === "tavern") {
    return <FriendsPanel />;
  }
  if (modal === "quest-board" || modal === "quests") {
    return <QuestJournalPanel />;
  }
  if (modal === "settings") {
    return <SettingsPanel onCenterCamera={onCenterCamera} onLogout={onLogout} />;
  }
  if (modal === "event-board") {
    return <EventBoardPanel />;
  }
  if (modal === "open_starlight_vault") {
    return <StarlightVaultPanel />;
  }
  return (
    <div className="panel-grid">
      <article className="compact-panel">
        <strong>Audio</strong>
        <p>Ambient village audio and combat mix controls are prepared for a later asset pass.</p>
      </article>
      <article className="compact-panel">
        <strong>Reduced Motion</strong>
        <p>The interface respects browser reduced-motion preferences.</p>
      </article>
    </div>
  );
}
